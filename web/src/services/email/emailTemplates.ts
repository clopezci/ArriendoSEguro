export type EmailTemplateCode =
  | "inviteCounterpartyEmail"
  | "signatureRequestEmail"
  | "signatureOtpEmail"
  | "paymentReminderEmail"
  | "contractSignedEmail"
  | "plusAccessConfirmedEmail"
  | "surveyThankYouEmail"
  | "expedienteNovedadEmail"
  | "contactMessageEmail"
  | "contactAckEmail"
  | "contractRenewalReminderEmail"
  | "ipcUpdateReminderEmail"
  | "reputationLookupRequestEmail"
  | "errorAlertEmail"
  | "partnerLeadEmail"
  | "partnerLeadAckEmail"
  | "paymentUploadedEmail"
  | "paymentConfirmedToTenantEmail"
  | "tenantPaymentReminderEmail"
  | "ownerConfirmEscalationEmail"
  | "specialClauseReviewEmail"
  | "specialClauseResolvedOwner"
  | "initialDeliveryActEmail"
  | "reputationReviewReceivedEmail"
  | "reputationLowRatingEmail"
  | "maintenanceReportedEmail"
  | "maintenanceResponseEmail"
  | "maintenanceDisputeEmail"
  | "contractRenewalDocEmail"
  | "partnerInterestEmail"
  | "customAlertEmail"
  | "paymentEscalationEmail";

export type CompiledEmailTemplate = {
  subject: string;
  html: string;
  text: string;
};

function appBaseUrl() {
  return process.env.APP_BASE_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
}

function baseHtml(title: string, body: string) {
  return `
    <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6;">
      <h2 style="margin: 0 0 12px;">${title}</h2>
      ${body}
      <p style="margin-top: 20px; font-size: 12px; color: #475569;">
        Este mensaje fue generado por ArriendoSeguro. Si no reconoces este correo, puedes ignorarlo.
      </p>
    </div>
  `.trim();
}

export function specialClauseReviewEmail(input: {
  contractId: string;
  requesterName: string;
  requesterEmail: string;
  requesterPhone: string;
  clauseText: string;
  priceCop: number;
  reviewUrl: string;
}): CompiledEmailTemplate {
  const priceText = `$${input.priceCop.toLocaleString("es-CO")}`;
  const esc = (s: string) => s.replace(/[<>]/g, (c) => (c === "<" ? "&lt;" : "&gt;"));
  const contactName = input.requesterName.trim() || "(sin nombre)";
  const contactPhone = input.requesterPhone.trim() || "(sin teléfono)";
  const subject = `Revisión de cláusula especial · Expediente ${input.contractId}`;
  const text =
    `Un usuario de ArriendoSeguro solicitó incluir una cláusula especial ("Otra") en el expediente ${input.contractId}, ` +
    `que requiere tu revisión jurídica.\n\n` +
    `DATOS DE CONTACTO DE QUIEN CREÓ EL CONTRATO (contáctalo para pedir más información o confirmar):\n` +
    `  Nombre: ${contactName}\n  Correo: ${input.requesterEmail}\n  Teléfono/WhatsApp: ${contactPhone}\n\n` +
    `Cobro adicional informado al usuario: ${priceText}.\n\n` +
    `Texto de la cláusula propuesta:\n"${input.clauseText}"\n\n` +
    `REGISTRA LA CLÁUSULA FINAL AQUÍ (se incorpora automáticamente al contrato del usuario):\n${input.reviewUrl}\n\n` +
    `Revisa que se ajuste a la normatividad colombiana (Ley 820 de 2003 y demás aplicables).`;
  const html = baseHtml(
    "Solicitud de revisión de cláusula especial",
    `<p>Un usuario de ArriendoSeguro solicitó incluir una cláusula especial («Otra») en el expediente
      <strong>${esc(input.contractId)}</strong>, que requiere tu revisión jurídica.</p>
     <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:12px;margin:12px 0;">
       <p style="margin:0 0 6px;font-weight:bold;">Contacto de quien creó el contrato</p>
       <p style="margin:0;">Nombre: <strong>${esc(contactName)}</strong><br/>
         Correo: <a href="mailto:${esc(input.requesterEmail)}">${esc(input.requesterEmail)}</a><br/>
         Teléfono / WhatsApp: <strong>${esc(contactPhone)}</strong></p>
       <p style="margin:8px 0 0;font-size:12px;color:#475569;">Puedes contactarlo directamente para pedir más
         información o confirmarle que la cláusula se adicionará.</p>
     </div>
     <p>Cobro adicional informado al usuario: <strong>${priceText}</strong>.</p>
     <p style="margin:12px 0 4px;">Texto de la cláusula propuesta:</p>
     <blockquote style="background:#f1f5f9;padding:12px;border-left:4px solid #6d28d9;margin:0;">
       ${esc(input.clauseText).replace(/\n/g, "<br/>")}
     </blockquote>
     <p style="margin:16px 0 8px;">Cuando tengas la <strong>redacción final</strong>, regístrala aquí y se
       incorporará automáticamente al contrato del usuario:</p>
     <p style="margin:0 0 12px;">
       <a href="${esc(input.reviewUrl)}" style="display:inline-block;background:#6d28d9;color:#fff;text-decoration:none;
         padding:10px 18px;border-radius:8px;font-weight:bold;">Registrar cláusula final</a>
     </p>
     <p style="margin-top:12px;font-size:12px;color:#475569;">Revisa que se ajuste a la normatividad colombiana
      (Ley 820 de 2003 y demás aplicables).</p>`,
  );
  return { subject, html, text };
}

