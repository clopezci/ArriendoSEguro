"use client";

import type { User } from "firebase/auth";
import { z } from "zod";
import type { ColombianNotificationAddressParts } from "@/domain/colombia/structured-address";
import type {
  ContractType,
  CreditCheckSelection,
  NotarizationSelection,
  ResidentialLeaseContractInput,
  SpecialClausesSelection,
} from "@/domain/contracts/types";
import type { PartyDraft } from "@/features/contracts/draft-types";
import type { UtilityServicesGuarantee } from "@/domain/contracts/utilityGuarantee";

export type { PartyDraft } from "@/features/contracts/draft-types";
import {
  mergePropertyDraftForValidation,
  partyDraftToPersonParty,
  type PropertyDraftWithParts,
} from "@/features/contracts/party-normalize";
import { getDefaultLeaseContractVersion } from "@/domain/contracts/leaseTemplateFlags";

export type AccessStatus = "demo" | "paid" | "free" | "pending_payment" | "expired";
export type ContractFlowStatus =
  | "draft"
  | "data_in_progress"
  | "ready_for_preview"
  | "preview_generated"
  | "version_saved"
  | "ready_for_signature";

export type AuditEventName =
  | "contract_flow_started"
  | "access_granted_demo"
  | "access_blocked_pending_payment"
  | "landlord_data_saved"
  | "tenant_data_saved"
  | "codebtor_option_selected"
  | "codebtor_data_saved"
  | "property_data_saved"
  | "rent_cap_validation_failed"
  | "rent_cap_validation_passed"
  /**
   * El arrendador declaró desconocer el valor comercial del inmueble y aceptó
   * expresamente la responsabilidad de no superar el 1% (Ley 820 de 2003).
   * Queda registrado en el expediente como evidencia.
   */
  | "property_cap_unknown_acknowledged"
  /**
   * El arrendador aceptó bajo juramento que los datos del inmueble son
   * verdaderos y que es propietario o cuenta con poder vigente para
   * arrendarlo. Queda como evidencia mínima hasta que el Bloque 12 habilite
   * la carga del documento de soporte (escritura, certificado de libertad,
   * poder) en Firebase Storage.
   */
  | "property_ownership_oath_accepted"
  | "lease_terms_saved"
  | "utilities_saved"
  | "contract_preview_generated"
  | "contract_draft_saved"
  /**
   * Las partes guardaron anotaciones complementarias del expediente. Estas
   * anotaciones se imprimen al final del contrato como sección
   * "Observaciones y acuerdos complementarios" con disclaimer legal
   * explícito, y quedan auditadas por longitud (sin volcar el contenido al
   * audit log por privacidad).
   */
  | "expediente_notes_updated"
  /**
   * El usuario seleccionó (o confirmó) el tipo de contrato a generar.
   * En la fase actual solo se acepta `VIVIENDA_URBANA`; los demás tipos
   * quedan registrados como intento informativo en
   * `contract_type_unavailable_attempted` sin mover el draft.
   */
  | "contract_type_selected"
  /**
   * El usuario hizo clic en una opción de tipo de contrato que aún no
   * está habilitada. Sirve para medir interés sin afectar el draft.
   */
  | "contract_type_unavailable_attempted"
  /**
   * Las partes guardaron su selección de cláusulas especiales (mascotas,
   * fumadores, parqueadero, teletrabajo, mobiliario, zonas verdes,
   * seguridad u «Otra»). Quedan como datos estructurados; la impresión
   * en el contrato se activa con la plantilla `AS-LEASE-2026.2`
   * (Bloque 11 del plan).
   */
  | "special_clauses_updated"
  /**
   * Las partes marcaron (o desmarcaron) que desean autenticar el contrato
   * ante notaría. La impresión de la cláusula condicional corresponde a la
   * plantilla `AS-LEASE-2026.2` cuando esté activa.
   */
  | "notarization_selection_updated"
  /** Garantía para servicios públicos (Art. 15 Ley 820): aceptada o desactivada. */
  | "utility_guarantee_accepted"
  | "utility_guarantee_disabled"
  /** Recorrido /demo (localStorage); no implica expediente real. */
  | "demo_viewed"
  | "demo_step_opened"
  | "demo_plus_cta_clicked";

