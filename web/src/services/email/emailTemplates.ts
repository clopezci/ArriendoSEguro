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
  | "partnerLeadAckEmail";

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
  const link = `${base}/dashboard/contracts/${dashId}/novedades`;
  const subject = `Tu contrato de arriendo vence el ${input.endDate}: decide renovación o terminación`;
  const text = `Hola ${input.recipientName},\n\nTu contrato de arriendo termina el ${input.endDate} (en aproximadamente ${input.daysUntilEnd} días).\n\nRecuerda que para terminarlo debes dar un preaviso de al menos 3 meses (Ley 820 de 2003, vivienda urbana). Si quieres renovarlo o darlo por terminado, conversa con la otra parte y deja constancia.\n\nGestiona tu arriendo: ${link}\n\nArriendoSeguro no decide por ti; solo te recordamos a tiempo.`;
  const html = baseHtml(
    "Recordatorio: vencimiento de tu contrato de arriendo",
    `<p>Hola <strong>${escapeHtml(input.recipientName)}</strong>,</p>
     <p>Tu contrato de arriendo termina el <strong>${escapeHtml(input.endDate)}</strong> (en aproximadamente <strong>${input.daysUntilEnd} días</strong>).</p>
     <p>Recuerda que para terminarlo debes dar un <strong>preaviso de al menos 3 meses</strong> (Ley 820 de 2003, vivienda urbana). Si deseas renovar o terminar, acuerda con la otra parte y deja constancia.</p>
     <p><a href="${link}" style="color:#6d28d9;">Gestionar mi arriendo</a></p>
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

