/**
 * Validación de números de documento para personas en flujos de arriendo en Colombia.
 *
 * Fuentes de criterio (uso práctico, no sustituyen normativa expedida por la Registraduría / Migración):
 * - CC: documento numérico emitido por Registraduría (sin letras en el número). No usamos TI en el flujo de contrato (menores de edad no suscriben).
 * - CE: Migración Colombia suele usar alfanumérico; permitimos mezcla controlada.
 * - NIT: incluye dígito de verificación; usamos el algoritmo de módulo 11 usual en servicios tributarios.
 * - Pasaporte: alfanumérico internacional.
 *
 * Si en el futuro se requiere integración con una API de validación oficial, concentrar el cambio aquí.
 */

import type { DocumentType } from "@/domain/contracts/types";

export const DOCUMENT_TYPE_OPTIONS: {
  value: DocumentType;
  label: string;
  hint?: string;
}[] = [
  { value: "CC", label: "Cédula de ciudadanía", hint: "Solo números, 6 a 11 dígitos." },
  { value: "CE", label: "Cédula de extranjería", hint: "Letras y números, 6 a 15 caracteres." },
  { value: "PASAPORTE", label: "Pasaporte", hint: "Letras y números, 6 a 15 caracteres." },
  { value: "NIT", label: "NIT (con dígito de verificación)", hint: "Solo números; incluye el dígito de verificación al final." },
  { value: "OTRO", label: "Otro documento", hint: "Describe un identificador válido (4 a 24 caracteres)." },
];

/** Limpia espacios; no altera orden de letras/números salvo trim. */
export function normalizeDocumentInput(raw: string): string {
  return raw.replace(/\s+/g, "").trim();
}

function onlyDigits(s: string): boolean {
  return /^\d+$/.test(s);
}

/**
 * Calcula el dígito de verificación de un NIT colombiano (solo el cuerpo, sin DV).
 * Implementación equivalente a la divulgada por la DIAN para validación en línea (factores + módulo 11).
 */
export function nitCheckDigit(bodyWithoutDv: string): number {
  const body = bodyWithoutDv.replace(/\D/g, "");
  if (body.length < 8) return -1;
  const vpri = [0, 3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
  let sum = 0;
  const z = body.length;
  for (let i = 0; i < z; i++) {
    const digit = parseInt(body.substring(i, i + 1), 10);
    if (Number.isNaN(digit)) return -1;
    sum += digit * vpri[z - i]!;
  }
  const residuo = sum % 11;
  return residuo > 1 ? 11 - residuo : residuo;
}

export type DocumentValidationResult =
  | { ok: true; normalized: string }
  | { ok: false; message: string };

/**
 * Valida el número según el tipo; devuelve valor normalizado listo para guardar (mayúsculas en alfanuméricos).
 */
export function validateDocumentNumber(
  documentType: string,
  rawNumber: string,
): DocumentValidationResult {
  const n = normalizeDocumentInput(rawNumber);
  if (!n) {
    return { ok: false, message: "Ingresa el número de documento." };
  }

  const kind = documentType === "TI" ? "CC" : (documentType as DocumentType);

  switch (kind) {
    case "CC": {
      if (!onlyDigits(n)) {
        return { ok: false, message: "Este documento solo lleva números, sin letras." };
      }
      if (n.length < 6 || n.length > 11) {
        return { ok: false, message: "Revisa la longitud (típicamente entre 6 y 11 dígitos)." };
      }
      return { ok: true, normalized: n };
    }
    case "CE": {
      const v = n.toUpperCase();
      if (!/^[A-Z0-9]{6,15}$/.test(v)) {
        return {
          ok: false,
          message: "Usa letras y números sin espacios; entre 6 y 15 caracteres.",
        };
      }
      if (!/\d/.test(v)) {
        return { ok: false, message: "El número de cédula de extranjería debe incluir al menos un dígito." };
      }
      return { ok: true, normalized: v };
    }
    case "PASAPORTE": {
      const v = n.toUpperCase();
      if (!/^[A-Z0-9]{6,15}$/.test(v)) {
        return { ok: false, message: "Pasaporte inválido (6 a 15 caracteres alfanuméricos)." };
      }
      return { ok: true, normalized: v };
    }
    case "NIT": {
      const digits = n.replace(/\D/g, "");
      if (digits.length < 9 || digits.length > 11) {
        return { ok: false, message: "NIT inválido: ingresa entre 9 y 11 dígitos incluyendo el dígito de verificación." };
      }
      const body = digits.slice(0, -1);
      const dv = parseInt(digits.slice(-1), 10);
      if (Number.isNaN(dv)) {
        return { ok: false, message: "El último dígito del NIT debe ser el dígito de verificación." };
      }
      const expected = nitCheckDigit(body);
      if (expected < 0 || expected !== dv) {
        return {
          ok: false,
          message: "El NIT no coincide con su dígito de verificación. Revisa el número en el RUT o cédula tributaria.",
        };
      }
      return { ok: true, normalized: digits };
    }
    case "OTRO": {
      const t = rawNumber.trim();
      if (t.length < 4 || t.length > 24) {
        return { ok: false, message: "Indica entre 4 y 24 caracteres para el documento." };
      }
      return { ok: true, normalized: t.toUpperCase() };
    }
    default:
      return { ok: false, message: "Selecciona un tipo de documento válido." };
  }
}