export interface AuditEvent {
  event: AuditEventName;
  at: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface CodebtorExtraConsents {
  dataProcessingConsent: boolean;
  electronicSignatureConsent: boolean;
  solidaryObligationAcceptance: boolean;
}

export interface ContractDraft {
  id: string;
  userId: string;
  isDemo: boolean;
  accessStatusSnapshot: AccessStatus;
  hasSolidaryCoDebtor: boolean;
  contractVersion: string;
  /**
   * Tipo de contrato que el usuario seleccionó al iniciar el wizard.
   * En esta fase solo `VIVIENDA_URBANA` está habilitado; los demás se
   * muestran en la UI con etiqueta "próximamente disponible". Campo
   * opcional para compatibilidad con drafts creados antes del Bloque 4.
   * El valor por defecto al crear nuevos drafts es `"VIVIENDA_URBANA"`.
   */
  contractType?: ContractType;
  generatedAt: string;
  status: ContractFlowStatus;
  landlord: PartyDraft;
  tenant: PartyDraft;
  solidaryCoDebtor: PartyDraft;
  codebtorConsents: CodebtorExtraConsents;
  property: Partial<ResidentialLeaseContractInput["property"]> & {
    monthlyRentProposed?: number;
    addressParts?: ColombianNotificationAddressParts | null;
    /**
     * El arrendador declaró que NO conoce el valor comercial del inmueble.
     * En ese escenario ArriendoSeguro no calcula el tope legal del 1%
     * (Ley 820 de 2003) y exige una aceptación expresa en
     * `noCapAcknowledgement`. Opcional por compatibilidad con borradores
     * anteriores a este ajuste de UX.
     */
    commercialValueUnknown?: boolean;
    /**
     * Aceptación expresa del arrendador de la responsabilidad de no superar
     * el 1% del valor comercial real del inmueble como canon mensual,
     * cuando declaró desconocer dicho valor. Sirve como evidencia legal y
     * exime a ArriendoSeguro de responsabilidad sobre ese tope.
     */
    noCapAcknowledgement?: boolean;
    /**
     * Declaración bajo juramento del arrendador. Es obligatoria para
     * avanzar: cubre (i) veracidad de la matrícula y datos del inmueble y
     * (ii) calidad de propietario o apoderado con facultad para arrendar.
     * Se conserva como evidencia en el expediente. Opcional en el tipo
     * para compatibilidad con drafts pre-existentes (el wizard volverá a
     * pedir la aceptación si está sin marcar).
     */
    propertyOwnershipOath?: boolean;
    /**
     * Marca de tiempo (ISO) en la que el arrendador aceptó
     * `propertyOwnershipOath`. Sirve como evidencia mínima hasta tener
     * captura completa de IP/UA en el Bloque 7 (firma reforzada).
     */
    propertyOwnershipOathAt?: string;
  };
  lease: Partial<ResidentialLeaseContractInput["lease"]>;
  utilities: Partial<ResidentialLeaseContractInput["utilities"]>;
  /**
   * Cláusulas especiales seleccionadas por las partes (mascotas,
   * fumadores, parqueadero, etc.) en el paso 9 del wizard. Si la
   * persona marcó la opción "Otra" usa `freeText` para describirla.
   * `costNotified` deja constancia de que el usuario vio el aviso de
   * costo adicional antes de continuar. Campo opcional para
   * compatibilidad con borradores creados antes del Bloque 5.
   * Su contenido se imprime únicamente en la plantilla
   * `AS-LEASE-2026.2` (cláusula condicional), por eso hoy no se
   * propaga al contrato `AS-LEASE-MVP-2026.1` activo.
   */
  specialClauses?: SpecialClausesSelection;
  /**
   * Anotaciones complementarias del expediente (texto libre). Visibles en
   * la app y, además, se imprimen al final del contrato como sección
   * "Observaciones y acuerdos complementarios" con disclaimer legal
   * explícito (no sustituyen las cláusulas ni la normatividad aplicable).
   * Campo opcional para compatibilidad con borradores creados antes del
   * Bloque 3 del plan de mejoras.
   */
  expedienteNotes?: string;
  /**
   * Preferencia (no legal) de recibir recordatorios de terminación/renovación
   * del contrato por correo y SMS. Por defecto activado; se persiste en el doc
   * `contracts` al guardar versión. No forma parte del contrato ni del hash.
   */
  renewalReminderEnabled?: boolean;
  /**
   * Garantía para servicios públicos (Art. 15 Ley 820 de 2003). Opcional; se
   * captura en el paso de Servicios con aceptación y registro de IP en servidor.
   */
  utilityServicesGuarantee?: UtilityServicesGuarantee;
  /**
   * Intención de autenticación notarial (Bloque 9). El PDF autenticado
   * cargado por las partes queda en `contract_annexes` y en
   * `contractPayload.notarization` al completar la subida en servidor.
   */
  notarization?: NotarizationSelection;
  /**
   * Declaración del arrendador (dueño) sobre verificación de historial
   * crediticio fuera de ArriendoSeguro (Bloque 6). Sin adjuntos.
   * Reemplaza el registro previo `creditCheckInterest` de borradores
   * antiguos (se ignora al generar el payload).
   */
  landlordCreditHistoryAttestation?: {
    tenantVerified?: "yes" | "no";
    codebtorVerified?: "yes" | "no";
  };
  lastUpdatedAt: string;
  auditTrail: AuditEvent[];
}

/** Límite defensivo del editor de anotaciones del expediente (UI). */
export const EXPEDIENTE_NOTES_MAX_LENGTH = 2000;

const DRAFTS_KEY = "arriendoseguro.contract.drafts.v1";
const ACCESS_KEY = "arriendoseguro.contract.access.v1";
const AUDIT_KEY = "arriendoseguro.contract.audit.v1";

export {
  landlordSchema,
  tenantSchema,
  codebtorSchema,
} from "@/features/contracts/party-schemas";

/**
 * Esquema del paso “Inmueble a arrendar”.
 *
 * - Mensajes pensados para usuario final colombiano: dicen qué falta y
 *   cómo corregirlo, no la jerga interna de Zod.
 * - `commercialValueUnknown` permite a un arrendador que no conoce el
 *   avalúo seguir adelante, pero exige aceptación explícita
 *   (`noCapAcknowledgement`) de la responsabilidad de no exceder el 1%
 *   (Ley 820 de 2003). En ese caso no validamos el tope porque no hay
 *   referencia.
 */
export const propertySchema = z
  .object({
    address: z
      .string()
      .min(4, "Completa la dirección del inmueble a arrendar."),
    city: z.string().min(2, "Indica la ciudad donde está el inmueble."),
    department: z
      .string()
      .min(2, "Indica el departamento donde está el inmueble."),
    type: z
      .string()
      .min(2, "Indica el tipo de inmueble (apartamento, casa, local, etc.)."),
    registryNumber: z
      .string()
      .min(2, "Indica el número de matrícula o registro del inmueble."),
    commercialValue: z.number().nonnegative().optional(),
    legalRentCap: z.number().nonnegative().optional(),
    monthlyRentProposed: z
      .number()
      .positive("Indica el canon mensual propuesto."),
    commercialValueUnknown: z.boolean().optional().default(false),
    noCapAcknowledgement: z.boolean().optional().default(false),
    // Declaración bajo juramento del arrendador sobre el inmueble. Es
    // obligatoria para avanzar: cubre (i) veracidad de los datos del
    // inmueble (incluida la matrícula) y (ii) calidad de propietario o
    // apoderado con facultad para arrendar. La carga del documento de
    // soporte (escritura, certificado de libertad, poder) se hará en el
    // Bloque 12 con Firebase Storage.
    propertyOwnershipOath: z.literal(true, {
      message:
        "Debes aceptar la declaración bajo juramento: que los datos del inmueble son correctos y que eres propietario o cuentas con poder vigente para arrendarlo.",
    }),
  })
  .superRefine((data, ctx) => {
    if (data.commercialValueUnknown) {
      if (!data.noCapAcknowledgement) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["noCapAcknowledgement"],
          message:
            "Debes aceptar expresamente la responsabilidad de no superar el 1% del valor comercial del inmueble como canon mensual.",
        });
      }
      return;
    }
    if (!data.commercialValue || data.commercialValue <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["commercialValue"],
        message:
          "Indica el valor comercial del inmueble o marca «No conozco el valor comercial».",
      });
      return;
    }
    if (!data.legalRentCap || data.legalRentCap <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["legalRentCap"],
        message: "El sistema no pudo calcular el tope legal. Revisa el valor comercial.",
      });
      return;
    }
    if (data.monthlyRentProposed > data.legalRentCap) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["monthlyRentProposed"],
        message:
          "El canon propuesto supera el 1% del valor comercial (límite legal para vivienda urbana según la Ley 820 de 2003). Ajusta el canon o el valor comercial.",
      });
    }
  });

