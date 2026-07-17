import { sendWhatsApp, isWhatsAppConfigured } from "@/services/whatsapp/sendWhatsApp";
import { isWhatsAppComplementEnabled, resolveWhatsAppTemplate } from "@/domain/notifications/channelPolicy";

/**
 * Envía un aviso al CELULAR como **complemento por WhatsApp** (el correo es la
 * base y lo manda cada bloque por su cuenta). Solo hace algo si el interruptor
 * maestro `NOTIFICATIONS_WHATSAPP_ENABLED` está encendido Y hay credenciales de
 * WhatsApp; de lo contrario no envía nada (queda solo el correo).
 *
 * Un único punto para toda la app: prender/apagar WhatsApp en TODOS los bloques
 * (pagos, mora, reputación, mantenimiento, novedades, renovación) con una sola
 * variable de entorno. Best-effort: nunca lanza.
 */
export async function sendPhoneNotice(params: {
  to: string | undefined | null;
  message: string;
  templateCode: string;
  relatedEntityType: string;
  relatedEntityId: string;
}): Promise<void> {
  const phone = (params.to ?? "").trim();
  if (!phone) return;
  if (!isWhatsAppComplementEnabled() || !isWhatsAppConfigured()) return;

  await sendWhatsApp({
    to: phone,
    templateName: resolveWhatsAppTemplate(params.templateCode),
    bodyParams: [params.message],
    templateCode: params.templateCode,
    relatedEntityType: params.relatedEntityType,
    relatedEntityId: params.relatedEntityId,
  }).catch(() => {});
}
