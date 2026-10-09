/**
 * Lector PURO de la página de información técnica del IPC del DANE. Extrae la
 * frase oficial del boletín, p. ej.:
 *   "En septiembre de 2026 la variación anual del IPC fue 6,29%, …"
 *   "En septiembre de 2026 la variación mensual del IPC fue 0,37%, la variación
 *    año corrido fue 5,74% y la anual 6,29%"
 *
 * Para el reajuste del canon solo sirve la variación anual a DICIEMBRE del año
 * anterior: si la página aún muestra noviembre (el DANE publica diciembre hacia
 * la primera/segunda semana de enero), se devuelve null y se deja el aviso de
 * "aún sin actualizar". Sin red ni Firestore → cubierto por tests.
 */
import { isPlausibleIpc } from "@/domain/annual/annualValues";

export const DANE_IPC_TECH_URL =
  "https://www.dane.gov.co/index.php/estadisticas-por-tema/precios-y-costos/indice-de-precios-al-consumidor-ipc/ipc-informacion-tecnica";

const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
] as const;

export interface DaneIpcReading {
  /** 1-12 */
  month: number;
  year: number;
  /** Variación anual (%) */
  annualPercent: number;
}

/** Quita etiquetas/entidades y normaliza espacios para leer la frase como texto. */
function toPlainText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#37;|&percnt;/gi, "%")
    .replace(/\s+/g, " ");
}

/**
 * Todas las lecturas "mes/año → variación anual" que aparezcan en la página.
 * `variaci.n` tolera tildes mal codificadas.
 */
export function parseDaneIpcReadings(html: string): DaneIpcReading[] {
  const text = toPlainText(html);
  const monthAlt = MONTHS.join("|");
  const patterns = [
    // "En diciembre de 2025 la variación anual del IPC fue 5,10%"
    new RegExp(`En (${monthAlt}) de (\\d{4}),? la variaci.n anual del IPC fue (?:de )?(-?\\d+,\\d+) ?%`, "gi"),
    // "En diciembre de 2025 la variación mensual … y la anual 5,10%"
    new RegExp(`En (${monthAlt}) de (\\d{4})[^.]{0,200}?la anual (?:fue (?:de )?)?(-?\\d+,\\d+) ?%`, "gi"),
  ];
  const out: DaneIpcReading[] = [];
  for (const re of patterns) {
    for (const m of text.matchAll(re)) {
      const month = MONTHS.indexOf(m[1].toLowerCase() as (typeof MONTHS)[number]) + 1;
      const year = Number(m[2]);
      const annualPercent = Number(m[3].replace(",", "."));
      if (month < 1 || !Number.isInteger(year) || !isPlausibleIpc(annualPercent)) continue;
      if (!out.some((r) => r.month === month && r.year === year && r.annualPercent === annualPercent)) {
        out.push({ month, year, annualPercent });
      }
    }
  }
  return out;
}

/**
 * IPC anual de diciembre de `year`, o null si la página aún no lo trae.
 * Si la página trae cifras contradictorias para ese mismo mes, también null
 * (mejor dejar "sin actualizar" que publicar un dato dudoso).
 */
export function pickDecemberIpc(html: string, year: number): number | null {
  const dec = parseDaneIpcReadings(html).filter((r) => r.month === 12 && r.year === year);
  if (dec.length === 0) return null;
  const values = new Set(dec.map((r) => r.annualPercent));
  return values.size === 1 ? dec[0].annualPercent : null;
}