/**
 * Esquema del paso “Términos del arriendo”. Todos los mensajes están en
 * español para el usuario final.
 */
export const termsSchema = z.object({
  monthlyRent: z.number().positive("Indica el canon mensual del arriendo."),
  monthlyRentText: z
    .string()
    .min(4, "Escribe el canon mensual en letras (ej. «un millón quinientos mil pesos»)."),
  paymentDueDay: z
    .number({ message: "Indica el día de pago." })
    .int("Indica un día válido (1 a 31).")
    .min(1, "El día de pago debe estar entre 1 y 31.")
    .max(31, "El día de pago debe estar entre 1 y 31."),
  paymentMethod: z.enum(
    ["transferencia bancaria", "efectivo con constancia", "otro medio acordado"],
    { message: "Selecciona un método de pago válido." },
  ),
  startDate: z.string().min(4, "Selecciona la fecha de inicio del contrato."),
  endDate: z.string().min(4, "Selecciona la fecha de finalización del contrato."),
  termMonths: z
    .number({ message: "Indica la duración del contrato en meses." })
    .int("La duración debe ser un número entero de meses.")
    .positive("La duración del contrato debe ser mayor a cero."),
  latePaymentMonthsThreshold: z
    .number({ message: "Indica el umbral de mora." })
    .int("Indica un número entero de meses.")
    .min(1, "El umbral mínimo es de 1 mes de mora."),
});

