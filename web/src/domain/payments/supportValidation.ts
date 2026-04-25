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
  errors: Array<{ field: string; message: string }>;
} {
  const fileName = (input.supportFileName ?? "").trim();
  if (!fileName) {
    return { ok: false, supportValidationStatus: "pending", errors: [{ field: "support", message: "Debes adjuntar soporte para marcar pago reportado." }] };
  }
  const extension = fileName.includes(".") ? fileName.split(".").pop()?.toLowerCase() ?? "" : "";
  if (!extension || BLOCKED_EXTENSIONS.has(extension) || !ALLOWED_EXTENSIONS.has(extension)) {
    return {
      ok: false,
      supportValidationStatus: "invalid",
      errors: [{ field: "supportFileName", message: "El soporte debe ser PDF, JPG, JPEG, PNG o WEBP." }],
    };
  }
  if (typeof input.supportFileSize !== "number" || input.supportFileSize <= 0) {
    return { ok: false, supportValidationStatus: "invalid", errors: [{ field: "supportFileSize", message: "Tamaño de soporte inválido." }] };
  }
  if (input.supportFileSize > MAX_SUPPORT_FILE_SIZE_BYTES) {
    return {
      ok: false,
      supportValidationStatus: "invalid",
      errors: [{ field: "supportFileSize", message: "El soporte supera 5 MB." }],
    };
  }
  // TODO: validar contenido binario real y magic numbers cuando exista upload backend real.
  void input.supportFileType;
  return { ok: true, supportValidationStatus: "valid", errors: [] };
}

export function sanitizeSupportFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

