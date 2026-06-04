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

