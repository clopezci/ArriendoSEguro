/**
 * Comparación **antifraude asistiva** entre lo que dice un documento (extraído por
 * IA) y lo que el usuario tecleó. NO bloquea nada: solo produce un veredicto
 * (`match` / `mismatch` / `unclear`) para pintar una **alerta roja** que el dueño
 * revisa. Módulo **puro** (sin red) para poder testear las reglas.
 *
 * Reglas tolerantes a mayúsculas, tildes, orden de nombres, abreviaturas de
 * direcciones y ruido de formato, para minimizar falsos positivos.
 */

export type MatchVerdict = "match" | "mismatch" | "unclear";

/** Normaliza texto: minúsculas, sin tildes, sin puntuación, espacios colapsados. */
export function normalizeText(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Palabras vacías que no aportan a la comparación de nombres.
const NAME_STOPWORDS = new Set(["de", "del", "la", "las", "los", "y", "e", "san", "santa"]);

function nameTokens(s: string): string[] {
  return normalizeText(s)
    .split(" ")
    .filter((t) => t.length > 1 && !NAME_STOPWORDS.has(t));
}

/**
 * ¿El nombre esperado coincide con alguno de los nombres extraídos? Coincide si
 * comparten suficientes tokens (nombre+apellido), sin exigir orden ni completitud.
 */
export function nameMatches(expected: string, extracted: string[]): MatchVerdict {
  const exp = nameTokens(expected);
  if (exp.length === 0) return "unclear";
  const cands = (extracted ?? []).map(nameTokens).filter((t) => t.length > 0);
  if (cands.length === 0) return "unclear";
  for (const cand of cands) {
    const set = new Set(cand);
    const shared = exp.filter((t) => set.has(t)).length;
    // Al menos 2 tokens en común (nombre + apellido) o todos si el nombre es corto.
    const need = Math.min(2, exp.length);
    if (shared >= need) return "match";
  }
  return "mismatch";
}

/** Solo dígitos (para comparar números de documento sin puntos ni espacios). */
export function normalizeDocNumber(s: string | null | undefined): string {
  return (s ?? "").replace(/\D+/g, "");
}

/** ¿El número de documento coincide exactamente (ignorando formato)? */
export function documentNumberMatches(expected: string, extracted: string | null | undefined): MatchVerdict {
  const a = normalizeDocNumber(expected);
  const b = normalizeDocNumber(extracted);
  if (!a || !b) return "unclear";
  return a === b ? "match" : "mismatch";
}

// Abreviaturas de vías que se unifican para comparar direcciones.
const ADDRESS_SYNONYMS: Record<string, string> = {
  cra: "carrera", cr: "carrera", kra: "carrera", krra: "carrera", car: "carrera",
  cll: "calle", cl: "calle", clle: "calle",
  av: "avenida", avda: "avenida",
  tv: "transversal", trans: "transversal", trasv: "transversal",
  dg: "diagonal", diag: "diagonal",
  no: "", nro: "", num: "", numero: "", apto: "apartamento", apt: "apartamento",
  int: "interior", torre: "torre", mz: "manzana", bl: "bloque",
};

function addressTokens(s: string): string[] {
  return normalizeText(s)
    .split(" ")
    .map((t) => (t in ADDRESS_SYNONYMS ? ADDRESS_SYNONYMS[t] : t))
    .filter((t) => t.length > 0);
}

/**
 * ¿La dirección esperada coincide con la extraída? Compara por solapamiento de
 * tokens normalizados (vía + números). Tolera abreviaturas y ruido; exige que la
 * mayoría de los componentes de la dirección esperada aparezcan.
 */
export function addressMatches(expected: string, extracted: string | null | undefined): MatchVerdict {
  const exp = addressTokens(expected);
  const got = addressTokens(extracted ?? "");
  if (exp.length === 0 || got.length === 0) return "unclear";
  const set = new Set(got);
  const shared = exp.filter((t) => set.has(t)).length;
  const ratio = shared / exp.length;
  // Los números de la dirección deben coincidir (evita confundir calles cercanas).
  const expNums = exp.filter((t) => /\d/.test(t));
  const gotNums = new Set(got.filter((t) => /\d/.test(t)));
  const numsOk = expNums.length === 0 || expNums.every((n) => gotNums.has(n));
  if (ratio >= 0.6 && numsOk) return "match";
  if (ratio < 0.3 || !numsOk) return "mismatch";
  return "unclear";
}

/** El peor veredicto manda: cualquier mismatch → mismatch; si no, unclear/ match. */
export function combineVerdicts(verdicts: MatchVerdict[]): MatchVerdict {
  if (verdicts.some((v) => v === "mismatch")) return "mismatch";
  if (verdicts.every((v) => v === "match")) return "match";
  return "unclear";
}
