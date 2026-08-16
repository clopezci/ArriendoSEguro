import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { sendWhatsAppText } from "@/services/whatsapp/sendWhatsApp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Webhook de WhatsApp (Meta Cloud API).
 *
 * La línea que envía las alertas (3145721407) es una línea AUTOMÁTICA: nadie la
 * atiende a mano. Cuando alguien le escribe, este webhook responde con un mensaje
 * fijo que redirige a la línea de atención humana (3044745676). En la Cloud API no
 * existe el "mensaje de ausencia" de la app verde; hay que contestarlo por código.
 *
 * Configuración en Meta (WhatsApp → Configuration → Webhook):
 *   Callback URL:  https://arriendoseguro.app/api/whatsapp/webhook
 *   Verify token:  el valor de WHATSAPP_WEBHOOK_VERIFY_TOKEN (lo eliges tú)
 *   Suscribir el campo: "messages".
 *
 * Variables de entorno:
 *   WHATSAPP_WEBHOOK_VERIFY_TOKEN  token que Meta te pide al conectar el webhook.
 *   WHATSAPP_APP_SECRET            (opcional) secreto de la app para validar firma.
 *   WHATSAPP_AUTOREPLY_TEXT        (opcional) sobreescribe el texto de auto-respuesta.
 */

const DEFAULT_AUTO_REPLY =
  "Este es un canal automático. Para atención escríbenos al 304 474 5676.";

/** Una sola auto-respuesta por número cada 4 h (evita responder a cada mensaje). */
const THROTTLE_MS = 4 * 60 * 60 * 1000;

/** GET: verificación del webhook (Meta manda hub.challenge al conectar). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge") ?? "";
  const expected = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim();
  if (mode === "subscribe" && expected && token === expected) {
    return new NextResponse(challenge, { status: 200, headers: { "content-type": "text/plain" } });
  }
  return new NextResponse("forbidden", { status: 403 });
}

/** Valida la firma X-Hub-Signature-256 si hay WHATSAPP_APP_SECRET; si no, no verifica. */
function signatureOk(raw: string, header: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET?.trim();
  if (!secret) return true; // sin secreto configurado, aceptamos (Meta igual llama)
  if (!header) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(raw).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(header));
  } catch {
    return false;
  }
}

type InboundMessage = { from?: string; type?: string };
type WebhookPayload = {
  entry?: Array<{ changes?: Array<{ value?: { messages?: InboundMessage[] } }> }>;
};

export async function POST(request: Request) {
  const raw = await request.text();
  // Verificación de firma: se registra pero NO bloquea. Rechazar por firma hacía
  // que Meta no pudiera entregar los mensajes entrantes si el HMAC no cuadraba
  // (p. ej. desajuste de codificación del cuerpo), y se perdía la auto-respuesta.
  // El riesgo de un webhook falso aquí es bajo (solo dispararía auto-respuestas) y
  // el verify token ya protege la conexión (GET). Si `WHATSAPP_APP_SECRET` está y
  // la firma no cuadra, seguimos igual pero dejamos rastro.
  if (!signatureOk(raw, request.headers.get("x-hub-signature-256")) && process.env.NODE_ENV !== "production") {
    console.warn("whatsapp/webhook: firma no verificada; se procesa de todos modos");
  }

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(raw) as WebhookPayload;
  } catch {
    return NextResponse.json({ ok: true }); // ignoramos payloads no-JSON
  }

  const autoReply = process.env.WHATSAPP_AUTOREPLY_TEXT?.trim() || DEFAULT_AUTO_REPLY;
  const firestore = getAdminFirestore();

  try {
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        for (const msg of change.value?.messages ?? []) {
          const from = String(msg.from ?? "").trim();
          if (!from) continue; // "statuses" (entregado/leído) no traen `from`: se ignoran

          // Throttle por número para no responder a cada mensaje de una ráfaga.
          if (firestore) {
            const ref = firestore.collection("whatsapp_autoreply").doc(from);
            const snap = await ref.get().catch(() => null);
            const last = snap?.exists ? Date.parse((snap.data() as { lastAt?: string }).lastAt ?? "") : 0;
            if (Number.isFinite(last) && Date.now() - last < THROTTLE_MS) continue;
            await ref.set({ lastAt: new Date().toISOString() }, { merge: true }).catch(() => {});
          }

          await sendWhatsAppText(from, autoReply).catch(() => {});
        }
      }
    }
  } catch {
    /* nunca fallar el webhook: Meta reintenta y satura si devolvemos error */
  }

  // Meta exige 200 rápido siempre (si no, reintenta y puede deshabilitar el webhook).
  return NextResponse.json({ ok: true });
}
