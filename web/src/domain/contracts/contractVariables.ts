import type { ResidentialLeaseContractInput } from "./types";
import { codebtorSuffix, resolveCodebtors } from "./codebtorBlocks";

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

// Respaldo del art. 12 de la Ley 820 de 2003 cuando la parte no señaló una
// dirección de notificación (datos mínimos). Texto estático y confiable.
const NOTIF_FALLBACK_LANDLORD = "el lugar donde recibe el pago del canon (presunción del art. 12 de la Ley 820 de 2003)";
const NOTIF_FALLBACK_TENANT = "el inmueble arrendado objeto de este contrato (presunción del art. 12 de la Ley 820 de 2003)";

/** Dirección de notificación con respaldo del art. 12 si la parte no la señaló. */
function notifAddress(address: string | null | undefined, fallback: string): string {
  const v = (address ?? "").trim();
  return v ? escapeHtml(v) : fallback;
}

export function buildContractVariables(input: ResidentialLeaseContractInput): ContractVariableMap {
  const notifLandlord = notifAddress(input.landlord.notificationAddress, NOTIF_FALLBACK_LANDLORD);
  const notifTenant = notifAddress(input.tenant.notificationAddress, NOTIF_FALLBACK_TENANT);
  const base: ContractVariableMap = {
    COMPARECENCIA_ARRENDADOR:
      `<strong>${escapeHtml(input.landlord.fullName)}</strong>, mayor de edad, identificado(a) con ` +
      `${escapeHtml(input.landlord.documentType)} No. <strong>${escapeHtml(input.landlord.documentNumber)}</strong>, domiciliado(a) ` +
      `en ${escapeHtml(input.landlord.city)}, con correo electrónico ${escapeHtml(input.landlord.email)}, teléfono ` +
      `${escapeHtml(input.landlord.phone)} y como dirección para notificaciones ${notifLandlord}, ` +
      `quien para efectos del presente contrato se denominará EL ARRENDADOR;`,
    COMPARECENCIA_ARRENDATARIO:
      `<strong>${escapeHtml(input.tenant.fullName)}</strong>, mayor de edad, identificado(a) con ` +
      `${escapeHtml(input.tenant.documentType)} No. <strong>${escapeHtml(input.tenant.documentNumber)}</strong>, domiciliado(a) ` +
      `en ${escapeHtml(input.tenant.city)}, con correo electrónico ${escapeHtml(input.tenant.email)}, teléfono ` +
      `${escapeHtml(input.tenant.phone)} y como dirección para notificaciones ${notifTenant}, ` +
      `quien para efectos del presente contrato se denominará EL ARRENDATARIO;`,
    DIRECCION_INMUEBLE: escapeHtml(input.property.address),
    /** Aclaración legal/orientativa: dirección urbana ≠ certificación catastral; enlace a canal nacional de referencia. */
    NOTA_DIRECCION_URBANA_Y_CATASTRO:
      "Las partes reconocen que la dirección indicada se expresa en nomenclatura urbana habitual y " +
      "no sustituye la certificación ni la verificación catastral o registral del predio. Para identificar el inmueble " +
      "ante terceros y autoridades deberán contrastar la información (incluida la matrícula inmobiliaria, si aplica) " +
      "con los registros oficiales. Como referencia general pueden consultar el sitio del " +
      '<a href="https://www.igac.gov.co/" target="_blank" rel="noopener noreferrer">Instituto Geográfico Agustín Codazzi (IGAC)</a> ' +
      "y las ventanillas catastrales o de registro competentes para el municipio; ArriendoSeguro no sustituye esas consultas.",
    CIUDAD_INMUEBLE: escapeHtml(input.property.city),
    DEPARTAMENTO_INMUEBLE: escapeHtml(input.property.department),
    MATRICULA_INMOBILIARIA: escapeHtml(input.property.registryNumber || "según documento de propiedad adjunto"),
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
    DIRECCION_NOTIFICACION_ARRENDADOR: notifLandlord,
    EMAIL_ARRENDADOR: escapeHtml(input.landlord.email),
    DIRECCION_NOTIFICACION_ARRENDATARIO: notifTenant,
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

  // Uno o varios codeudores: el primero usa claves sin sufijo (compatibilidad),
  // los siguientes `_2`, `_3`, … Aditivo: si no hay codeudores, las claves base
  // quedan vacías como antes.
  resolveCodebtors(input).forEach((c, i) => {
    const s = codebtorSuffix(i);
    base[`NOMBRE_CODEUDOR${s}`] = escapeHtml(c.fullName);
    base[`TIPO_DOCUMENTO_CODEUDOR${s}`] = escapeHtml(c.documentType);
    base[`NUMERO_DOCUMENTO_CODEUDOR${s}`] = escapeHtml(c.documentNumber);
    base[`CIUDAD_CODEUDOR${s}`] = escapeHtml(c.city);
    base[`EMAIL_CODEUDOR${s}`] = escapeHtml(c.email);
    base[`TELEFONO_CODEUDOR${s}`] = escapeHtml(c.phone);
    base[`DIRECCION_NOTIFICACION_CODEUDOR${s}`] = notifAddress(c.notificationAddress, NOTIF_FALLBACK_TENANT);
    base[`DOCUMENTO_CODEUDOR${s}`] = `${escapeHtml(c.documentType)} ${escapeHtml(c.documentNumber)}`;
    base[`FIRMA_CODEUDOR${s}`] = "Pendiente de evento de firma";
    base[`FECHA_FIRMA_CODEUDOR${s}`] = "Pendiente";
  });

  return base;
}

export function injectVariables(template: string, variables: ContractVariableMap): string {
  let html = template;
  for (const [key, value] of Object.entries(variables)) {
    html = html.replaceAll(`[${key}]`, value);
  }
  return html;
}

