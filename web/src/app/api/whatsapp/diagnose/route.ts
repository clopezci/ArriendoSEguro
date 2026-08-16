import { NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/security/cron";
import { sendWhatsApp } from "@/services/whatsapp/sendWhatsApp";
import { whatsAppGenericTemplate } from "@/domain/notifications/channelPolicy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Diagnóstico de WhatsApp SALIENTE (Cloud API). Envía una plantilla al número que
 * pases y devuelve el resultado CRUDO de Meta (incluido el errorMessage), para
 * poder depurar sin acceso a logs. Es la MISMA vía que usan las alertas y la firma.
 *
 * Uso (protegido por CRON_SECRET):
 *   curl -i -X POST "https://arriendoseguro.app/api/whatsapp/diagnose?to=+57XXXXXXXXXX" \
 *        -H "Authorization: Bearer TU_CRON_SECRET"
 */
async function handle(request: Request) {
  const gate = requireCronAuth(request);
  if (!gate.ok) return gate.response;

  const to = new URL(request.url).searchParams.get("to")?.trim() || "";
  if (!to) {
    return NextResponse.json({ ok: false, error: "Falta ?to=+57NUMERO (con indicativo)." }, { status: 422 });
  }

  const templateUsed = whatsAppGenericTemplate();
  const lang = process.env.WHATSAPP_LANG?.trim() || "es_CO";
  const result = await sendWhatsApp({
    to,
    templateName: templateUsed,
    languageCode: lang,
    bodyParams: ["prueba de diagnóstico. Si la recibes, el canal automático de WhatsApp funciona."],
    templateCode: "diagnose",
    relatedEntityType: "diagnose",
    relatedEntityId: "diagnose",
  });

  return NextResponse.json({
    ok: result.status === "sent",
    result, // { status, provider, errorMessage? }
    templateUsed,
    lang,
    hint:
      result.status === "sent"
        ? "El envío SALIENTE funciona. Si la auto-respuesta no llega, el problema es la RECEPCIÓN (webhook/suscripción/App Secret)."
        : result.status === "mock"
          ? "Está en modo MOCK: falta NOTIFICATIONS_WHATSAPP_ENABLED=true o las credenciales de WhatsApp."
          : "Falló el envío: revisa el errorMessage de Meta (plantilla/idioma/número/permiso).",
  });
}

export const POST = handle;
export const GET = handle;
