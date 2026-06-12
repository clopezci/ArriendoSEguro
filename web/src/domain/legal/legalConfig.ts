import type { Firestore } from "firebase-admin/firestore";
import { z } from "zod";
import { IPC_REFERENCE } from "@/lib/domain/rent-law";

/**
 * Configuración legal administrable desde `/admin` (sin tocar código).
 * Hoy: el IPC del año anterior, que fija el tope de reajuste del canon (Ley 820
 * art. 20) y alimenta la calculadora de reajuste. El admin lo actualiza cada
 * año y "confirma" para cortar el recordatorio anual por correo.
 *
 * Documento Firestore: `app_settings/legal_config`. Si no existe, se usa el
 * valor por defecto (`IPC_REFERENCE`) — así nunca queda sin un valor válido.
 */
export const LEGAL_CONFIG_COLLECTION = "app_settings";
export const LEGAL_CONFIG_DOC_ID = "legal_config";

export type LegalConfig = {
  ipcPercent: number;
  ipcPreviousYear: number;
  ipcAppliesToYear: number;
  ipcSource: string;
  ipcUpdatedAt: string | null;
  ipcUpdatedByEmail: string | null;
  /** Año para el cual el admin ya confirmó el IPC (corta el correo anual). */
  ipcConfirmedForYear: number | null;
  /** Último envío del recordatorio anual (para no repetir a diario). */
  ipcReminderLastSentAt: string | null;
  /**
   * Cobro adicional (COP) de la cláusula especial libre («Otra»), que el equipo
   * jurídico revisa. Administrable desde `/admin`. Por defecto $50.000.
   */
  specialClausePriceCop: number;
  /**
   * Correo(s) del aliado jurídico que recibe la solicitud de revisión cuando un
   * usuario elige la cláusula «Otra». Administrable desde `/admin`.
   */
  legalPartnerEmails: string[];
};

/** Precio por defecto de la cláusula especial si el admin no lo ha fijado. */
export const DEFAULT_SPECIAL_CLAUSE_PRICE_COP = 50_000;

const schema = z.object({
  ipcPercent: z.number().positive().max(100).optional(),
  ipcPreviousYear: z.number().int().min(2000).max(2100).optional(),
  ipcAppliesToYear: z.number().int().min(2000).max(2100).optional(),
  ipcSource: z.string().max(200).optional(),
  ipcUpdatedAt: z.string().nullable().optional(),
  ipcUpdatedByEmail: z.string().nullable().optional(),
  ipcConfirmedForYear: z.number().int().nullable().optional(),
  ipcReminderLastSentAt: z.string().nullable().optional(),
  specialClausePriceCop: z.number().int().nonnegative().max(100_000_000).optional(),
  legalPartnerEmails: z.array(z.string().email()).max(20).optional(),
});

export function defaultLegalConfig(): LegalConfig {
  return {
    ipcPercent: IPC_REFERENCE.percent,
    ipcPreviousYear: IPC_REFERENCE.previousYear,
    ipcAppliesToYear: IPC_REFERENCE.appliesToYear,
    ipcSource: IPC_REFERENCE.source,
    ipcUpdatedAt: null,
    ipcUpdatedByEmail: null,
    ipcConfirmedForYear: null,
    ipcReminderLastSentAt: null,
    specialClausePriceCop: DEFAULT_SPECIAL_CLAUSE_PRICE_COP,
    legalPartnerEmails: [],
  };
}

export function resolveLegalConfig(stored: unknown): LegalConfig {
  const d = defaultLegalConfig();
  const parsed = schema.safeParse(stored);
  if (!parsed.success) return d;
  const s = parsed.data;
  return {
    ipcPercent: s.ipcPercent ?? d.ipcPercent,
    ipcPreviousYear: s.ipcPreviousYear ?? d.ipcPreviousYear,
    ipcAppliesToYear: s.ipcAppliesToYear ?? d.ipcAppliesToYear,
    ipcSource: s.ipcSource ?? d.ipcSource,
    ipcUpdatedAt: s.ipcUpdatedAt ?? d.ipcUpdatedAt,
    ipcUpdatedByEmail: s.ipcUpdatedByEmail ?? d.ipcUpdatedByEmail,
    ipcConfirmedForYear: s.ipcConfirmedForYear ?? d.ipcConfirmedForYear,
    ipcReminderLastSentAt: s.ipcReminderLastSentAt ?? d.ipcReminderLastSentAt,
    specialClausePriceCop: s.specialClausePriceCop ?? d.specialClausePriceCop,
    legalPartnerEmails: s.legalPartnerEmails ?? d.legalPartnerEmails,
  };
}

export async function getLegalConfig(firestore: Firestore | null | undefined): Promise<LegalConfig> {
  if (!firestore) return defaultLegalConfig();
  try {
    const snap = await firestore.collection(LEGAL_CONFIG_COLLECTION).doc(LEGAL_CONFIG_DOC_ID).get();
    if (!snap.exists) return defaultLegalConfig();
    return resolveLegalConfig(snap.data());
  } catch {
    return defaultLegalConfig();
  }
}
