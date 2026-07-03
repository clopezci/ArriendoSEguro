import { z } from "zod";

/** Parte a la que pertenece el soporte económico. */
export const SUPPORT_PARTY_VALUES = ["codebtor", "tenant"] as const;
export type SupportParty = (typeof SUPPORT_PARTY_VALUES)[number];
export const supportPartySchema = z.enum(SUPPORT_PARTY_VALUES).optional().default("codebtor");

/** Tipos de soporte económico (codeudor o inquilino). */
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
  party: supportPartySchema,
  supportType: codebtorSupportTypeSchema,
  filename: z.string().min(1).max(200),
  contentType: codebtorSupportContentTypeSchema,
  sizeBytes: z.number().int().positive().max(CODEBTOR_SUPPORT_MAX_BYTES),
});

export const confirmSupportRequestSchema = z.object({
  contractId: z.string().min(3),
  contractVersionId: z.string().min(3),
  party: supportPartySchema,
  supportType: codebtorSupportTypeSchema,
  storagePath: z.string().min(10).max(512),
  contentType: codebtorSupportContentTypeSchema,
  sizeBytes: z.number().int().positive().max(CODEBTOR_SUPPORT_MAX_BYTES),
  originalFilename: z.string().min(1).max(200),
});

export const deleteSupportRequestSchema = z.object({
  contractId: z.string().min(3),
  contractVersionId: z.string().min(3),
  party: supportPartySchema,
  supportId: z.string().min(3),
});

export function safeSupportFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-áéíóúÁÉÍÓÚñÑ]+/g, "_").replace(/_+/g, "_").slice(0, 120) || "archivo";
}
