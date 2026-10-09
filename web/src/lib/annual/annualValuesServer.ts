import "server-only";
import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";
import {
  IPC_DEFAULT_SOURCE,
  IPC_DEFAULT_SOURCE_URL,
  UVT_DEFAULT_SOURCE,
  UVT_DEFAULT_SOURCE_URL,
  bogotaYearMonth,
  formatCopAnnual,
  formatPercentCo,
  ipcNoticeText,
  ipcStatus,
  uvtNoticeText,
  uvtStatus,
  type AnnualValueStatus,
  type AnnualValues,
} from "@/domain/annual/annualValues";
import { DANE_IPC_TECH_URL, pickDecemberIpc } from "@/domain/annual/daneIpc";
import { LEGAL_CONFIG_COLLECTION, LEGAL_CONFIG_DOC_ID, getLegalConfig } from "@/domain/legal/legalConfig";
import { getTaxConfig } from "@/lib/tax/serverTaxConfig";
import { resolveTaxConfig } from "@/domain/tax/taxConfig";
import { sendTelegram } from "@/services/telegram/sendTelegram";
import { auditEvent } from "@/features/contracts/audit-server";
import { appConfig } from "@/lib/config";

/**
 * Valores anuales oficiales (IPC del DANE, UVT de la DIAN): lectura para las
 * páginas públicas + revisión automática SEMANAL durante enero y febrero.
 *
 * - IPC: se lee de la página técnica del DANE. Solo se acepta la variación
 *   anual de DICIEMBRE del año anterior; si aún no está, queda el aviso
 *   "aún sin actualizar según DANE" y se reintenta la semana siguiente.
 * - UVT: la DIAN la publica en una resolución (sin dato legible por máquina),
 *   así que no se adivina: mientras esté pendiente se avisa por Telegram para
 *   cargarla en /admin, y la web muestra "aún sin actualizar según DIAN".
 *
 * Funciona solo año tras año: el "año en curso" sale del reloj (hora Colombia).
 */

/** Metadatos de la revisión automática (no son la fuente de verdad de los valores). */
const META_COLLECTION = "app_settings";
const META_DOC_ID = "annual_values";
/** Una vez por semana (el cron diario dispara a diario; aquí se espacia). */
const MIN_DAYS_BETWEEN_RUNS = 6.5;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Páginas que muestran valores anuales (se refrescan al cambiar un valor). */
export const ANNUAL_PAGES = [
  "/blog/reajuste-canon-arrendamiento-ipc",
  "/blog",
  "/calculadoras/reajuste-canon",
] as const;

export function revalidateAnnualPages(): void {
  for (const p of ANNUAL_PAGES) {
    try {
      revalidatePath(p);
    } catch {
      /* fuera de un contexto de Next (tests/scripts): no aplica */
    }
  }
}

/** "DANE (variación anual a diciembre de 2025)" → "DANE" para los avisos. */
function shortSource(s: string | null | undefined, fallback: string): string {
  const t = (s ?? "").split("(")[0].trim();
  return t || fallback;
}

/** Arma los valores vigentes desde la config existente (legal_config + tax_config). */
export async function loadAnnualValues(firestore: Firestore | null): Promise<AnnualValues> {
  const [legal, tax] = await Promise.all([
    getLegalConfig(firestore),
    firestore ? getTaxConfig(firestore) : Promise.resolve(null),
  ]);
  const t = tax ?? resolveTaxConfig(undefined);
  return {
    ipc: {
      percent: legal.ipcPercent,
      year: legal.ipcPreviousYear,
      appliesTo: legal.ipcAppliesToYear,
      source: shortSource(legal.ipcSource, IPC_DEFAULT_SOURCE),
      sourceUrl: legal.ipcSourceUrl ?? IPC_DEFAULT_SOURCE_URL,
      updatedAt: legal.ipcUpdatedAt,
      updatedBy: legal.ipcUpdatedByEmail,
    },
    uvt: {
      value: t.uvtValue,
      year: t.uvtYear,
      source: UVT_DEFAULT_SOURCE,
      sourceUrl: UVT_DEFAULT_SOURCE_URL,
      updatedAt: t.uvtUpdatedAt ?? null,
      updatedBy: null,
    },
  };
}