export function inviteCounterpartyEmail(input: {
  inviterName: string;
  contractLabel: string;
  invitationUrl: string;
}): CompiledEmailTemplate {
  const subject = "Invitación para continuar tu expediente de arriendo";
  const verifyLine =
    "Importante: revisa que tus datos personales sean correctos. Al firmar deberás confirmarlos bajo gravedad de juramento.";
  const text = `${input.inviterName} te invitó a continuar el expediente "${input.contractLabel}" en ArriendoSeguro.\n\n${verifyLine}\n\nIngresa aquí: ${input.invitationUrl}`;
  const html = baseHtml(
    "Invitación de contraparte",
    `<p>${input.inviterName} te invitó a continuar el expediente <strong>${input.contractLabel}</strong> en ArriendoSeguro.</p>
     <p>${verifyLine}</p>
     <p><a href="${input.invitationUrl}" style="color:#6d28d9;">Abrir invitación</a></p>`,
  );
  return { subject, html, text };
}

export function paymentUploadedEmail(input: {
  periodLabel: string;
  amountText: string;
  confirmUrl: string;
  rejectUrl: string;
  reviewUrl: string;
}): CompiledEmailTemplate {
  const subject = `Tu inquilino subió un soporte de pago (${input.periodLabel})`;
  const text =
    `Tu inquilino registró un pago del periodo ${input.periodLabel} por ${input.amountText} y adjuntó el soporte.\n\n` +
    `Revisa el soporte: ${input.reviewUrl}\n\n` +
    `Cuando lo verifiques, confirma con un clic:\n` +
    `- Sí, recibí el pago: ${input.confirmUrl}\n- No corresponde: ${input.rejectUrl}\n\n` +
    `Hasta que confirmes, el pago queda como pendiente de tu verificación.`;
  const html = baseHtml(
    "Soporte de pago recibido",
    `<p>Tu inquilino registró un pago del periodo <strong>${input.periodLabel}</strong> por <strong>${input.amountText}</strong> y adjuntó el soporte.</p>
     <p><a href="${input.reviewUrl}" style="color:#6d28d9;">Ver el soporte en el registro de pagos</a></p>
     <p>Cuando lo verifiques, confirma con un clic:</p>
     <p>
       <a href="${input.confirmUrl}" style="display:inline-block;background:#16a34a;color:#fff;padding:8px 14px;border-radius:8px;text-decoration:none;margin-right:8px;">Sí, recibí el pago</a>
       <a href="${input.rejectUrl}" style="display:inline-block;background:#e2e8f0;color:#0f172a;padding:8px 14px;border-radius:8px;text-decoration:none;">No corresponde</a>
     </p>
     <p style="font-size:12px;color:#475569;">Hasta que confirmes, el pago queda como pendiente de tu verificación.</p>`,
  );
  return { subject, html, text };
}

