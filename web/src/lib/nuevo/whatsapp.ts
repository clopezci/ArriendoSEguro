/**
 * Enlace de WhatsApp (wa.me) para enviar mensajes/invitaciones gratis, sin API.
 * El usuario pulsa "Abrir WhatsApp" y se abre el chat con el mensaje pre-armado.
 */

/** Normaliza un celular colombiano a formato internacional para wa.me (57XXXXXXXXXX). */
export function normalizeCoPhone(raw: string): string {
  const digits = (raw || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("57")) return digits;
  // Celulares colombianos: 10 dígitos que empiezan por 3 → anteponer indicativo 57.
  if (digits.length === 10 && digits.startsWith("3")) return `57${digits}`;
  return digits;
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  const p = normalizeCoPhone(phone);
  const text = encodeURIComponent(message);
  return p ? `https://wa.me/${p}?text=${text}` : `https://wa.me/?text=${text}`;
}
