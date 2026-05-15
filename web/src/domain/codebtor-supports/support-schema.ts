import { z } from "zod";

/** Tipos de soporte económico del codeudor (Bloque 12). */
export const CODEBTOR_SUPPORT_TYPES = [
  "carta_laboral",
  "colilla",
  "certificado_libertad",
  "extracto",
  "declaracion_renta",
  "otro",
] as const;

export type CodebtorSupportType = (typeof CODEBTOR_SUPPORT_TYPES)[number];

export const codebtorSupportTypeSchema = z.enum(CODEBTOR_SUPPORT_TYPES);

export const codebtorSupportContentTypeSchema = z.enum(["application/pdf", "image/jpeg", "image/png"]);

export const CODEBTOR_SUPPORT_MAX_BYTES = 10 * 1024 * 1024;
export const CODEBTOR_SUPPORT_MAX_PER_TYPE = 5;

export const uploadUrlRequestSchema = z.object({
  contractId: z.string().min(3),
  contractVersionId: z.string().min(3),
  supportType: codebtorSupportTypeSchema,
  filename: z.string().min(1).max(200),
  contentType: codebtorSupportContentTypeSchema,
  sizeBytes: z.number().int().positive().max(CODEBTOR_SUPPORT_MAX_BYTES),
});

export const confirmSupportRequestSchema = z.object({
  contractId: z.string().min(3),
  contractVersionId: z.string().min(3),
  supportType: codebtorSupportTypeSchema,
  storagePath: z.string().min(10).max(512),
  contentType: codebtorSupportContentTypeSchema,
  sizeBytes: z.number().int().positive().max(CODEBTOR_SUPPORT_MAX_BYTES),
  originalFilename: z.string().min(1).max(200),
});

export const deleteSupportRequestSchema = z.object({
  contractId: z.string().min(3),
  contractVersionId: z.string().min(3),
  supportId: z.string().min(3),
});

export function safeSupportFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-áéíóúÁÉÍÓÚñÑ]+/g, "_").replace(/_+/g, "_").slice(0, 120) || "archivo";
}