export function paymentConfirmedToTenantEmail(input: {
  periodLabel: string;
  confirmed: boolean;
}): CompiledEmailTemplate {
  const subject = input.confirmed
    ? `Tu pago de ${input.periodLabel} fue confirmado`
    : `Tu pago de ${input.periodLabel} necesita revisión`;
  const text = input.confirmed
    ? `El arrendador confirmó la recepción de tu pago del periodo ${input.periodLabel}. ¡Gracias!`
    : `El arrendador indicó que el pago del periodo ${input.periodLabel} no corresponde o necesita revisión. Contáctalo para aclararlo.`;
  const html = baseHtml(input.confirmed ? "Pago confirmado" : "Pago por revisar", `<p>${text}</p>`);
  return { subject, html, text };
}

export function tenantPaymentReminderEmail(input: {
  periodLabel: string;
  dueDate: string;
  amountText: string;
  howToPay: string;
  payUrl: string;
  whenLabel: string;
}): CompiledEmailTemplate {
  const subject = `Recordatorio de pago de tu arriendo (${input.periodLabel})`;
  const text =
    `${input.whenLabel}: el pago del periodo ${input.periodLabel} por ${input.amountText} vence el ${input.dueDate}.\n\n` +
    `Cómo pagar: ${input.howToPay}\n\n` +
    `Cuando pagues, sube tu soporte aquí (sin registrarte): ${input.payUrl}`;
  const html = baseHtml(
    "Recordatorio de pago",
    `<p><strong>${input.whenLabel}:</strong> el pago del periodo <strong>${input.periodLabel}</strong> por <strong>${input.amountText}</strong> vence el <strong>${input.dueDate}</strong>.</p>
     <p>Cómo pagar: ${input.howToPay}</p>
     <p><a href="${input.payUrl}" style="display:inline-block;background:#6d28d9;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;">Pagar y subir mi soporte</a></p>
     <p style="font-size:12px;color:#475569;">ArriendoSeguro no recauda ni custodia el dinero; solo te recuerda y guarda la constancia.</p>`,
  );
  return { subject, html, text };
}

export function ownerConfirmEscalationEmail(input: {
  periodLabel: string;
  reviewUrl: string;
}): CompiledEmailTemplate {
  const subject = `Falta confirmar un pago (${input.periodLabel})`;
  const text =
    `Hay un soporte de pago del periodo ${input.periodLabel} pendiente de confirmación del arrendador.\n\n` +
    `Arrendador: revisa y confirma en ${input.reviewUrl}.\nInquilino: si ya pagaste, espera la confirmación o contacta al arrendador.`;
  const html = baseHtml(
    "Pago pendiente de confirmación",
    `<p>Hay un soporte de pago del periodo <strong>${input.periodLabel}</strong> pendiente de confirmación del arrendador.</p>
     <p><a href="${input.reviewUrl}" style="color:#6d28d9;">Abrir el registro de pagos</a></p>
     <p style="font-size:12px;color:#475569;">Arrendador: revisa y confirma. Inquilino: si ya pagaste, espera la confirmación o contacta al arrendador.</p>`,
  );
  return { subject, html, text };
}