export interface AnnualValuesView {
  values: AnnualValues;
  status: { ipc: AnnualValueStatus; uvt: AnnualValueStatus };
  notice: { ipc: string; uvt: string };
  currentYear: number;
}

export function buildAnnualValuesView(values: AnnualValues, now: Date = new Date()): AnnualValuesView {
  // Al público no se le muestra quién actualizó (puede ser un correo de admin).
  const safe: AnnualValues = {
    ipc: { ...values.ipc, updatedBy: values.ipc.updatedBy?.startsWith("auto") ? values.ipc.updatedBy : null },
    uvt: { ...values.uvt, updatedBy: null },
  };
  return {
    values: safe,
    status: { ipc: ipcStatus(values.ipc, now), uvt: uvtStatus(values.uvt, now) },
    notice: { ipc: ipcNoticeText(values.ipc, now), uvt: uvtNoticeText(values.uvt, now) },
    currentYear: bogotaYearMonth(now).year,
  };
}

export async function getAnnualValuesView(firestore: Firestore | null): Promise<AnnualValuesView> {
  return buildAnnualValuesView(await loadAnnualValues(firestore));
}

/** Descarga la página técnica del IPC del DANE (con tiempo límite). */
async function fetchDanePage(): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const res = await fetch(DANE_IPC_TECH_URL, {
      signal: ctrl.signal,
      cache: "no-store",
      headers: {
        "user-agent": `Mozilla/5.0 (compatible; ArriendoSeguroBot/1.0; +${appConfig.publicUrl})`,
        accept: "text/html",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

export interface AnnualRefreshResult {
  ran: boolean;
  skipped?: string;
  ipc?: { status: AnnualValueStatus; changed: boolean; note: string };
  uvt?: { status: AnnualValueStatus; note: string };
}

/**
 * Revisión automática. `force` (botón "Revisar ahora" del admin) ignora la
 * ventana enero–febrero y el espaciado semanal.
 */
export async function runAnnualValuesRefresh(
  firestore: Firestore,
  opts: { force?: boolean; now?: Date; fetchDane?: () => Promise<string> } = {},
): Promise<AnnualRefreshResult> {
  const now = opts.now ?? new Date();
  const { year, month } = bogotaYearMonth(now);
  const metaRef = firestore.collection(META_COLLECTION).doc(META_DOC_ID);

  if (!opts.force) {
    if (month > 2) return { ran: false, skipped: "fuera de ventana (solo enero y febrero)" };
    const meta = (await metaRef.get()).data() as { lastRunAt?: string } | undefined;
    const last = meta?.lastRunAt ? Date.parse(meta.lastRunAt) : NaN;
    if (Number.isFinite(last) && now.getTime() - last < MIN_DAYS_BETWEEN_RUNS * DAY_MS) {
      return { ran: false, skipped: "ya se revisó esta semana" };
    }
  }

  const values = await loadAnnualValues(firestore);
  const nowIso = now.toISOString();
  const telegram: string[] = [];

  // ── IPC (DANE) ────────────────────────────────────────────────────────────
  let ipcOut: NonNullable<AnnualRefreshResult["ipc"]>;
  if (ipcStatus(values.ipc, now) === "updated") {
    ipcOut = { status: "updated", changed: false, note: `Vigente para ${values.ipc.appliesTo} (IPC ${values.ipc.year} = ${formatPercentCo(values.ipc.percent)} %).` };
  } else {
    const wanted = year - 1;
    let pct: number | null = null;
    let note = "";
    try {
      pct = pickDecemberIpc(await (opts.fetchDane ?? fetchDanePage)(), wanted);
      if (pct == null) note = `El DANE aún no publica el IPC de diciembre de ${wanted}. Se reintenta la próxima semana.`;
    } catch (err) {
      note = `No se pudo leer la página del DANE (${err instanceof Error ? err.message : "error"}). Se reintenta la próxima semana.`;
    }
    if (pct != null) {
      await firestore.collection(LEGAL_CONFIG_COLLECTION).doc(LEGAL_CONFIG_DOC_ID).set(
        {
          ipcPercent: pct,
          ipcPreviousYear: wanted,
          ipcAppliesToYear: year,
          ipcSource: IPC_DEFAULT_SOURCE,
          ipcSourceUrl: DANE_IPC_TECH_URL,
          ipcUpdatedAt: nowIso,
          ipcUpdatedByEmail: "auto (DANE)",
          // Corta el recordatorio de enero por correo: ya quedó actualizado.
          ipcConfirmedForYear: year,
          updatedAtServer: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      revalidateAnnualPages();
      auditEvent("annual_ipc_auto_updated", { year: wanted, percent: pct });
      ipcOut = { status: "updated", changed: true, note: `Actualizado: IPC ${wanted} = ${formatPercentCo(pct)} % (tope de reajuste ${year}), según DANE.` };
      telegram.push(
        `✅ IPC actualizado automáticamente desde el DANE: IPC ${wanted} = ${formatPercentCo(pct)} %. ` +
          `Ya aplica en la calculadora, renovaciones y el blog. Verifícalo en ${DANE_IPC_TECH_URL}`,
      );
    } else {
      ipcOut = { status: "pending", changed: false, note };
      telegram.push(`⏳ IPC ${year - 1} aún sin actualizar: ${note} Si ya salió, puedes cargarlo a mano en ${appConfig.publicUrl}/admin.`);
    }
  }

  // ── UVT (DIAN): sin fuente legible por máquina → recordatorio ──────────────
  let uvtOut: NonNullable<AnnualRefreshResult["uvt"]>;
  if (uvtStatus(values.uvt, now) === "updated") {
    uvtOut = { status: "updated", note: `Vigente: UVT ${values.uvt.year} = ${formatCopAnnual(values.uvt.value)}.` };
  } else {
    uvtOut = {
      status: "pending",
      note: `Falta la UVT ${year} (la publica la DIAN por resolución). Cárgala en /admin → Impuestos.`,
    };
    telegram.push(
      `⏳ UVT ${year} pendiente: la DIAN la fija por resolución (no hay dato automático). ` +
        `Cárgala en ${appConfig.publicUrl}/admin → Impuestos (UVT vigente y año). Hoy se usa UVT ${values.uvt.year} = ${formatCopAnnual(values.uvt.value)}.`,
    );
  }

  await metaRef.set(
    {
      lastRunAt: nowIso,
      lastRunForced: Boolean(opts.force),
      ipcLastNote: ipcOut.note,
      uvtLastNote: uvtOut.note,
      updatedAtServer: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  // Aviso al equipo solo en la revisión programada (el botón ya muestra el resultado).
  if (!opts.force && telegram.length > 0) {
    await sendTelegram(`📅 Valores anuales (revisión semanal ene–feb)\n\n${telegram.join("\n\n")}`);
  }

  return { ran: true, ipc: ipcOut, uvt: uvtOut };
}

/** Última revisión automática (para el panel admin). */
export async function getAnnualRefreshMeta(
  firestore: Firestore,
): Promise<{ lastRunAt: string | null; ipcLastNote: string | null; uvtLastNote: string | null }> {
  try {
    const d = (await firestore.collection(META_COLLECTION).doc(META_DOC_ID).get()).data() ?? {};
    return {
      lastRunAt: typeof d.lastRunAt === "string" ? d.lastRunAt : null,
      ipcLastNote: typeof d.ipcLastNote === "string" ? d.ipcLastNote : null,
      uvtLastNote: typeof d.uvtLastNote === "string" ? d.uvtLastNote : null,
    };
  } catch {
    return { lastRunAt: null, ipcLastNote: null, uvtLastNote: null };
  }
}
