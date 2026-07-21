import { NextResponse } from "next/server";
import { requireInternalAdmin } from "@/lib/admin/internal-admin";
import { isTelegramConfigured, sendTelegram } from "@/services/telegram/sendTelegram";

export const runtime = "nodejs";

/**
 * Envía un mensaje de prueba al Telegram configurado, para que el admin verifique
 * la conexión (bot + chat_id) sin esperar a un error real. Solo admin.
 */
export async function POST(request: Request) {
  const auth = await requireInternalAdmin(request);
  if (!auth.ok) return auth.response;

  if (!isTelegramConfigured()) {
    return NextResponse.json({
      success: false,
      configured: false,
      errors: [{ field: "config", message: "Falta TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID en el servidor." }],
    });
  }

  const res = await sendTelegram(
    "✅ *ArriendoSeguro* — prueba de alertas por Telegram. Si ves esto, el canal quedó conectado.",
  );

  if (res.status === "sent") {
    return NextResponse.json({ success: true, configured: true, sent: res.sent });
  }
  return NextResponse.json({
    success: false,
    configured: true,
    errors: [{ field: "telegram", message: res.errorMessage ?? "No se pudo enviar a Telegram." }],
  });
}
