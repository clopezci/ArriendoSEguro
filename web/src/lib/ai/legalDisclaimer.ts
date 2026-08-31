/**
 * Cierre legal OBLIGATORIO para CUALQUIER respuesta de IA que toque temas
 * jurídicos (asesor legal, asistente del contrato, etc.). Deja claro que es
 * información ILUSTRATIVA basada en la documentación de la(s) ley(es) aplicable(s)
 * y que NO sustituye la asesoría jurídica. Centralizado para que sea idéntico y
 * no se olvide en ningún punto de la app.
 */

const GENERIC =
  "Información ilustrativa basada en la documentación de la normativa colombiana aplicable; no sustituye la asesoría jurídica. Verifica el texto vigente en las fuentes oficiales o consulta a un abogado.";

/** Construye el cierre legal. Si se pasan leyes, las cita textualmente. */
export function legalAiDisclaimer(laws?: string[]): string {
  const uniq = Array.from(new Set((laws ?? []).map((l) => l.trim()).filter(Boolean)));
  if (uniq.length === 0) return GENERIC;
  const list = uniq.length === 1 ? uniq[0] : `${uniq.slice(0, -1).join(", ")} y ${uniq[uniq.length - 1]}`;
  return `Información ilustrativa basada en la documentación de ${list}; no sustituye la asesoría jurídica. Verifica el texto vigente en las fuentes oficiales o consulta a un abogado.`;
}

/**
 * Agrega el cierre legal al FINAL del texto de una respuesta de IA (idempotente:
 * si el texto ya trae un descargo similar, no lo duplica). Úsalo cuando el cierre
 * deba ir dentro del propio texto (no como campo aparte).
 */
export function withLegalDisclaimer(answer: string, laws?: string[]): string {
  const text = (answer ?? "").trim();
  const disclaimer = legalAiDisclaimer(laws);
  if (!text) return disclaimer;
  if (/no sustituye (la )?asesor[ií]a jur[ií]dica/i.test(text)) return text;
  return `${text}\n\n— ${disclaimer}`;
}