export const utilitiesSchema = z.object({
  responsibleParty: z.enum(
    ["arrendatario", "arrendador", "compartido"],
    { message: "Selecciona quién paga los servicios públicos." },
  ),
  details: z.string().min(3, "Describe brevemente cómo se pagan los servicios públicos."),
  adminFeesDetails: z
    .string()
    .min(3, "Describe brevemente cómo se manejan los gastos de administración."),
});

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function getUserAccessStatus(userId: string): AccessStatus {
  const map = readJson<Record<string, { status: AccessStatus; demoExpiresAt?: string }>>(
    ACCESS_KEY,
    {},
  );
  const row = map[userId];
  if (!row) return "pending_payment";
  if (row.status === "demo" && row.demoExpiresAt) {
    const expires = new Date(row.demoExpiresAt).getTime();
    if (Number.isFinite(expires) && expires < Date.now()) {
      map[userId] = { status: "expired" };
      writeJson(ACCESS_KEY, map);
      return "expired";
    }
  }
  return row.status;
}

export function setUserAccessStatus(
  userId: string,
  status: AccessStatus,
  demoDays = 5,
): void {
  const map = readJson<Record<string, { status: AccessStatus; demoExpiresAt?: string }>>(
    ACCESS_KEY,
    {},
  );
  const next: { status: AccessStatus; demoExpiresAt?: string } = { status };
  if (status === "demo") {
    const date = new Date();
    date.setDate(date.getDate() + demoDays);
    next.demoExpiresAt = date.toISOString();
  }
  map[userId] = next;
  writeJson(ACCESS_KEY, map);
}

