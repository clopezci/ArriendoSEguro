import { z } from "zod";
import { validateDocumentNumber } from "@/domain/colombia/document-validation";
import { fullNameError } from "@/domain/contracts/personName";
import type { DocumentType, PersonParty, ResidentialLeaseContractInput, ValidationIssue, ValidationResult } from "./types";

function isBlank(value: unknown): boolean {
  return typeof value !== "string" || value.trim() === "";
}

const emailSchema = z.string().email();

/** Normaliza el tipo de documento a los valores que entiende el validador. */
function toDocType(t: string): DocumentType {
  const up = (t || "").trim();
  if (up === "Pasaporte") return "PASAPORTE" as DocumentType;
  if (up === "TI") return "CC" as DocumentType;
  return up as DocumentType;
}

/**
 * Validación de una parte. Además de exigir presencia, comprueba el FORMATO
 * (nombre+apellido, documento colombiano, correo, teléfono de 10 dígitos) con
 * las MISMAS reglas del cliente. Corre en el servidor, así que no se puede
 * burlar mandando un request manipulado directamente.
 */
function validateParty(prefix: string, party: PersonParty, issues: ValidationIssue[]) {
  if (isBlank(party.fullName)) {
    issues.push({ field: `${prefix}.fullName`, message: "Nombre completo requerido." });
  } else {
    const nameErr = fullNameError(party.fullName);
    if (nameErr) issues.push({ field: `${prefix}.fullName`, message: nameErr });
  }
  if (isBlank(party.documentType)) {
    issues.push({ field: `${prefix}.documentType`, message: "Tipo de documento requerido." });
  }
  if (isBlank(party.documentNumber)) {
    issues.push({ field: `${prefix}.documentNumber`, message: "Número de documento requerido." });
  } else if (!isBlank(party.documentType)) {
    const dr = validateDocumentNumber(toDocType(String(party.documentType)), String(party.documentNumber));
    if (!dr.ok) issues.push({ field: `${prefix}.documentNumber`, message: dr.message });
  }
  if (isBlank(party.city)) issues.push({ field: `${prefix}.city`, message: "Ciudad requerida." });
  if (isBlank(party.email)) {
    issues.push({ field: `${prefix}.email`, message: "Correo requerido." });
  } else if (!emailSchema.safeParse(String(party.email).trim()).success) {
    issues.push({ field: `${prefix}.email`, message: "Correo electrónico inválido." });
  }
  if (isBlank(party.phone)) {
    issues.push({ field: `${prefix}.phone`, message: "Teléfono requerido." });
  } else if (!/^\d{10}$/.test(String(party.phone).replace(/\D/g, ""))) {
    issues.push({ field: `${prefix}.phone`, message: "El teléfono debe tener 10 dígitos." });
  }
  // La dirección de notificación es OPCIONAL (datos mínimos): si se omite, aplica
  // la presunción del art. 12 de la Ley 820 de 2003 que el contrato deja explícita.
}

/**
 * Detecta que una MISMA persona ocupe dos roles (arrendador/inquilino/codeudor),
 * comparando el número de documento (solo dígitos). Puro y exportado para test.
 */
export function duplicatePartyIssues(
  input: Pick<ResidentialLeaseContractInput, "landlord" | "tenant" | "solidaryCoDebtor" | "solidaryCoDebtors">,
): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const norm = (v: unknown) => String(v ?? "").replace(/\D+/g, "");
  const cods =
    input.solidaryCoDebtors && input.solidaryCoDebtors.length > 0
      ? input.solidaryCoDebtors
      : input.solidaryCoDebtor
        ? [input.solidaryCoDebtor]
        : [];
  const roster: { label: string; field: string; doc: string }[] = [
    { label: "arrendador", field: "landlord.documentNumber", doc: norm(input.landlord?.documentNumber) },
    { label: "inquilino", field: "tenant.documentNumber", doc: norm(input.tenant?.documentNumber) },
    ...cods.map((c, i) => ({
      label: cods.length > 1 ? `codeudor ${i + 1}` : "codeudor",
      field: i === 0 ? "solidaryCoDebtor.documentNumber" : `solidaryCoDebtors[${i}].documentNumber`,
      doc: norm(c?.documentNumber),
    })),
  ];
  for (let a = 0; a < roster.length; a++) {
    for (let b = a + 1; b < roster.length; b++) {
      if (roster[a].doc && roster[a].doc === roster[b].doc) {
        out.push({
          field: roster[b].field,
          message: `El ${roster[a].label} y el ${roster[b].label} no pueden ser la misma persona (tienen el mismo documento).`,
        });
      }
    }
  }
  return out;
}