export function partnerLeadEmail(input: {
  partnerName: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  serviceLabel: string;
  message: string;
  takenUrl: string;
  notTakenUrl: string;
}): CompiledEmailTemplate {
  const subject = `Nuevo cliente referido de ArriendoSeguro · ${input.serviceLabel}`;
  const text =
    `Te referimos un cliente desde ArriendoSeguro para ${input.serviceLabel}.\n\n` +
    `Cliente: ${input.clientName}\nCorreo: ${input.clientEmail}\nTeléfono: ${input.clientPhone}\n` +
    `Mensaje: ${input.message}\n\n` +
    `Cuando se resuelva, confírmanos para el control de comisiones:\n` +
    `- Sí tomó el servicio: ${input.takenUrl}\n- No se concretó: ${input.notTakenUrl}`;
  const html = baseHtml(
    `Cliente referido · ${input.partnerName}`,
    `<p>Te referimos un cliente desde <strong>ArriendoSeguro</strong> para <strong>${input.serviceLabel}</strong>.</p>
     <ul style="padding-left:18px;">
       <li><strong>Cliente:</strong> ${input.clientName}</li>
       <li><strong>Correo:</strong> ${input.clientEmail}</li>
       <li><strong>Teléfono:</strong> ${input.clientPhone}</li>
       <li><strong>Mensaje:</strong> ${input.message}</li>
     </ul>
     <p>Cuando se resuelva, confírmanos (control de comisiones):</p>
     <p>
       <a href="${input.takenUrl}" style="display:inline-block;background:#16a34a;color:#fff;padding:8px 14px;border-radius:8px;text-decoration:none;margin-right:8px;">Sí tomó el servicio</a>
       <a href="${input.notTakenUrl}" style="display:inline-block;background:#e2e8f0;color:#0f172a;padding:8px 14px;border-radius:8px;text-decoration:none;">No se concretó</a>
     </p>`,
  );
  return { subject, html, text };
}

export function partnerLeadAckEmail(input: {
  clientName: string;
  partnerName: string;
  serviceLabel: string;
  takenUrl: string;
  notTakenUrl: string;
}): CompiledEmailTemplate {
  const subject = `Te conectamos con ${input.partnerName}`;
  const text =
    `Hola ${input.clientName}, compartimos tus datos con ${input.partnerName} para ${input.serviceLabel}. ` +
    `Ellos te contactarán.\n\n` +
    `Cuando lo resuelvas, ayúdanos confirmando (1 clic):\n` +
    `- Sí tomé el servicio: ${input.takenUrl}\n- No lo tomé: ${input.notTakenUrl}\n\n` +
    `El servicio lo presta y cobra el aliado; ArriendoSeguro solo te conecta.`;
  const html = baseHtml(
    "Te conectamos con un aliado",
    `<p>Hola ${input.clientName}, compartimos tus datos con <strong>${input.partnerName}</strong> para <strong>${input.serviceLabel}</strong>. Ellos te contactarán.</p>
     <p>Cuando lo resuelvas, ayúdanos confirmando (1 clic):</p>
     <p>
       <a href="${input.takenUrl}" style="display:inline-block;background:#16a34a;color:#fff;padding:8px 14px;border-radius:8px;text-decoration:none;margin-right:8px;">Sí tomé el servicio</a>
       <a href="${input.notTakenUrl}" style="display:inline-block;background:#e2e8f0;color:#0f172a;padding:8px 14px;border-radius:8px;text-decoration:none;">No lo tomé</a>
     </p>
     <p style="font-size:12px;color:#475569;">El servicio lo presta y cobra el aliado; ArriendoSeguro solo te conecta.</p>`,
  );
  return { subject, html, text };
}

export function errorAlertEmail(input: {
  windowMinutes: number;
  distinctErrors: number;
  totalOccurrences: number;
  samples: { message: string; count: number; lastSeenAt: string }[];
  adminUrl: string;
}): CompiledEmailTemplate {
  const subject = `⚠️ ${input.distinctErrors} error(es) en ArriendoSeguro (últimos ${input.windowMinutes} min)`;
  const list = input.samples
    .map((s) => `• [${s.count}] ${s.message} (visto ${s.lastSeenAt})`)
    .join("\n");
  const text =
    `Se detectaron ${input.distinctErrors} error(es) distinto(s) (${input.totalOccurrences} ocurrencias) ` +
    `en los últimos ${input.windowMinutes} minutos.\n\n${list}\n\nRevisa el panel: ${input.adminUrl}`;
  const samplesHtml = input.samples
    .map(
      (s) =>
        `<li style="margin-bottom:6px;"><strong>[${s.count}]</strong> ${s.message} <span style="color:#64748b;">(visto ${s.lastSeenAt})</span></li>`,
    )
    .join("");
  const html = baseHtml(
    "Alerta de errores",
    `<p>Se detectaron <strong>${input.distinctErrors}</strong> error(es) distinto(s) (${input.totalOccurrences} ocurrencias) en los últimos <strong>${input.windowMinutes} minutos</strong>.</p>
     <ul style="padding-left:18px;">${samplesHtml}</ul>
     <p><a href="${input.adminUrl}" style="color:#6d28d9;">Abrir el panel de errores</a></p>`,
  );
  return { subject, html, text };
}

