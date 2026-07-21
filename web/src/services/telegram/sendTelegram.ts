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

  let sent = 0;
  let lastError: string | undefined;
  for (const chatId of ids) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          chat_id: chatId,
          text: text.slice(0, 4000),
          parse_mode: "Markdown",
          disable_web_page_preview: true,
        }),
      });
      if (res.ok) {
        sent += 1;
      } else {
        lastError = `Telegram ${res.status}: ${(await res.text().catch(() => "")).slice(0, 160)}`;
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : "Error de red Telegram";
    }
  }

  if (sent > 0) return { status: "sent", sent };
  return { status: "failed", sent: 0, errorMessage: lastError };
}
