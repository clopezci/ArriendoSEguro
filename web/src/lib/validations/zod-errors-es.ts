/**
 * Traducción y humanización de mensajes de error de Zod al español.
 *
 * En vez de configurar un `errorMap` global (cuya API cambió en Zod v4),
 * preferimos un helper que se invoca en el momento de renderizar los
 * errores en cada formulario. Esto nos da control total sobre el mensaje
 * mostrado al usuario final y permite anteponer el nombre legible del
 * campo cuando se conoce.
 *
 * Convenciones:
 * - Si el schema ya provee un mensaje custom en español, se usa tal cual.
 * - Si el mensaje es uno por defecto de Zod (en inglés), se traduce
 *   según el código del issue.
 * - Se acepta un mapa opcional `path → label` para anteponer el nombre
 *   amigable del campo (ej. `commercialValue` → "Valor comercial").
 */

import type { ZodIssue } from "zod";

const DEFAULT_FALLBACK = "Hay un dato faltante o inválido en este campo.";

/**
 * Detecta mensajes “genéricos” en inglés generados automáticamente por
 * Zod (los que NO viene escritos por nuestros schemas). Sirve para saber
 * cuándo aplicar la traducción y cuándo respetar el mensaje original.
 */
function isDefaultZodMessage(message: string | undefined): boolean {
  if (!message) return true;
  const lowered = message.toLowerCase();
  return (
    lowered.startsWith("expected ") ||
    lowered.startsWith("invalid ") ||
    lowered.includes("must contain") ||
    lowered.includes("must be") ||
    lowered.includes("required") ||
    lowered.includes("too small") ||
    lowered.includes("too big") ||
    lowered.includes("at least") ||
    lowered.includes("at most")
  );
}

/**
 * Traduce un `ZodIssue` a un mensaje legible en español.
 * Mantiene los mensajes custom que ya están en español.
 */
export function humanizeZodIssueMessage(issue: ZodIssue): string {
  const original = issue.message ?? "";
  if (!isDefaultZodMessage(original)) return original;

  // Codes definidos en Zod (v3 y v4 usan los mismos strings).
  switch (issue.code) {
    case "invalid_type": {
      const i = issue as ZodIssue & { expected?: string; received?: string };
      if (i.expected === "number" || i.received === "nan") {
        return "Este campo debe ser un número.";
      }
      if (i.received === "undefined") {
        return "Este campo es obligatorio.";
      }
      return "El valor ingresado no es válido.";
    }
    case "too_small": {
      const i = issue as ZodIssue & {
        type?: string;
        minimum?: number | bigint;
        inclusive?: boolean;
      };
      const min = Number(i.minimum ?? 0);
      if (i.type === "string") {
        if (min === 1) return "Este campo es obligatorio.";
        return `Debe tener al menos ${min} caracteres.`;
      }
      if (i.type === "number") return `El valor mínimo permitido es ${min}.`;
      if (i.type === "array")
        return `Selecciona al menos ${min} ${min === 1 ? "elemento" : "elementos"}.`;
      return `Valor demasiado corto (mínimo ${min}).`;
    }
    case "too_big": {
      const i = issue as ZodIssue & { type?: string; maximum?: number | bigint };
      const max = Number(i.maximum ?? 0);
      if (i.type === "string") return `Debe tener máximo ${max} caracteres.`;
      if (i.type === "number") return `El valor máximo permitido es ${max}.`;
      return `Valor demasiado largo (máximo ${max}).`;
    }
    case "invalid_format": {
      const i = issue as ZodIssue & { format?: string };
      if (i.format === "email") return "Ingresa un correo electrónico válido.";
      if (i.format === "url") return "Ingresa una dirección web válida.";
      if (i.format === "regex") return "El formato del valor no es válido.";
      return "El formato del valor no es válido.";
    }
    case "invalid_value":
      return "Selecciona una opción válida.";
    case "not_multiple_of":
      return "El número no cumple con el formato esperado.";
    case "unrecognized_keys":
      return "Hay un campo no reconocido en el formulario.";
    case "custom":
    default:
      return original || DEFAULT_FALLBACK;
  }
}

/**
 * Convierte una lista de issues de Zod en strings listos para mostrar
 * al usuario, anteponiendo el nombre amigable del campo cuando exista
 * en el mapa de labels.
 */
export function humanizeZodIssues(
  issues: readonly ZodIssue[],
  fieldLabels: Record<string, string> = {},
): string[] {
  return issues.map((issue) => {
    const message = humanizeZodIssueMessage(issue);
    const pathKey = issue.path.join(".");
    const label = fieldLabels[pathKey];
    if (!label) return message;
    if (message.toLowerCase().includes(label.toLowerCase())) return message;
    return `${label}: ${message}`;
  });
}
