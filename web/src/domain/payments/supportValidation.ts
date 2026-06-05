const ALLOWED_EXTENSIONS = new Set(["pdf", "jpg", "jpeg", "png", "webp"]);
const BLOCKED_EXTENSIONS = new Set(["exe", "bat", "cmd", "js", "sh", "zip", "rar"]);
const MAX_SUPPORT_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export function validatePaymentSupportFile(input: {
  supportFileName?: string;
  supportFileType?: string;
  supportFileSize?: number;
}): {
  ok: boolean;
  supportValidationStatus: "pending" | "valid" | "invalid";
  isEmpty: boolean;
  errors: Array<{ field: string; message: string }>;
} {
  const fileName = (input.supportFileName ?? "").trim();
  const hasSize = typeof input.supportFileSize === "number" && input.supportFileSize > 0;
  if (!fileName && !hasSize) {
    return { ok: false, supportValidationStatus: "pending", isEmpty: true, errors: [] };
  }
  if (!fileName) {
    return {
      ok: false,
      supportValidationStatus: "invalid",
      isEmpty: false,
      errors: [{ field: "supportFileName", message: "Indica el nombre del archivo de soporte." }],
    };
  }
  const extension = fileName.includes(".") ? fileName.split(".").pop()?.toLowerCase() ?? "" : "";
  if (!extension || BLOCKED_EXTENSIONS.has(extension) || !ALLOWED_EXTENSIONS.has(extension)) {
    return {
      ok: false,
      supportValidationStatus: "invalid",
      isEmpty: false,
      errors: [{ field: "supportFileName", message: "El soporte debe ser PDF, JPG, JPEG, PNG o WEBP." }],
    };
  }
  if (typeof input.supportFileSize !== "number" || input.supportFileSize <= 0) {
    return {
      ok: false,
      supportValidationStatus: "invalid",
      isEmpty: false,
      errors: [{ field: "supportFileSize", message: "Tamaño de soporte inválido." }],
    };
  }
  if (input.supportFileSize > MAX_SUPPORT_FILE_SIZE_BYTES) {
    return {
      ok: false,
      supportValidationStatus: "invalid",
      isEmpty: false,
      errors: [{ field: "supportFileSize", message: "El soporte supera 5 MB." }],
    };
  }
  // El archivo se sube a Firebase Storage vía URL firmada (api/payments/support/*);
  // aquí validamos nombre/tipo/tamaño y el binario queda en Storage real.
  void input.supportFileType;
  return { ok: true, supportValidationStatus: "valid", isEmpty: false, errors: [] };
}

export function sanitizeSupportFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export type SupportFileKind = "pdf" | "jpg" | "png" | "webp";

/**
 * Identifica el tipo real de un soporte por sus **magic bytes** (firma binaria),
 * no por la extensión ni el `content-type` declarado (que el cliente puede
 * falsear). Se le pasan los primeros bytes del archivo (>= 12 recomendado).
 * Devuelve `null` si no coincide con ningún formato permitido.
 *
 * Firmas:
 *  - PDF : 25 50 44 46           ("%PDF")
 *  - JPG : FF D8 FF
 *  - PNG : 89 50 4E 47 0D 0A 1A 0A
 *  - WEBP: 52 49 46 46 ........ 57 45 42 50   ("RIFF"…"WEBP" en offset 8)
 */
export function sniffSupportFileKind(bytes: Uint8Array): SupportFileKind | null {
  const at = (i: number) => bytes[i] ?? -1;
  // PDF: "%PDF"
  if (at(0) === 0x25 && at(1) === 0x50 && at(2) === 0x44 && at(3) === 0x46) return "pdf";
  // JPG: FF D8 FF
  if (at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return "jpg";
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4e && at(3) === 0x47 &&
    at(4) === 0x0d && at(5) === 0x0a && at(6) === 0x1a && at(7) === 0x0a
  ) {
    return "png";
  }
  // WEBP: "RIFF" .... "WEBP"
  if (
    at(0) === 0x52 && at(1) === 0x49 && at(2) === 0x46 && at(3) === 0x46 &&
    at(8) === 0x57 && at(9) === 0x45 && at(10) === 0x42 && at(11) === 0x50
  ) {
    return "webp";
  }
  return null;
}

/** ¿La cabecera binaria corresponde a un formato de soporte permitido? */
export function isAllowedSupportMagic(bytes: Uint8Array): boolean {
  return sniffSupportFileKind(bytes) !== null;
}

