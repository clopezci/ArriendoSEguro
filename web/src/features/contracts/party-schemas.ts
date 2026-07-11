/**
 * Esquemas Zod para personas (arrendador, arrendatario, codeudor) en el asistente de contrato.
 * Los refinamientos validan formato colombiano de documento y teléfono nacional de 10 dígitos.
 */

import { z } from "zod";
import { validateDocumentNumber } from "@/domain/colombia/document-validation";

const DOCUMENT_ENUM = z.enum(["CC", "CE", "PASAPORTE", "NIT", "OTRO"]);

export const zPhoneCo = z.preprocess(
  (v) => String(v ?? "").replace(/\D/g, ""),
  z
    .string()
    .length(10, "Ingresa exactamente 10 dígitos (sin +57 ni espacios).")
    .regex(/^\d{10}$/, "El teléfono solo debe contener números."),
);

export const citySchema = z
  .string()
  .min(2, "Indica la ciudad.")
  .max(60)
  .regex(
    /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s.\-']+$/,
    "Usa solo letras y separadores habituales en el nombre de la ciudad.",
  );

/** Objeto base antes de refinamientos (permite codebtorSchema.extend). */
const partyObjectSchema = z.object({
  fullName: z.string().min(5, "Indica el nombre completo.").max(120),
  documentType: z.preprocess(
    (v) => (String(v) === "TI" ? "CC" : v),
    DOCUMENT_ENUM,
  ),
  documentNumber: z.string().min(1, "Indica el número de documento."),
  city: citySchema,
  email: z.string().email("Correo electrónico inválido."),
  phone: zPhoneCo,
  /**
   * Dirección de notificación OPCIONAL (datos mínimos). Si se omite, aplica la
   * presunción del art. 12 de la Ley 820 de 2003 (al arrendatario y al codeudor
   * se les notifica en el inmueble arrendado; al arrendador donde recibe el
   * canon), que el contrato deja explícita en su cláusula de notificaciones.
   */
  notificationAddress: z.string().max(200).optional().default(""),
  /**
   * Declaración bajo gravedad de juramento. La persona reconoce que la
   * información ingresada es verídica. Se exige aceptar la casilla para
   * permitir avanzar; el `wizard-state` la guarda como
   * `truthfulnessOathAccepted` en el draft con la fecha del audit trail.
   * Marco normativo: artículos 442 y 443 del Código Penal colombiano
   * (falso testimonio / fraude procesal) y normas civiles aplicables.
   */
  truthfulnessOath: z.literal(true, {
    message:
      "Debes aceptar la declaración bajo gravedad de juramento de que la información es verdadera.",
  }),
});

function refineDocument(data: z.infer<typeof partyObjectSchema>, ctx: z.RefinementCtx) {
  const doc = validateDocumentNumber(data.documentType, data.documentNumber);
  if (!doc.ok) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["documentNumber"],
      message: doc.message,
    });
  }
}

function normalizeDocument(data: z.infer<typeof partyObjectSchema>) {
  const doc = validateDocumentNumber(data.documentType, data.documentNumber);
  return doc.ok ? { ...data, documentNumber: doc.normalized } : data;
}

export const landlordSchema = partyObjectSchema
  .superRefine(refineDocument)
  .transform(normalizeDocument);

export const tenantSchema = partyObjectSchema
  .superRefine(refineDocument)
  .transform(normalizeDocument);

export const codebtorSchema = partyObjectSchema
  .extend({
    dataProcessingConsent: z.literal(true),
    electronicSignatureConsent: z.literal(true),
    solidaryObligationAcceptance: z.literal(true),
  })
  .superRefine(refineDocument)
  .transform((data) => {
    const doc = validateDocumentNumber(data.documentType, data.documentNumber);
    return doc.ok ? { ...data, documentNumber: doc.normalized } : data;
  });
