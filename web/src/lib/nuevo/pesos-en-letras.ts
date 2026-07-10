/**
 * Convierte un monto entero de pesos colombianos a letras, para llenar
 * automáticamente `lease.monthlyRentText` (que el contrato exige). Soporta hasta
 * billones. Ej.: 1500000 → "un millón quinientos mil pesos m/cte".
 */

const UNIDADES = ["", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"];
const ESPECIALES: Record<number, string> = {
  10: "diez", 11: "once", 12: "doce", 13: "trece", 14: "catorce", 15: "quince",
  16: "dieciséis", 17: "diecisiete", 18: "dieciocho", 19: "diecinueve",
  20: "veinte", 21: "veintiuno", 22: "veintidós", 23: "veintitrés", 24: "veinticuatro",
  25: "veinticinco", 26: "veintiséis", 27: "veintisiete", 28: "veintiocho", 29: "veintinueve",
};
const DECENAS = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
const CENTENAS = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"];

function menorDe100(n: number): string {
  if (n < 10) return UNIDADES[n];
  if (ESPECIALES[n]) return ESPECIALES[n];
  const d = Math.floor(n / 10);
  const u = n % 10;
  return u === 0 ? DECENAS[d] : `${DECENAS[d]} y ${UNIDADES[u]}`;
}

function menorDe1000(n: number): string {
  if (n === 100) return "cien";
  const c = Math.floor(n / 100);
  const resto = n % 100;
  const cent = c > 0 ? CENTENAS[c] : "";
  const rest = resto > 0 ? menorDe100(resto) : "";
  return [cent, rest].filter(Boolean).join(" ");
}

/** Convierte un grupo de miles con su etiqueta ("mil", "millón/millones", etc.). */
function grupo(n: number, singular: string, plural: string): string {
  if (n === 0) return "";
  if (singular === "mil") return n === 1 ? "mil" : `${menorDe1000(n)} mil`;
  if (n === 1) return `un ${singular}`;
  return `${menorDe1000(n)} ${plural}`;
}

export function numeroALetras(entero: number): string {
  const n = Math.floor(Math.abs(entero));
  if (n === 0) return "cero";
  const millones = Math.floor(n / 1_000_000) % 1_000_000;
  const mil = Math.floor(n / 1000) % 1000;
  const resto = n % 1000;
  const millonesMil = Math.floor(n / 1_000_000_000_000); // billones (poco usual)

  const partes = [
    millonesMil > 0 ? grupo(millonesMil, "billón", "billones") : "",
    millones > 0 ? grupo(millones, "millón", "millones") : "",
    mil > 0 ? grupo(mil, "mil", "mil") : "",
    resto > 0 ? menorDe1000(resto) : "",
  ].filter(Boolean);
  return partes.join(" ").replace(/\s+/g, " ").trim();
}

/** Monto en pesos a letras, con sufijo legal. Ej.: "un millón de pesos m/cte". */
export function pesosEnLetras(monto: number): string {
  const n = Math.floor(Math.abs(monto));
  if (n <= 0) return "";
  const letras = numeroALetras(n);
  // "millones/millón de pesos" cuando es múltiplo exacto de millón sin resto;
  // en general basta el sufijo "pesos m/cte" para el contrato.
  return `${letras} pesos m/cte`;
}
