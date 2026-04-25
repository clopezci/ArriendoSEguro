import type { ResidentialLeaseContractInput } from "./types";

export type ContractVariableMap = Record<string, string>;

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function money(value: number): string {
  return new Intl.NumberFormat("es-CO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("es-CO", { year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export function buildContractVariables(input: ResidentialLeaseContractInput): ContractVariableMap {
  const base: ContractVariableMap = {
    COMPARECENCIA_ARRENDADOR:
      `${escapeHtml(input.landlord.fullName)}, mayor de edad, identificado(a) con ` +
      `${escapeHtml(input.landlord.documentType)} No. ${escapeHtml(input.landlord.documentNumber)}, domiciliado(a) ` +
      `en ${escapeHtml(input.landlord.city)}, con correo electrónico ${escapeHtml(input.landlord.email)}, teléfono ` +
      `${escapeHtml(input.landlord.phone)} y dirección de notificación ${escapeHtml(input.landlord.notificationAddress)}, ` +
      `quien para efectos del presente contrato se denominará EL ARRENDADOR;`,
    COMPARECENCIA_ARRENDATARIO:
      `${escapeHtml(input.tenant.fullName)}, mayor de edad, identificado(a) con ` +
      `${escapeHtml(input.tenant.documentType)} No. ${escapeHtml(input.tenant.documentNumber)}, domiciliado(a) ` +
      `en ${escapeHtml(input.tenant.city)}, con correo electrónico ${escapeHtml(input.tenant.email)}, teléfono ` +
      `${escapeHtml(input.tenant.phone)} y dirección de notificación ${escapeHtml(input.tenant.notificationAddress)}, ` +
      `quien para efectos del presente contrato se denominará EL ARRENDATARIO;`,
    DIRECCION_INMUEBLE: escapeHtml(input.property.address),
    CIUDAD_INMUEBLE: escapeHtml(input.property.city),
    DEPARTAMENTO_INMUEBLE: escapeHtml(input.property.department),
    MATRICULA_INMOBILIARIA: escapeHtml(input.property.registryNumber),
    TIPO_INMUEBLE: escapeHtml(input.property.type),
    CANON_MENSUAL: money(input.lease.monthlyRent),
    CANON_MENSUAL_LETRAS: escapeHtml(input.lease.monthlyRentText),
    DIA_PAGO: String(input.lease.paymentDueDay),
    METODO_PAGO: escapeHtml(input.lease.paymentMethod),
    DURACION_MESES: String(input.lease.termMonths),
    FECHA_INICIO: formatDate(input.lease.startDate),
    FECHA_FIN: formatDate(input.lease.endDate),
    RESPONSABLE_SERVICIOS_PUBLICOS: escapeHtml(input.utilities.responsibleParty),
    DETALLE_SERVICIOS_PUBLICOS: escapeHtml(input.utilities.details),
    DETALLE_ADMINISTRACION_EXPENSAS: escapeHtml(input.utilities.adminFeesDetails),
    DIRECCION_NOTIFICACION_ARRENDADOR: escapeHtml(input.landlord.notificationAddress),
    EMAIL_ARRENDADOR: escapeHtml(input.landlord.email),
    DIRECCION_NOTIFICACION_ARRENDATARIO: escapeHtml(input.tenant.notificationAddress),
    EMAIL_ARRENDATARIO: escapeHtml(input.tenant.email),
    NUMERO_MESES_MORA: String(input.lease.latePaymentMonthsThreshold),
    NOMBRE_ARRENDADOR: escapeHtml(input.landlord.fullName),
    DOCUMENTO_ARRENDADOR: `${escapeHtml(input.landlord.documentType)} ${escapeHtml(input.landlord.documentNumber)}`,
    FIRMA_ARRENDADOR: "Pendiente de evento de firma",
    FECHA_FIRMA_ARRENDADOR: "Pendiente",
    NOMBRE_ARRENDATARIO: escapeHtml(input.tenant.fullName),
    DOCUMENTO_ARRENDATARIO: `${escapeHtml(input.tenant.documentType)} ${escapeHtml(input.tenant.documentNumber)}`,
    FIRMA_ARRENDATARIO: "Pendiente de evento de firma",
    FECHA_FIRMA_ARRENDATARIO: "Pendiente",
    NOMBRE_CODEUDOR: "",
    TIPO_DOCUMENTO_CODEUDOR: "",
    NUMERO_DOCUMENTO_CODEUDOR: "",
    CIUDAD_CODEUDOR: "",
    EMAIL_CODEUDOR: "",
    TELEFONO_CODEUDOR: "",
    DIRECCION_NOTIFICACION_CODEUDOR: "",
    DOCUMENTO_CODEUDOR: "",
    FIRMA_CODEUDOR: "",
    FECHA_FIRMA_CODEUDOR: "",
  };

  if (input.hasSolidaryCoDebtor && input.solidaryCoDebtor) {
    base.NOMBRE_CODEUDOR = escapeHtml(input.solidaryCoDebtor.fullName);
    base.TIPO_DOCUMENTO_CODEUDOR = escapeHtml(input.solidaryCoDebtor.documentType);
    base.NUMERO_DOCUMENTO_CODEUDOR = escapeHtml(input.solidaryCoDebtor.documentNumber);
    base.CIUDAD_CODEUDOR = escapeHtml(input.solidaryCoDebtor.city);
    base.EMAIL_CODEUDOR = escapeHtml(input.solidaryCoDebtor.email);
    base.TELEFONO_CODEUDOR = escapeHtml(input.solidaryCoDebtor.phone);
    base.DIRECCION_NOTIFICACION_CODEUDOR = escapeHtml(input.solidaryCoDebtor.notificationAddress);
    base.DOCUMENTO_CODEUDOR =
      `${escapeHtml(input.solidaryCoDebtor.documentType)} ${escapeHtml(input.solidaryCoDebtor.documentNumber)}`;
    base.FIRMA_CODEUDOR = "Pendiente de evento de firma";
    base.FECHA_FIRMA_CODEUDOR = "Pendiente";
  }

  return base;
}

export function injectVariables(template: string, variables: ContractVariableMap): string {
  let html = template;
  for (const [key, value] of Object.entries(variables)) {
    html = html.replaceAll(`[${key}]`, value);
  }
  return html;
}

