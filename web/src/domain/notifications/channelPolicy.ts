/**
 * Política de canales de notificación.
 *
 * **Base = correo** (siempre se envía, en todos los bloques).
 * **Complemento = WhatsApp**, gobernado por UN interruptor maestro:
 *   `NOTIFICATIONS_WHATSAPP_ENABLED = true`
 *
 * Con el interruptor **apagado** (por defecto), todo sale solo por correo — ideal
 * mientras la plantilla de Meta está en revisión o antes de salir a producción.
 * Con el interruptor **encendido** (y credenciales de WhatsApp puestas), TODOS los
 * avisos al celular salen por WhatsApp usando una plantilla genérica. Así puedes
 * prenderlo para pruebas y apagarlo hasta el día del lanzamiento con una variable.
 */
export function isWhatsAppComplementEnabled(): boolean {
  return process.env.NOTIFICATIONS_WHATSAPP_ENABLED === "true";
}

/**
 * Plantilla de WhatsApp (utility, 1 variable) usada para TODOS los avisos. Se
 * puede fijar una neutral con `WHATSAPP_TEMPLATE_GENERIC`; si no, cae a la de
 * pagos (`WHATSAPP_TEMPLATE_PAYMENT`) o al nombre por defecto.
 */
export function whatsAppGenericTemplate(): string {
  return (
    process.env.WHATSAPP_TEMPLATE_GENERIC?.trim() ||
    process.env.WHATSAPP_TEMPLATE_PAYMENT?.trim() ||
    "recordatorio_pago"
  );
}
