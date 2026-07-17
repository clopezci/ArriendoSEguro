import { sendSms, type SmsTemplateCode } from "@/services/sms/sendSms";
import { sendWhatsApp } from "@/services/whatsapp/sendWhatsApp";

/**
 * Envío de una notificación corta al CELULAR por el canal disponible, con el
 * MISMO patrón en toda la app (recordatorios de pago, calificaciones, etc.):
 *
 *  - Si `whatsapp.enabled` y hay una plantilla aprobada → WhatsApp (plantilla de
 *    1 variable = el mensaje). Cada caso de uso pasa SU plantilla aprobada por
 *    Meta (no se reutiliza la de pagos para otros fines).
 *  - En caso contrario → SMS (texto libre, sin plantilla; se antepone la marca).
 *  - Sin proveedor configurado, ambos servicios caen a "mock" (no cobran).
 *
 * Best-effort: nunca lanza; si el envío falla, no rompe el flujo de negocio.
 */
export async function sendPhoneNotice(params: {
  to: string | undefined | null;
  message: string;
  templateCode: string;
  relatedEntityType: string;
  relatedEntityId: string;
  whatsapp?: { enabled: boolean; templateName: string; languageCode?: string };
}): Promise<void> {
  const phone = (params.to ?? "").trim();
  if (!phone) return;

  if (params.whatsapp?.enabled && params.whatsapp.templateName.trim()) {
    await sendWhatsApp({
      to: phone,
      templateName: params.whatsapp.templateName.trim(),
      bodyParams: [params.message],
      languageCode: params.whatsapp.languageCode,
      templateCode: params.templateCode,
      relatedEntityType: params.relatedEntityType,
      relatedEntityId: params.relatedEntityId,
    }).catch(() => {});
    return;
  }

  await sendSms({
    to: phone,
    body: `ArriendoSeguro: ${params.message}`,
    // El canal SMS solo recibe códigos SMS en tiempo de ejecución (rama else).
    templateCode: params.templateCode as SmsTemplateCode,
    relatedEntityType: params.relatedEntityType,
    relatedEntityId: params.relatedEntityId,
  }).catch(() => {});
}
