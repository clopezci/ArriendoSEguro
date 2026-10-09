/**
 * Valores oficiales que cambian cada año y que la app usa:
 *   - IPC (DANE): tope del reajuste anual del canon (Ley 820, art. 20).
 *   - UVT (DIAN): base del tope para volverse responsable de IVA (3.500 UVT).
 *
 * La FUENTE DE VERDAD sigue siendo la configuración existente (`legal_config`
 * para el IPC, `tax_config` para la UVT), editable en /admin. Este módulo es
 * PURO (sin Firestore): normaliza esos valores, deriva su ESTADO frente al año
 * en curso, arma el aviso visible ("actualizado según X" / "aún sin actualizar
 * según X") y resuelve las variables `{ipc.percent}`… en textos (blog).
 */

export type AnnualValueKey = "ipc" | "uvt";

export type AnnualValueStatus = "updated" | "pending";

export interface IpcValue {
  /** Variación anual (%) certificada, ej. 5.1. */
  percent: number;
  /** Año medido (el IPC "de 2025"). */
  year: number;
  /** Año en que aplica como tope de reajuste (year + 1). */
  appliesTo: number;
  source: string;
  sourceUrl: string;
  /** Última actualización del dato (ISO) o null si es el valor por defecto. */
  updatedAt: string | null;
  /** "auto" (tarea programada) | correo del admin | null. */
  updatedBy: string | null;
}

export interface UvtValue {
  /** Valor de la UVT en COP. */
  value: number;
  /** Año de vigencia. */
  year: number;
  source: string;
  sourceUrl: string;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface AnnualValues {
  ipc: IpcValue;
  uvt: UvtValue;
}

export const IPC_DEFAULT_SOURCE = "DANE";
export const IPC_DEFAULT_SOURCE_URL =
  "https://www.dane.gov.co/index.php/estadisticas-por-tema/precios-y-costos/indice-de-precios-al-consumidor-ipc";
export const UVT_DEFAULT_SOURCE = "DIAN";
export const UVT_DEFAULT_SOURCE_URL = "https://www.dian.gov.co/";

/** Año calendario en Colombia (America/Bogota), para no depender del huso del servidor. */
export function bogotaYearMonth(now: Date = new Date()): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit" }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value); // 1-12
  return { year, month };
}

/**
 * Estado del IPC: "updated" si ya aplica al año en curso (el IPC del año pasado
 * está cargado); "pending" si seguimos mostrando el del año anterior.
 */
export function ipcStatus(ipc: Pick<IpcValue, "appliesTo">, now: Date = new Date()): AnnualValueStatus {
  return ipc.appliesTo >= bogotaYearMonth(now).year ? "updated" : "pending";
}

/** Estado de la UVT: "updated" si es la del año en curso. */
export function uvtStatus(uvt: Pick<UvtValue, "year">, now: Date = new Date()): AnnualValueStatus {
  return uvt.year >= bogotaYearMonth(now).year ? "updated" : "pending";
}

/** Formato colombiano de porcentaje: 5.1 → "5,10". */
export function formatPercentCo(n: number): string {
  return n.toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Formato de pesos: 1051000 → "$1.051.000". */
export function formatCopAnnual(n: number): string {
  return `$${Math.round(n).toLocaleString("es-CO")}`;
}

function formatDateCo(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "long", year: "numeric" });
}

/**
 * Aviso visible junto al dato. Ej.:
 *  - "Dato vigente para 2026: IPC 2025 = 5,10 % según DANE (actualizado el 8 de enero de 2026)."
 *  - "Aún sin actualizar para 2027: DANE todavía no publica el IPC de 2026; se muestra el último dato vigente (IPC 2025 = 5,10 %)."
 */