export function validateContractData(input: ResidentialLeaseContractInput): ValidationResult {
  const issues: ValidationIssue[] = [];

  validateParty("landlord", input.landlord, issues);
  validateParty("tenant", input.tenant, issues);

  // Codeudores: valida la lista completa si viene; si no, el singular (compat).
  if (input.solidaryCoDebtors && input.solidaryCoDebtors.length > 0) {
    input.solidaryCoDebtors.forEach((c, i) => {
      validateParty(i === 0 ? "solidaryCoDebtor" : `solidaryCoDebtors[${i}]`, c, issues);
    });
  } else if (input.hasSolidaryCoDebtor) {
    if (!input.solidaryCoDebtor) {
      issues.push({
        field: "solidaryCoDebtor",
        message: "Si hay codeudor solidario, se deben informar sus datos.",
      });
    } else {
      validateParty("solidaryCoDebtor", input.solidaryCoDebtor, issues);
    }
  }

  // Antifraude / integridad: una MISMA persona no puede ocupar dos roles (el
  // codeudor debe ser OTRA persona distinta del inquilino).
  issues.push(...duplicatePartyIssues(input));

  if (isBlank(input.property.address)) issues.push({ field: "property.address", message: "Dirección del inmueble requerida." });
  if (isBlank(input.property.city)) issues.push({ field: "property.city", message: "Ciudad del inmueble requerida." });
  if (isBlank(input.property.department)) issues.push({ field: "property.department", message: "Departamento requerido." });
  if (isBlank(input.property.type)) issues.push({ field: "property.type", message: "Tipo de inmueble requerido." });
  // La matrícula ya NO es obligatoria: la propiedad se soporta con un documento
  // adjunto (certificado de tradición, servicios públicos o impuesto predial),
  // que el dueño carga en el paso del inmueble. Si viene, se imprime; si no, el
  // contrato remite al documento de soporte adjunto.
  // Si el arrendador declaró desconocer el valor comercial y aceptó la
  // responsabilidad expresa (Ley 820 de 2003), omitimos las validaciones
  // del valor comercial y del tope. La aceptación se conserva como
  // evidencia en el expediente.
  const commercialValueUnknown = input.property.commercialValueUnknown === true;
  if (!commercialValueUnknown) {
    if (!(input.property.commercialValue > 0) || input.property.commercialValue > 100_000_000_000) {
      issues.push({ field: "property.commercialValue", message: "Valor comercial inválido." });
    }
    if (input.property.legalRentCap <= 0) {
      issues.push({ field: "property.legalRentCap", message: "Tope legal de canon inválido." });
    }
  } else if (input.property.noCapAcknowledgement !== true) {
    issues.push({
      field: "property.noCapAcknowledgement",
      message:
        "Marcaste que no conoces el valor comercial pero falta aceptar la declaración de responsabilidad del arrendador.",
    });
  }

  if (!(input.lease.monthlyRent > 0) || input.lease.monthlyRent > 1_000_000_000) {
    issues.push({ field: "lease.monthlyRent", message: "Canon mensual inválido." });
  }
  if (isBlank(input.lease.monthlyRentText)) {
    issues.push({ field: "lease.monthlyRentText", message: "Canon mensual en letras requerido." });
  }
  if (input.lease.paymentDueDay < 1 || input.lease.paymentDueDay > 31) {
    issues.push({ field: "lease.paymentDueDay", message: "Día de pago inválido (1-31)." });
  }
  if (isBlank(input.lease.paymentMethod)) {
    issues.push({ field: "lease.paymentMethod", message: "Método de pago requerido." });
  }
  if (isBlank(input.lease.startDate)) issues.push({ field: "lease.startDate", message: "Fecha de inicio requerida." });
  if (isBlank(input.lease.endDate)) issues.push({ field: "lease.endDate", message: "Fecha de fin requerida." });
  // Fechas reales y coherentes: inicio antes que fin.
  if (!isBlank(input.lease.startDate) && !isBlank(input.lease.endDate)) {
    const start = Date.parse(input.lease.startDate);
    const end = Date.parse(input.lease.endDate);
    if (Number.isNaN(start)) issues.push({ field: "lease.startDate", message: "Fecha de inicio inválida." });
    if (Number.isNaN(end)) issues.push({ field: "lease.endDate", message: "Fecha de fin inválida." });
    if (!Number.isNaN(start) && !Number.isNaN(end) && start >= end) {
      issues.push({ field: "lease.endDate", message: "La fecha de fin debe ser posterior a la de inicio." });
    }
  }
  if (!(input.lease.termMonths > 0) || input.lease.termMonths > 120) {
    issues.push({ field: "lease.termMonths", message: "Duración en meses inválida (1 a 120)." });
  }
  if (input.lease.latePaymentMonthsThreshold <= 0) {
    issues.push({
      field: "lease.latePaymentMonthsThreshold",
      message: "Umbral de meses de mora inválido.",
    });
  }

  if (isBlank(input.utilities.responsibleParty)) {
    issues.push({ field: "utilities.responsibleParty", message: "Debe definirse responsable de servicios públicos." });
  }
  if (isBlank(input.utilities.details)) {
    issues.push({ field: "utilities.details", message: "Debe describirse el detalle de servicios públicos." });
  }
  if (isBlank(input.utilities.adminFeesDetails)) {
    issues.push({ field: "utilities.adminFeesDetails", message: "Debe definirse detalle de administración/expensas." });
  }

  // Tope legal (Ley 820, art. 18): máximo 1% del valor comercial. Se RECALCULA
  // en el servidor a partir del valor comercial declarado; NO se confía en el
  // `legalRentCap` que envíe el cliente (podría manipularse). Solo aplica cuando
  // hay valor comercial declarado (si el arrendador aceptó desconocerlo, se omite
  // y la responsabilidad queda en él, según la declaración firmada).
  if (!commercialValueUnknown && input.property.commercialValue > 0) {
    const cap = Math.round(input.property.commercialValue * 0.01);
    if (input.lease.monthlyRent > cap) {
      issues.push({
        field: "lease.monthlyRent",
        message: "El canon mensual supera el tope legal permitido para este inmueble (1% del valor comercial).",
      });
    }
  }

  if ((input.securityDepositAmount ?? 0) > 0) {
    issues.push({
      field: "securityDepositAmount",
      message: "No se permite depósito en dinero para vivienda urbana en este flujo.",
    });
  }

  // Cláusulas obligatorias de cumplimiento mínimo (fase inicial):
  if (isBlank(input.contractVersion)) {
    issues.push({ field: "contractVersion", message: "Versión de contrato requerida." });
  }
  if (isBlank(input.generatedAt)) {
    issues.push({ field: "generatedAt", message: "Fecha de generación requerida." });
  }

  return { ok: issues.length === 0, issues };
}

