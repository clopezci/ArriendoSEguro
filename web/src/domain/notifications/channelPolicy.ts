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
 * Plantilla de WhatsApp (utility, 1 variable) usada como comodín si no hay una
 * específica por tipo. Fija una neutral con `WHATSAPP_TEMPLATE_GENERIC`.
 */
export function whatsAppGenericTemplate(): string {
  return (
    process.env.WHATSAPP_TEMPLATE_GENERIC?.trim() ||
    process.env.WHATSAPP_TEMPLATE_PAYMENT?.trim() ||
    "recordatorio_pago"
  );
}

/**
 * Resuelve la plantilla de WhatsApp **según el tipo de aviso** (el `templateCode`
 * que envía cada bloque), con **fallback a la genérica/neutra**. Así puedes:
 *  - Arrancar con UNA sola plantilla neutra (`WHATSAPP_TEMPLATE_GENERIC`) para todo.
 *  - Migrar sin tocar código: al definir la env var específica de un tipo, ese
 *    aviso empieza a usar SU plantilla; los demás siguen con la neutra.
 *
 * Env vars por tipo (todas opcionales):
 *   WHATSAPP_TEMPLATE_PAYMENT      recordatorios de pago / mora
 *   WHATSAPP_TEMPLATE_REPUTATION   calificación baja (réplica)
 *   WHATSAPP_TEMPLATE_MAINTENANCE  reparaciones / mantenimiento
 *   WHATSAPP_TEMPLATE_NOVEDAD      novedades del expediente
 *   WHATSAPP_TEMPLATE_RENEWAL      preaviso de vencimiento / renovación
 */
export function resolveWhatsAppTemplate(templateCode: string): string {
  const byType: Record<string, string | undefined> = {
    paymentReminderWa: process.env.WHATSAPP_TEMPLATE_PAYMENT?.trim(),
    reputationLowRatingWa: process.env.WHATSAPP_TEMPLATE_REPUTATION?.trim(),
    maintenanceWa: process.env.WHATSAPP_TEMPLATE_MAINTENANCE?.trim(),
    expedienteNovedadWa: process.env.WHATSAPP_TEMPLATE_NOVEDAD?.trim(),
    renewalReminderWa: process.env.WHATSAPP_TEMPLATE_RENEWAL?.trim(),
  };
  return byType[templateCode] || whatsAppGenericTemplate();
}
