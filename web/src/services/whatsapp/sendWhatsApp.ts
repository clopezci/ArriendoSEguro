import { getAdminFirestore } from "@/lib/firebase/admin";
import { auditEvent } from "@/features/contracts/audit-server";
import { normalizeCoPhone } from "@/services/sms/sendSms";

/**
 * Servicio de WhatsApp con el MISMO patrón que SMS/email: si hay proveedor
 * configurado por variables de entorno, envía de verdad; si no, queda en "mock"
 * (registra y no cobra). Usa la WhatsApp Business Cloud API de Meta (oficial y
 * la más económica). Para otro proveedor (Twilio WhatsApp) basta otra rama.
 *
 * Variables (Meta Cloud API):
 *   WHATSAPP_CLOUD_TOKEN       token permanente de la app de Meta
 *   WHATSAPP_PHONE_NUMBER_ID   id del número de WhatsApp Business
 *   WHATSAPP_LANG              (opcional) código de idioma de la plantilla, def. "es"
 * Genérico:
 *   WHATSAPP_PROVIDER = "meta" | "mock" (por defecto detecta Meta o cae a mock)
 *
 * Los mensajes que INICIA el negocio deben usar una PLANTILLA aprobada por Meta.
 * `bodyParams` rellena los {{1}}, {{2}}… de la plantilla.
 */
export type SendWhatsAppInput = {
  to: string;
  templateName: string;
  bodyParams?: string[];
  languageCode?: string;
  templateCode: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
};

export type SendWhatsAppOutput = {
  status: "sent" | "failed" | "mock" | "skipped";
  provider: "meta" | "mock" | "none";
  errorMessage?: string;
};

function resolveProvider(): "meta" | "mock" {
  const explicit = process.env.WHATSAPP_PROVIDER?.trim().toLowerCase();
  if (explicit === "mock") return "mock";
  if (explicit === "meta") return "meta";
  const hasMeta = process.env.WHATSAPP_CLOUD_TOKEN?.trim() && process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  return hasMeta ? "meta" : "mock";
}

/** ¿Está WhatsApp configurado para enviar de verdad? (para elegir el canal). */
export function isWhatsAppConfigured(): boolean {
  return resolveProvider() === "meta";
}

/** Meta espera el número con indicativo y SIN "+". */
function toMetaNumber(raw: string | null | undefined): string | null {
  const e164 = normalizeCoPhone(raw);
  return e164 ? e164.replace(/^\+/, "") : null;
}

async function sendViaMeta(to: string, input: SendWhatsAppInput): Promise<{ ok: boolean; errorMessage?: string }> {
  const token = process.env.WHATSAPP_CLOUD_TOKEN!.trim();
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID!.trim();
  const lang = input.languageCode || process.env.WHATSAPP_LANG?.trim() || "es";
  const components = (input.bodyParams && input.bodyParams.length > 0)
    ? [{ type: "body", parameters: input.bodyParams.map((t) => ({ type: "text", text: String(t).slice(0, 900) })) }]
    : [];
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: { name: input.templateName, language: { code: lang }, ...(components.length ? { components } : {}) },
      }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return { ok: false, errorMessage: `Meta ${res.status}: ${txt.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, errorMessage: err instanceof Error ? err.message : "Error de red WhatsApp" };
  }
}

async function saveLog(input: { to: string; templateCode: string; provider: SendWhatsAppOutput["provider"]; status: "sent" | "failed" | "mock"; relatedEntityType?: string; relatedEntityId?: string; errorMessage?: string }) {
  const firestore = getAdminFirestore();
  if (!firestore) return;
  const ref = firestore.collection("whatsapp_logs").doc();
  const now = new Date().toISOString();
  const masked = input.to.replace(/\d(?=\d{2})/g, "•");
  await ref.set({
    id: ref.id, to: masked, templateCode: input.templateCode, provider: input.provider, status: input.status,
    relatedEntityType: input.relatedEntityType ?? null, relatedEntityId: input.relatedEntityId ?? null,
    errorMessage: input.errorMessage ?? null, createdAt: now, sentAt: now,
  });
}

export async function sendWhatsApp(input: SendWhatsAppInput): Promise<SendWhatsAppOutput> {
  const to = toMetaNumber(input.to);
  if (!to) return { status: "skipped", provider: "none", errorMessage: "Número de celular ausente o inválido." };

  const provider = resolveProvider();
  if (provider === "mock") {
    await saveLog({ ...input, to, provider: "mock", status: "mock" });
    auditEvent("whatsapp_mock_sent", { templateCode: input.templateCode, relatedEntityId: input.relatedEntityId ?? null });
    return { status: "mock", provider: "mock" };
  }

  const result = await sendViaMeta(to, input);
  await saveLog({ ...input, to, provider: "meta", status: result.ok ? "sent" : "failed", errorMessage: result.errorMessage });
  return result.ok ? { status: "sent", provider: "meta" } : { status: "failed", provider: "meta", errorMessage: result.errorMessage };
}