export function logGlobalAudit(
  event: AuditEventName,
  metadata?: AuditEvent["metadata"],
): void {
  const list = readJson<AuditEvent[]>(AUDIT_KEY, []);
  list.unshift({ event, at: new Date().toISOString(), metadata });
  writeJson(AUDIT_KEY, list.slice(0, 500));
}

export function canCreateContract(user: User | null, accessStatus: AccessStatus): {
  allowed: boolean;
  reason?: "not_authenticated" | "pending_payment" | "expired";
} {
  if (!user) return { allowed: false, reason: "not_authenticated" };
  if (accessStatus === "demo" || accessStatus === "paid" || accessStatus === "free") return { allowed: true };
  if (accessStatus === "pending_payment") return { allowed: false, reason: "pending_payment" };
  return { allowed: false, reason: "expired" };
}

export function getAllDrafts(): ContractDraft[] {
  return readJson<ContractDraft[]>(DRAFTS_KEY, []);
}

export function getDraft(id: string): ContractDraft | null {
  return getAllDrafts().find((d) => d.id === id) ?? null;
}

export function saveAllDrafts(drafts: ContractDraft[]): void {
  writeJson(DRAFTS_KEY, drafts);
}

export function appendAudit(
  draft: ContractDraft,
  event: AuditEventName,
  metadata?: AuditEvent["metadata"],
): ContractDraft {
  return {
    ...draft,
    auditTrail: [...draft.auditTrail, { event, at: new Date().toISOString(), metadata }],
    lastUpdatedAt: new Date().toISOString(),
  };
}

export function saveDraft(draft: ContractDraft): ContractDraft {
  const drafts = getAllDrafts();
  const i = drafts.findIndex((d) => d.id === draft.id);
  if (i >= 0) drafts[i] = draft;
  else drafts.unshift(draft);
  saveAllDrafts(drafts);
  return draft;
}