export function reputationLookupRequestEmail(input: {
  requesterEmail: string;
  manageUrl: string;
}): CompiledEmailTemplate {
  const subject = "Te solicitaron consultar tu reputación de arriendo";
  const text =
    `${input.requesterEmail} solicitó ver tu reputación agregada (promedio de estrellas) en ArriendoSeguro.\n\n` +
    `Tú decides: puedes autorizar o rechazar la consulta. Solo se compartiría tu promedio y el número de contratos, nunca quién te calificó ni el detalle.\n\n` +
    `Gestiona la solicitud aquí: ${input.manageUrl}`;
  const html = baseHtml(
    "Solicitud para consultar tu reputación",
    `<p><strong>${input.requesterEmail}</strong> solicitó ver tu reputación agregada (promedio de estrellas) en ArriendoSeguro.</p>
     <p>Tú decides: puedes <strong>autorizar o rechazar</strong> la consulta. Solo se compartiría tu promedio y el número de contratos, <strong>nunca</strong> quién te calificó ni el detalle (Habeas Data, Ley 1581 de 2012).</p>
     <p><a href="${input.manageUrl}" style="color:#6d28d9;">Gestionar la solicitud</a></p>`,
  );
  return { subject, html, text };
}

export function signatureRequestEmail(input: {
  signerName: string;
  partyTypeLabel: string;
  signingUrl: string;
  tokenExpiresAt: string;
}): CompiledEmailTemplate {
  const subject = "Solicitud de firma electrónica de contrato";
  const text = `Hola ${input.signerName},\n\nTienes una solicitud de firma electrónica (${input.partyTypeLabel}) en ArriendoSeguro.\nEnlace de firma: ${input.signingUrl}\nVence: ${input.tokenExpiresAt}`;
  const html = baseHtml(
    "Solicitud de firma electrónica",
    `<p>Hola <strong>${input.signerName}</strong>, tienes una solicitud de firma electrónica (${input.partyTypeLabel}) en ArriendoSeguro.</p>
     <p><a href="${input.signingUrl}" style="color:#6d28d9;">Firmar contrato</a></p>
     <p>Este enlace vence el <strong>${input.tokenExpiresAt}</strong>.</p>`,
  );
  return { subject, html, text };
}

export function signatureOtpEmail(input: {
  signerName: string;
  code: string;
  minutesValid: number;
}): CompiledEmailTemplate {
  const subject = "Código de verificación para firmar tu contrato";
  const text = `Hola ${input.signerName},\n\nTu código de verificación en ArriendoSeguro es: ${input.code}\n\nVálido por ${input.minutesValid} minutos. Si no solicitaste firmar, ignora este mensaje.\n\nConsejo: si no ves este correo en tu bandeja de entrada, revisa las carpetas de spam / correo no deseado o promociones.`;
  const html = baseHtml(
    "Código de verificación",
    `<p>Hola <strong>${input.signerName}</strong>,</p>
     <p>Tu código para continuar con la firma electrónica es:</p>
     <p style="font-size:28px;letter-spacing:6px;font-weight:bold;color:#5b21b6;">${input.code}</p>
     <p>Válido por <strong>${input.minutesValid} minutos</strong>.</p>
     <p style="font-size:13px;color:#64748b;">¿No ves nuestros correos? Revisa la carpeta de <strong>spam / correo no deseado</strong> o promociones y marca este mensaje como "No es spam" para recibir los siguientes.</p>
     <p style="font-size:13px;color:#64748b;">Si no solicitaste este código, puedes ignorar el mensaje.</p>`,
  );
  return { subject, html, text };
}

