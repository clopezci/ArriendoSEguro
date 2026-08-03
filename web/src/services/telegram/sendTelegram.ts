/**
 * Canal de Telegram para alertas internas (errores, estado del servicio). Es el
 * más simple y económico: SIN plantillas ni aprobaciones (a diferencia de
 * WhatsApp), gratis e instantáneo. Mismo patrón que email/SMS/WhatsApp: si está
 * configurado por variables de entorno, envía de verdad; si no, queda en "mock".
 *
 * Variables (Vercel):
 *   TELEGRAM_BOT_TOKEN   token del bot creado con @BotFather
 *   TELEGRAM_CHAT_ID     id del chat/grupo destino (uno o varios separados por coma)
 *
 * Cómo obtener el chat_id: escribe algo al bot (o agrégalo al grupo) y abre
 * https://api.telegram.org/bot<TOKEN>/getUpdates — el "chat":{"id":...} es el valor.
 */

export type SendTelegramOutput = {
  status: "sent" | "failed" | "mock" | "skipped";
  sent: number;
  errorMessage?: string;
};

/** ¿Está Telegram configurado para enviar de verdad? */
export function isTelegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim() && process.env.TELEGRAM_CHAT_ID?.trim());
}

function chatIds(): string[] {
  return (process.env.TELEGRAM_CHAT_ID ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Envía un mensaje de texto (Markdown) a uno o varios chats. Nunca lanza: en
 * error/no-configurado devuelve un estado, para no romper el flujo que la llama.
 */
export async function sendTelegram(text: string): Promise<SendTelegramOutput> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const ids = chatIds();
  if (!token || ids.length === 0) {
    return { status: "mock", sent: 0 };
  }

  const body = text.slice(0, 4000);
  // Un intento de envío a un chat con el parse_mode dado (o sin ninguno).
  const postOnce = async (chatId: string, parseMode?: "Markdown"): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          chat_id: chatId,
          text: body,
          ...(parseMode ? { parse_mode: parseMode } : {}),
          disable_web_page_preview: true,
        }),
      });
      if (res.ok) return { ok: true };
      return { ok: false, error: `Telegram ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}` };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Error de red Telegram" };
    }
  };

  let sent = 0;
  let lastError: string | undefined;
  for (const chatId of ids) {
    // 1) Intento con Markdown (bonito). Si Telegram lo rechaza (típicamente 400
    //    por caracteres especiales en mensajes de error/URLs), 2) reintento en
    //    TEXTO PLANO para que el reporte SIEMPRE llegue aunque el formato falle.
    let r = await postOnce(chatId, "Markdown");
    if (!r.ok) r = await postOnce(chatId);
    if (r.ok) sent += 1;
    else lastError = r.error;
  }

  if (sent > 0) return { status: "sent", sent };
  return { status: "failed", sent: 0, errorMessage: lastError };
}
