import { NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/security/cron";
import { sendWhatsApp } from "@/services/whatsapp/sendWhatsApp";
import { whatsAppGenericTemplate } from "@/domain/notifications/channelPolicy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GRAPH = "https://graph.facebook.com/v21.0";

/**
 * Diagnóstico/utilidades de WhatsApp Cloud API (protegido por CRON_SECRET).
 *
 * Modos (por query string):
 *   ?to=+57XXXXXXXXXX          → ENVÍA una plantilla de prueba (test saliente).
 *   ?check=subscription        → muestra a qué app(s) está SUSCRITA la WABA (webhooks).
 *   ?action=subscribe          → SUSCRIBE esta app a la WABA (arregla el inbound).
 *
 * La WABA se deduce del WHATSAPP_PHONE_NUMBER_ID; o pásala con &waba=ID.
 */
async function wabaIdFromEnv(token: string): Promise<string | null> {
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  if (!phoneId) return null;
  try {
    const res = await fetch(`${GRAPH}/${phoneId}?fields=whatsapp_business_account`, {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const j = (await res.json()) as { whatsapp_business_account?: { id?: string } };
    return j.whatsapp_business_account?.id ?? null;
  } catch {
    return null;
  }
}

async function handle(request: Request) {
  const gate = requireCronAuth(request);
  if (!gate.ok) return gate.response;

  const url = new URL(request.url);
  const token = process.env.WHATSAPP_CLOUD_TOKEN?.trim() || "";
  if (!token) return NextResponse.json({ ok: false, error: "Falta WHATSAPP_CLOUD_TOKEN." }, { status: 503 });

  // --- Modo: verificar suscripción del webhook (subscribed_apps de la WABA) ---
  if (url.searchParams.get("check") === "subscription") {
    const waba = url.searchParams.get("waba")?.trim() || (await wabaIdFromEnv(token));
    if (!waba) return NextResponse.json({ ok: false, error: "No pude deducir la WABA; pásala con &waba=ID." }, { status: 422 });
    const res = await fetch(`${GRAPH}/${waba}/subscribed_apps`, {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const j = await res.json().catch(() => ({}));
    const apps = (j as { data?: unknown[] }).data ?? [];
    return NextResponse.json({
      ok: res.ok,
      waba,
      subscribedApps: j,
      hint:
        Array.isArray(apps) && apps.length > 0
          ? "La WABA SÍ tiene apps suscritas. Si aún no llega el inbound, revisa que el campo 'messages' esté suscrito en la app."
          : "La WABA NO tiene ninguna app suscrita → por eso no llegan los mensajes entrantes. Corre con ?action=subscribe.",
    });
  }

  // --- Modo: suscribir esta app a la WABA (arregla el inbound) ---
  if (url.searchParams.get("action") === "subscribe") {
    const waba = url.searchParams.get("waba")?.trim() || (await wabaIdFromEnv(token));
    if (!waba) return NextResponse.json({ ok: false, error: "No pude deducir la WABA; pásala con &waba=ID." }, { status: 422 });
    const res = await fetch(`${GRAPH}/${waba}/subscribed_apps`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const j = await res.json().catch(() => ({}));
    return NextResponse.json({
      ok: res.ok,
      waba,
      result: j,
      hint: res.ok
        ? "Listo: la app quedó suscrita a la WABA. Vuelve a escribirle al número; debería llegar la auto-respuesta."
        : "No se pudo suscribir: revisa el error (permisos del token / WABA).",
    });
  }

  // --- Modo por defecto: enviar plantilla de prueba (test SALIENTE) ---
  const to = url.searchParams.get("to")?.trim() || "";
  if (!to) {
    return NextResponse.json({
      ok: false,
      error: "Indica un modo: ?to=+57NUMERO (envío), ?check=subscription, o ?action=subscribe.",
    }, { status: 422 });
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
    result,
    templateUsed,
    lang,
    hint:
      result.status === "sent"
        ? "El envío SALIENTE funciona. Si la auto-respuesta no llega, revisa la suscripción con ?check=subscription."
        : result.status === "mock"
          ? "Está en modo MOCK: falta NOTIFICATIONS_WHATSAPP_ENABLED=true o las credenciales."
          : "Falló el envío: revisa el errorMessage de Meta.",
  });
}

export const POST = handle;
export const GET = handle;
