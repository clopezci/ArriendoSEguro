export type EmailTemplateCode =
  | "inviteCounterpartyEmail"
  | "signatureRequestEmail"
  | "signatureOtpEmail"
  | "paymentReminderEmail"
  | "contractSignedEmail"
  | "plusAccessConfirmedEmail"
  | "surveyThankYouEmail";

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

export function inviteCounterpartyEmail(input: {
  inviterName: string;
  contractLabel: string;
  invitationUrl: string;
}): CompiledEmailTemplate {
  const subject = "Invitación para continuar tu expediente de arriendo";
  const text = `${input.inviterName} te invitó a continuar el expediente "${input.contractLabel}" en ArriendoSeguro.\n\nIngresa aquí: ${input.invitationUrl}`;
  const html = baseHtml(
    "Invitación de contraparte",
    `<p>${input.inviterName} te invitó a continuar el expediente <strong>${input.contractLabel}</strong> en ArriendoSeguro.</p>
     <p><a href="${input.invitationUrl}" style="color:#6d28d9;">Abrir invitación</a></p>`,
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
  const text = `Hola ${input.signerName},\n\nTu código de verificación en ArriendoSeguro es: ${input.code}\n\nVálido por ${input.minutesValid} minutos. Si no solicitaste firmar, ignora este mensaje.`;
  const html = baseHtml(
    "Código de verificación",
    `<p>Hola <strong>${input.signerName}</strong>,</p>
     <p>Tu código para continuar con la firma electrónica es:</p>
     <p style="font-size:28px;letter-spacing:6px;font-weight:bold;color:#5b21b6;">${input.code}</p>
     <p>Válido por <strong>${input.minutesValid} minutos</strong>.</p>
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
  const text = `Gracias por responder la encuesta de ArriendoSeguro.\nTus respuestas nos ayudan a priorizar esta fase inicial del producto.\n\nConoce más: ${base}/entiendelo-facil`;
  const html = baseHtml(
    "Gracias por tu respuesta",
    `<p>Gracias por responder la encuesta de ArriendoSeguro.</p>
     <p>Tus respuestas nos ayudan a priorizar esta fase inicial del producto.</p>
     <p><a href="${base}/entiendelo-facil" style="color:#6d28d9;">Conocer más</a></p>`,
  );
  return { subject, html, text };
}

