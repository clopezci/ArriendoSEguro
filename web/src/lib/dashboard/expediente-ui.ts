import {
  mergePartyDraftForValidation,
  mergePropertyDraftForValidation,
  type PropertyDraftWithParts,
} from "@/features/contracts/party-normalize";
import {
  codebtorSchema,
  landlordSchema,
  propertySchema,
  tenantSchema,
  termsSchema,
  utilitiesSchema,
  type ContractDraft,
} from "@/features/contracts/wizard-state";

/** Datos del expediente listos para generar/revisar contrato (incluye términos). */
export function isExpedienteCompleto(draft: ContractDraft): boolean {
  const landlord = landlordSchema.safeParse(mergePartyDraftForValidation(draft.landlord));
  const tenant = tenantSchema.safeParse(mergePartyDraftForValidation(draft.tenant));
  const prop = propertySchema.safeParse(
    mergePropertyDraftForValidation({
      ...(draft.property as PropertyDraftWithParts),
      monthlyRentProposed: Number(draft.property.monthlyRentProposed ?? 0),
    }),
  );
  const lease = termsSchema.safeParse(draft.lease);
  const utils = utilitiesSchema.safeParse(draft.utilities);
  let codebtorOk = true;
  if (draft.hasSolidaryCoDebtor) {
    codebtorOk = codebtorSchema.safeParse({
      ...mergePartyDraftForValidation(draft.solidaryCoDebtor),
      ...draft.codebtorConsents,
    }).success;
  }
  return (
    landlord.success && tenant.success && prop.success && lease.success && utils.success && codebtorOk
  );
}

export function tieneTerminosContrato(draft: ContractDraft): boolean {
  return termsSchema.safeParse(draft.lease).success;
}

/** Estado principal legible para listados y paneles. */
export function estadoExpedienteResumen(draft: ContractDraft): string {
  const s = draft.status;
  if (s === "draft") return "Expediente iniciado";
  if (s === "data_in_progress") return "Datos incompletos";
  if (s === "ready_for_preview" || s === "preview_generated") return "Contrato en preparación";
  if (s === "version_saved") return "Contrato listo para firma";
  if (s === "ready_for_signature") return "Firma en proceso";
  return "En curso";
}

export function etiquetaContrato(draft: ContractDraft): string {
  const s = draft.status;
  if (s === "draft" || s === "data_in_progress") return "Pendiente";
  if (s === "ready_for_preview" || s === "preview_generated") return "En preparación";
  if (s === "version_saved") return "Listo para firma";
  if (s === "ready_for_signature") return "En firma";
  return "—";
}

export function etiquetaFirma(draft: ContractDraft): string {
  const s = draft.status;
  if (s === "version_saved") return "Pendiente de iniciar";
  if (s === "ready_for_signature") return "En proceso";
  return "—";
}

export function etiquetaModalidad(draft: ContractDraft): string {
  return draft.hasSolidaryCoDebtor ? "Con codeudor" : "Sin codeudor";
}

export function etiquetaInventario(draft: ContractDraft): string {
  return draft.id ? "Disponible" : "—";
}

export function etiquetaPagos(draft: ContractDraft): string {
  return tieneTerminosContrato(draft) ? "Disponible" : "Pendiente";
}
