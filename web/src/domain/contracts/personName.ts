/**
 * Validación del NOMBRE COMPLETO de una persona (arrendador, arrendatario,
 * codeudor, poderdante). Regla única compartida entre el cliente (flujo /nuevo
 * y wizard del dashboard) y el SERVIDOR (validateContractData), para que no se
 * pueda burlar desde un request manipulado.
 *
 * Exige: al menos NOMBRE + APELLIDO (dos palabras de ≥2 letras), solo letras
 * (incluye tildes y ñ), espacios y conectores válidos ('.', apóstrofo, guion).
 * Rechaza números, símbolos raros, una sola palabra y repeticiones ("aaaa").
 */
export const FULL_NAME_MAX = 120;

// Solo letras (con acentos/ñ), espacios y conectores . ' - entre palabras.
const NAME_CHARS_RE = /^[A-Za-zÀ-ÿñÑ]+(?:[ .'\-]+[A-Za-zÀ-ÿñÑ]+)*$/;

export function fullNameError(value: string | undefined | null): string | null {
  const t = (value || "").trim().replace(/\s+/g, " ");
  if (t.length < 5) return "Escribe nombre y apellido completos.";
  if (t.length > FULL_NAME_MAX) return "El nombre es demasiado largo.";
  if (!NAME_CHARS_RE.test(t)) return "El nombre solo debe llevar letras (sin números ni símbolos).";
  // Al menos dos palabras "reales" (≥2 letras): nombre + apellido.
  const words = t.split(/[ .'\-]+/).filter((w) => w.length >= 2);
  if (words.length < 2) return "Escribe al menos nombre y apellido.";
  // Una sola letra repetida no es un nombre real ("aaaa", "xx xx").
  if (/^(.)\1+$/.test(t.replace(/[^A-Za-zÀ-ÿñÑ]/g, "").toLowerCase())) return "Escribe tu nombre real (nombre y apellido).";
  return null;
}

export function isValidFullName(value: string | undefined | null): boolean {
  return fullNameError(value) === null;
}
