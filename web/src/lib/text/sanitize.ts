/**
 * Helpers de sanitización de texto ingresado por usuarios.
 *
 * Mantenemos un único punto de normalización para que los datos guardados
 * en el contrato y en el expediente queden con un formato consistente
 * (mismo barrio escrito por dos partes no genere duplicados, las plantillas
 * impresas no tengan dobles espacios, etc.).
 *
 * El criterio es: nunca cambiar el contenido semántico, solo limpieza
 * cosmética. No se quitan tildes ni eñes; se conservan letras nacionales.
 */

/**
 * Elimina espacios al inicio/fin y reduce cualquier secuencia de espacios
 * en blanco (incluyendo tabs y saltos) a un único espacio simple. Si la
 * entrada no es texto, devuelve cadena vacía.
 */
export function trimAndCollapse(value: string | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

/**
 * Capitalización tipo "Title Case" en español, respetando guiones y
 * apóstrofes. No fuerza minúsculas para palabras que ya estaban en
 * mayúsculas si el usuario las escribió así (por ejemplo, "SAS"); este
 * helper sí lo hace por simplicidad porque está pensado para nombres
 * propios cortos (ciudades, barrios, departamentos, complemento de
 * dirección).
 *
 * Ejemplos:
 *   "  bogotá   d.c. "      → "Bogotá D.C."
 *   "BARRIO CHAPINERO"     → "Barrio Chapinero"
 *   "santa fe de antioquia" → "Santa Fe De Antioquia"
 */
export function toTitleCaseEs(value: string | null | undefined): string {
  const cleaned = trimAndCollapse(value).toLowerCase();
  if (!cleaned) return "";
  return cleaned.replace(
    /(^|[\s\-'.\/])([a-záéíóúñü])/g,
    (_match, separator: string, char: string) => separator + char.toUpperCase(),
  );
}

/**
 * Normaliza una cadena para conservarla en mayúsculas, útil para placas,
 * letras de vía o complementos cortos. Si está vacía devuelve "".
 */
export function toUpperTrimmed(value: string | null | undefined): string {
  return trimAndCollapse(value).toUpperCase();
}

/**
 * Sanitiza un campo libre largo (notas, observaciones) sin cambiar
 * capitalización: solo limpia espacios.
 */
export function sanitizeFreeText(value: string | null | undefined): string {
  return trimAndCollapse(value);
}