export function paymentReminderEmail(input: {
  periodLabel: string;
  dueDate: string;
  expectedAmount: number;
}): CompiledEmailTemplate {
  const amount = input.expectedAmount.toLocaleString("es-CO");
  const subject = `Recordatorio de pago de arriendo - ${input.periodLabel}`;
  const text = `Recordatorio de pago\n\nPeriodo: ${input.periodLabel}\nVence: ${input.dueDate}\nValor esperado: $${amount}\n\nLa plataforma no recauda dinero; el pago se realiza por el medio acordado entre las partes.`;
  const html = baseHtml(
    "Recordatorio de pago",
    `<p>Te recordamos el pago de arriendo del periodo <strong>${input.periodLabel}</strong>.</p>
     <p>Vencimiento: <strong>${input.dueDate}</strong><br/>Valor esperado: <strong>$${amount}</strong></p>
     <p>ArriendoSeguro no recauda dinero; el pago se realiza por el medio acordado entre las partes.</p>`,
  );
  return { subject, html, text };
}

export function contractSignedEmail(input: {
  contractId: string;
  leaseProcessId?: string;
}): CompiledEmailTemplate {
  const base = appBaseUrl();
  const contractUrl = `${base}/dashboard/contracts/${input.leaseProcessId ?? input.contractId}/preview`;
  const subject = "Contrato firmado completamente";
  const text = `El contrato ${input.contractId} ya quedó firmado por todas las partes.\nPuedes revisarlo aquí: ${contractUrl}`;
  const html = baseHtml(
    "Contrato firmado completamente",
    `<p>El contrato <strong>${input.contractId}</strong> ya quedó firmado por todas las partes.</p>
     <p><a href="${contractUrl}" style="color:#6d28d9;">Ver contrato</a></p>`,
  );
  return { subject, html, text };
}

export function plusAccessConfirmedEmail(input: { userEmail: string; source: "payment" | "manual" }): CompiledEmailTemplate {
  const base = appBaseUrl();
  const subject = "Acceso Plan Plus confirmado";
  const sourceText = input.source === "payment" ? "pago aprobado" : "habilitación interna";
  const text = `Hola,\n\nTu acceso Plan Plus fue activado (${sourceText}).\nPuedes comenzar aquí: ${base}/dashboard/plans`;
  const html = baseHtml(
    "Acceso Plan Plus confirmado",
    `<p>Hola <strong>${input.userEmail}</strong>, tu acceso Plan Plus fue activado (${sourceText}).</p>
     <p><a href="${base}/dashboard/plans" style="color:#6d28d9;">Ir a mi plan</a></p>`,
  );
  return { subject, html, text };
}

export function surveyThankYouEmail(): CompiledEmailTemplate {
  const base = appBaseUrl();
  const subject = "Gracias por responder la encuesta";
  const text = `Gracias por responder la encuesta de ArriendoSeguro.\nTus respuestas nos ayudan a priorizar las mejoras del producto.\n\nConoce más: ${base}/entiendelo-facil`;
  const html = baseHtml(
    "Gracias por tu respuesta",
    `<p>Gracias por responder la encuesta de ArriendoSeguro.</p>
     <p>Tus respuestas nos ayudan a priorizar las mejoras del producto.</p>
     <p><a href="${base}/entiendelo-facil" style="color:#6d28d9;">Conocer más</a></p>`,
  );
  return { subject, html, text };
}