function createId(): string {
  return `ct_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createContractDraft(input: {
  userId: string;
  accessStatus: AccessStatus;
  isDemo: boolean;
}): ContractDraft {
  const now = new Date().toISOString();
  const draft: ContractDraft = {
    id: createId(),
    userId: input.userId,
    accessStatusSnapshot: input.accessStatus,
    isDemo: input.isDemo,
    hasSolidaryCoDebtor: false,
    contractVersion: getDefaultLeaseContractVersion(),
    contractType: "VIVIENDA_URBANA",
    generatedAt: now,
    status: "draft",
    landlord: {},
    tenant: {},
    solidaryCoDebtor: {},
    codebtorConsents: {
      dataProcessingConsent: false,
      electronicSignatureConsent: false,
      solidaryObligationAcceptance: false,
    },
    property: {},
    lease: { latePaymentMonthsThreshold: 2, paymentMethod: "transferencia bancaria" },
    utilities: {},
    expedienteNotes: "",
    renewalReminderEnabled: true,
    lastUpdatedAt: now,
    auditTrail: [{ event: "contract_flow_started", at: now }],
  };
  return saveDraft(draft);
}

/**
 * Marca el tipo de contrato seleccionado en el draft. Solo se acepta
 * `VIVIENDA_URBANA` en esta fase (Bloque 4 del plan); cualquier otro valor
 * queda únicamente como evento de auditoría informativo y NO modifica el
 * draft, para evitar generar contratos con plantillas que aún no existen.
 */
export function setContractType(
  draftId: string,
  type: ContractType,
): ContractDraft | null {
  if (type !== "VIVIENDA_URBANA") {
    const current = getDraft(draftId);
    if (!current) return null;
    return saveDraft(
      appendAudit(current, "contract_type_unavailable_attempted", {
        attemptedType: type,
      }),
    );
  }
  return updateDraft(draftId, (draft) =>
    appendAudit(
      { ...draft, contractType: type },
      "contract_type_selected",
      { type },
    ),
  );
}

/**
 * Guarda la selección de cláusulas especiales del wizard (Bloque 5).
 * Aunque hoy las cláusulas no se imprimen en `AS-LEASE-MVP-2026.1`,
 * dejarlas en el draft permite:
 * - Mostrarlas en el resumen para confirmación.
 * - Activarlas automáticamente cuando se prenda `AS-LEASE-2026.2`.
 * - Cobrarlas como servicio adicional con la trazabilidad correcta.
 *
 * `selected` se normaliza a un array sin duplicados. Si `enabled` es
 * falso, se vacían `selected` y `freeText` para evitar arrastre.
 */
export function setSpecialClauses(
  draftId: string,
  selection: SpecialClausesSelection,
): ContractDraft | null {
  const cleaned: SpecialClausesSelection = selection.enabled
    ? {
        enabled: true,
        selected: Array.from(new Set(selection.selected ?? [])),
        freeText: selection.freeText?.trim() || undefined,
        costNotified: Boolean(selection.costNotified),
      }
    : {
        enabled: false,
        selected: [],
        freeText: undefined,
        costNotified: Boolean(selection.costNotified),
      };
  return updateDraft(draftId, (draft) =>
    appendAudit(
      { ...draft, specialClauses: cleaned },
      "special_clauses_updated",
      {
        enabled: cleaned.enabled,
        count: cleaned.selected.length,
        hasFreeText: Boolean(cleaned.freeText),
        costNotified: cleaned.costNotified,
      },
    ),
  );
}

/**
 * Preferencia de autenticación notarial (Bloque 9). El archivo autenticado
 * se registra aparte vía API al subir el PDF.
 */
export function setNotarizationSelection(
  draftId: string,
  wantsNotarization: boolean,
): ContractDraft | null {
  return updateDraft(draftId, (draft) =>
    appendAudit(
      {
        ...draft,
        notarization: { wantsNotarization },
      },
      "notarization_selection_updated",
      { wantsNotarization },
    ),
  );
}

/**
 * Guarda las anotaciones especiales del expediente (texto libre). Recorta
 * según `EXPEDIENTE_NOTES_MAX_LENGTH` y agrega un evento de auditoría con la
 * longitud del texto (sin filtrar el contenido en el audit por privacidad).
 */
export function setExpedienteNotes(
  draftId: string,
  notes: string,
): ContractDraft | null {
  const trimmed = (notes ?? "").slice(0, EXPEDIENTE_NOTES_MAX_LENGTH);
  return updateDraft(draftId, (draft) =>
    appendAudit(
      { ...draft, expedienteNotes: trimmed },
      "expediente_notes_updated",
      { length: trimmed.length },
    ),
  );
}

/**
 * Construye el objeto `creditCheck` del contrato a partir del borrador.
 * Solo incluye `CODEBTOR` en el alcance si hay codeudor solidario.
 */
export function deriveCreditCheckFromDraft(
  draft: ContractDraft,
): CreditCheckSelection | undefined {
  const tenantV = draft.landlordCreditHistoryAttestation?.tenantVerified;
  const codeV = draft.landlordCreditHistoryAttestation?.codebtorVerified;
  const codeEffective =
    draft.hasSolidaryCoDebtor && codeV !== undefined ? codeV : undefined;
  if (tenantV === undefined && codeEffective === undefined) return undefined;
  return {
    wantsCreditCheck: false,
    landlordVerifiedTenantCreditHistory: tenantV,
    landlordVerifiedCodebtorCreditHistory: codeEffective,
  };
}

export function updateDraft(
  draftId: string,
  updater: (draft: ContractDraft) => ContractDraft,
): ContractDraft | null {
  const current = getDraft(draftId);
  if (!current) return null;
  const next = updater({
    ...current,
    lastUpdatedAt: new Date().toISOString(),
  });
  return saveDraft(next);
}

export function toContractInput(draft: ContractDraft): ResidentialLeaseContractInput {
  const mergedProp = mergePropertyDraftForValidation(draft.property as PropertyDraftWithParts);
  return {
    landlord: partyDraftToPersonParty(draft.landlord),
    tenant: partyDraftToPersonParty(draft.tenant),
    solidaryCoDebtor: draft.hasSolidaryCoDebtor
      ? partyDraftToPersonParty(draft.solidaryCoDebtor)
      : undefined,
    property: {
      address: mergedProp.address ?? "",
      city: mergedProp.city ?? "",
      department: mergedProp.department ?? "",
      type: mergedProp.type ?? "",
      registryNumber: mergedProp.registryNumber ?? "",
      commercialValue: Number(mergedProp.commercialValue ?? 0),
      legalRentCap: Number(mergedProp.legalRentCap ?? 0),
      // Propagamos el caso "no conozco el valor comercial" para que el
      // validador final omita la regla del 1% y la generación del HTML
      // sepa que debe insertar el aviso correspondiente.
      commercialValueUnknown: Boolean(draft.property.commercialValueUnknown),
      noCapAcknowledgement: Boolean(draft.property.noCapAcknowledgement),
      // Declaración bajo juramento del arrendador (datos del inmueble
      // correctos + propietario o apoderado). Una sola casilla en la UI
      // cubre las dos verificaciones; aquí se expande al objeto
      // estructurado que el backend persiste como evidencia.
      ownershipDeclaration: draft.property.propertyOwnershipOath
        ? {
            truthfulInfoOath: true,
            ownerOrAuthorized: true,
            acceptedAt: draft.property.propertyOwnershipOathAt,
          }
        : undefined,
    },
    lease: {
      monthlyRent: Number(draft.lease.monthlyRent ?? 0),
      monthlyRentText: draft.lease.monthlyRentText ?? "",
      paymentDueDay: Number(draft.lease.paymentDueDay ?? 1),
      paymentMethod: draft.lease.paymentMethod ?? "transferencia bancaria",
      startDate: draft.lease.startDate ?? "",
      endDate: draft.lease.endDate ?? "",
      termMonths: Number(draft.lease.termMonths ?? 0),
      latePaymentMonthsThreshold: Number(draft.lease.latePaymentMonthsThreshold ?? 2),
    },
    utilities: {
      responsibleParty: draft.utilities.responsibleParty ?? "",
      details: draft.utilities.details ?? "",
      adminFeesDetails: draft.utilities.adminFeesDetails ?? "",
    },
    hasSolidaryCoDebtor: draft.hasSolidaryCoDebtor,
    contractVersion: draft.contractVersion,
    contractType: draft.contractType ?? "VIVIENDA_URBANA",
    // Las cláusulas especiales se propagan al render para que las
    // predefinidas (mascotas, fumadores, parqueadero, etc.) salgan
    // automáticamente en el HTML del contrato sin costo adicional. La
    // opción «Otra» también se imprime con disclaimer y se tarifa aparte.
    specialClauses: draft.specialClauses,
    notarization: draft.notarization,
    // Las anotaciones especiales del expediente sí se imprimen en el
    // contrato como sección complementaria con disclaimer legal explícito,
    // por solicitud del usuario para que queden visibles en el documento
    // junto al resto de observaciones (responsabilidad de las partes
    // sobre el contenido).
    expedienteNotes: draft.expedienteNotes,
    creditCheck: deriveCreditCheckFromDraft(draft),
    // Garantía de servicios públicos (Art. 15): solo se lleva al contrato si
    // está habilitada y aceptada (con constancia de IP en el servidor).
    utilityServicesGuarantee:
      draft.utilityServicesGuarantee?.enabled && draft.utilityServicesGuarantee.acceptedAt
        ? draft.utilityServicesGuarantee
        : undefined,
    generatedAt: draft.generatedAt,
  };
}