export function ipcNoticeText(ipc: IpcValue, now: Date = new Date()): string {
  const { year: currentYear } = bogotaYearMonth(now);
  const pct = formatPercentCo(ipc.percent);
  if (ipcStatus(ipc, now) === "updated") {
    const when = formatDateCo(ipc.updatedAt);
    return `Dato vigente para ${ipc.appliesTo}: IPC ${ipc.year} = ${pct} % según ${ipc.source}${when ? ` (actualizado el ${when})` : ""}.`;
  }
  return `Aún sin actualizar para ${currentYear}: ${ipc.source} todavía no publica el IPC de ${currentYear - 1}; se muestra el último dato vigente (IPC ${ipc.year} = ${pct} %).`;
}

export function uvtNoticeText(uvt: UvtValue, now: Date = new Date()): string {
  const { year: currentYear } = bogotaYearMonth(now);
  const v = formatCopAnnual(uvt.value);
  if (uvtStatus(uvt, now) === "updated") {
    const when = formatDateCo(uvt.updatedAt);
    return `UVT ${uvt.year} = ${v} según ${uvt.source}${when ? ` (actualizado el ${when})` : ""}.`;
  }
  return `Aún sin actualizar para ${currentYear}: ${uvt.source} todavía no publica la UVT de ${currentYear}; se muestra la última vigente (UVT ${uvt.year} = ${v}).`;
}

/** Nuevo canon máximo con el IPC: canon × (1 + IPC). */
export function maxRentWithIpc(rent: number, ipcPercent: number): number {
  return Math.round(rent * (1 + ipcPercent / 100));
}

/**
 * Reemplaza variables en un texto con los valores vigentes. Variables:
 *   {ipc.percent} {ipc.year} {ipc.appliesTo} {ipc.source} {ipc.sourceUrl}
 *   {ipc.raise:1000000}   → aumento máximo en pesos para ese canon
 *   {ipc.newRent:1000000} → nuevo canon máximo para ese canon
 *   {uvt.value} {uvt.year} {uvt.source} {uvt.sourceUrl}
 * Una variable desconocida se deja tal cual (visible para corregirla).
 */
export function resolveAnnualTokens(text: string, v: AnnualValues): string {
  return text.replace(/\{(ipc|uvt)\.([a-zA-Z]+)(?::(\d+))?\}/g, (whole, group: string, field: string, arg?: string) => {
    if (group === "ipc") {
      const n = arg ? Number(arg) : NaN;
      switch (field) {
        case "percent": return formatPercentCo(v.ipc.percent);
        case "year": return String(v.ipc.year);
        case "appliesTo": return String(v.ipc.appliesTo);
        case "source": return v.ipc.source;
        case "sourceUrl": return v.ipc.sourceUrl;
        case "raise": return Number.isFinite(n) ? formatCopAnnual(maxRentWithIpc(n, v.ipc.percent) - n) : whole;
        case "newRent": return Number.isFinite(n) ? formatCopAnnual(maxRentWithIpc(n, v.ipc.percent)) : whole;
        default: return whole;
      }
    }
    switch (field) {
      case "value": return formatCopAnnual(v.uvt.value);
      case "year": return String(v.uvt.year);
      case "source": return v.uvt.source;
      case "sourceUrl": return v.uvt.sourceUrl;
      default: return whole;
    }
  });
}

/** ¿El texto usa variables de este valor? (para el aviso y la fecha de actualización). */
export function usesAnnualKey(text: string, key: AnnualValueKey): boolean {
  return new RegExp(`\\{${key}\\.`).test(text);
}

/** Validación de cordura para un IPC leído de una fuente externa. */
export function isPlausibleIpc(percent: number): boolean {
  return Number.isFinite(percent) && percent > -5 && percent < 40;
}

/** Validación de cordura para una UVT leída de una fuente externa (COP). */
export function isPlausibleUvt(value: number, previous: number): boolean {
  if (!Number.isFinite(value) || value < 10_000 || value > 500_000) return false;
  // La UVT se reajusta con la inflación: rechazar saltos absurdos frente a la anterior.
  if (previous > 0) {
    const ratio = value / previous;
    if (ratio < 0.95 || ratio > 1.4) return false;
  }
  return true;
}