export function expedienteNovedadEmail(input: {
  authorName: string;
  authorRoleLabel: string;
  tipoLabel: string;
  description: string;
  contractId: string;
  leaseProcessId?: string;
  hasAttachment: boolean;
}): CompiledEmailTemplate {
  const base = appBaseUrl();
  const dashId = input.leaseProcessId ?? input.contractId;
  const link = `${base}/dashboard/contracts/${dashId}/novedades`;
  const subject = `Novedad en el expediente de arriendo: ${input.tipoLabel}`;
  const desc = input.description.trim() || "(Sin texto adicional.)";
  const att = input.hasAttachment ? "\nSe adjuntó un archivo en el expediente (revísalo en la plataforma)." : "";
  const text = `Hola,\n\n${input.authorName} (${input.authorRoleLabel}) registró una novedad: ${input.tipoLabel}.\n\nDetalle:\n${desc}${att}\n\nVer expediente: ${link}`;
  const esc = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  const safeDesc =
    desc.length > 4000 ? `${esc(desc.slice(0, 4000))}…` : esc(desc).replace(/\n/g, "<br/>");
  const html = baseHtml(
    "Novedad en tu expediente de arriendo",
    `<p><strong>${input.authorName}</strong> (${input.authorRoleLabel}) registró una novedad en el expediente.</p>
     <p><strong>Tipo:</strong> ${input.tipoLabel}</p>
     <p><strong>Detalle:</strong><br/>${safeDesc}</p>
     ${input.hasAttachment ? "<p><em>Hay un archivo adjunto; ábrelo desde el enlace del expediente.</em></p>" : ""}
     <p><a href="${link}" style="color:#6d28d9;">Abrir novedades del expediente</a></p>
     <p style="font-size:12px;color:#64748b;">ArriendoSeguro organiza comunicaciones entre partes; no sustituye asesoría legal ni mediación.</p>`,
  );
  return { subject, html, text };
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Mensaje del formulario de contacto, dirigido al buzón interno
 * (`CONTACT_INBOX_EMAIL`). Incluye los datos de quien escribe para responderle.
 */
export function contactMessageEmail(input: {
  name: string;
  fromEmail: string;
  phone?: string;
  topic: string;
  message: string;
}): CompiledEmailTemplate {
  const subject = `Contacto web: ${input.topic} — ${input.name}`;
  const phoneLine = input.phone ? `\nTeléfono: ${input.phone}` : "";
  const text = `Nuevo mensaje desde el formulario de contacto de ArriendoSeguro.\n\nNombre: ${input.name}\nCorreo: ${input.fromEmail}${phoneLine}\nTema: ${input.topic}\n\nMensaje:\n${input.message}`;
  const safeMsg =
    input.message.length > 6000
      ? `${escapeHtml(input.message.slice(0, 6000))}…`
      : escapeHtml(input.message).replace(/\n/g, "<br/>");
  const html = baseHtml(
    "Nuevo mensaje de contacto",
    `<p><strong>Nombre:</strong> ${escapeHtml(input.name)}</p>
     <p><strong>Correo:</strong> ${escapeHtml(input.fromEmail)}</p>
     ${input.phone ? `<p><strong>Teléfono:</strong> ${escapeHtml(input.phone)}</p>` : ""}
     <p><strong>Tema:</strong> ${escapeHtml(input.topic)}</p>
     <p><strong>Mensaje:</strong><br/>${safeMsg}</p>`,
  );
  return { subject, html, text };
}

/**
 * Recordatorio de terminación/renovación del contrato. Se envía con suficiente
 * antelación al preaviso legal de 3 meses (Ley 820 de 2003, vivienda urbana).
 */
export function contractRenewalReminderEmail(input: {
  recipientName: string;
  endDate: string;
  daysUntilEnd: number;
  contractId: string;
  leaseProcessId?: string;
}): CompiledEmailTemplate {
  const base = appBaseUrl();
  const dashId = input.leaseProcessId ?? input.contractId;
  const renewLink = `${base}/dashboard/contracts/${dashId}/renovar`;
  const manageLink = `${base}/dashboard/contracts/${dashId}/gestion`;
  const subject = `Tu contrato de arriendo vence el ${input.endDate}: decide renovación o terminación`;
  const text = `Hola ${input.recipientName},\n\nTu contrato de arriendo termina el ${input.endDate} (en aproximadamente ${input.daysUntilEnd} días).\n\nSi vas a seguir con el mismo inquilino, puedes RENOVARLO con un clic (generamos el otrosí de prórroga con el reajuste del IPC): ${renewLink}\n\nSi lo vas a terminar, recuerda el preaviso de al menos 3 meses (Ley 820 de 2003). Gestiona tu arriendo: ${manageLink}\n\nArriendoSeguro no decide por ti; solo te recordamos a tiempo.`;
  const html = baseHtml(
    "Recordatorio: vencimiento de tu contrato de arriendo",
    `<p>Hola <strong>${escapeHtml(input.recipientName)}</strong>,</p>
     <p>Tu contrato de arriendo termina el <strong>${escapeHtml(input.endDate)}</strong> (en aproximadamente <strong>${input.daysUntilEnd} días</strong>).</p>
     <p>Si vas a seguir con el mismo inquilino, puedes <strong>renovarlo con un clic</strong>: generamos el otrosí de prórroga con el reajuste del IPC y lo enviamos a todas las partes.</p>
     <p><a href="${renewLink}" style="display:inline-block;background:#059669;color:#ffffff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600;">Renovar contrato</a></p>
     <p>Si lo vas a terminar, recuerda el <strong>preaviso de al menos 3 meses</strong> (Ley 820 de 2003, vivienda urbana). <a href="${manageLink}" style="color:#6d28d9;">Gestionar mi arriendo</a>.</p>
     <p style="font-size:12px;color:#64748b;">ArriendoSeguro solo te recuerda a tiempo; no decide ni sustituye asesoría legal.</p>`,
  );
  return { subject, html, text };
}

/**
 * Recordatorio anual (2ª semana de enero) para que el administrador actualice
 * el IPC del año anterior en el panel. Se deja de enviar cuando confirma.
 */
export function ipcUpdateReminderEmail(input: { currentIpcPercent: number; currentIpcYear: number; year: number }): CompiledEmailTemplate {
  const base = appBaseUrl();
  const subject = `Actualiza el IPC del arriendo en ArriendoSeguro (${input.year})`;
  const text = `Hola,\n\nEs momento de actualizar el IPC del año anterior que usa la app para el reajuste del canon.\nValor actual configurado: ${input.currentIpcPercent}% (IPC ${input.currentIpcYear}).\n\nEntra al panel administrativo, verifica la cifra oficial del DANE y guarda/confirma para dejar de recibir este recordatorio: ${base}/admin`;
  const html = baseHtml(
    "Actualiza el IPC del año",
    `<p>Es momento de actualizar el <strong>IPC del año anterior</strong> que usa la app para el reajuste del canon (Ley 820, art. 20).</p>
     <p>Valor actual configurado: <strong>${input.currentIpcPercent}%</strong> (IPC ${input.currentIpcYear}).</p>
     <p>Entra al <a href="${base}/admin" style="color:#6d28d9;">panel administrativo</a>, verifica la cifra oficial del DANE y <strong>guarda o confirma</strong> para dejar de recibir este recordatorio.</p>`,
  );
  return { subject, html, text };
}

/** Acuse de recibo para quien envió el formulario de contacto. */
export function contactAckEmail(input: { name: string }): CompiledEmailTemplate {
  const base = appBaseUrl();
  const subject = "Recibimos tu mensaje — ArriendoSeguro";
  const text = `Hola ${input.name},\n\nRecibimos tu mensaje y te responderemos lo antes posible al correo desde el que escribiste.\n\nMientras tanto, puedes conocer más en ${base}/entiendelo-facil\n\nEquipo ArriendoSeguro`;
  const html = baseHtml(
    "Recibimos tu mensaje",
    `<p>Hola <strong>${escapeHtml(input.name)}</strong>,</p>
     <p>Recibimos tu mensaje y te responderemos lo antes posible al correo desde el que escribiste.</p>
     <p>Mientras tanto, puedes <a href="${base}/entiendelo-facil" style="color:#6d28d9;">conocer más sobre ArriendoSeguro</a>.</p>
     <p>Equipo ArriendoSeguro</p>`,
  );
  return { subject, html, text };
}

