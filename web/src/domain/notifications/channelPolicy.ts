/**
 * Política de canales de notificación (modo HÍBRIDO por defecto).
 *
 * - **Pagos y vencimientos** (recordatorios + mora): usan su propio conmutador
 *   `PAYMENT_REMINDER_CHANNEL` (WhatsApp si está configurado; si no, SMS). Es
 *   donde llegar al inquilino se traduce en cobrar, así que ahí sí vale el canal
 *   al celular.
 * - **Todo lo demás** (reputación, mantenimiento, novedades): por defecto va
 *   **solo por correo** (gratis). El aviso al celular (SMS/WhatsApp) de estos
 *   bloques queda **apagado** salvo que se active con
 *   `NON_PAYMENT_PHONE_ENABLED=true`. Así el costo de mensajería se concentra en
 *   los pagos y no se dispara con avisos secundarios.
 */
export function isNonPaymentPhoneEnabled(): boolean {
  return process.env.NON_PAYMENT_PHONE_ENABLED === "true";
}
