import { getAdminFirestore } from "@/lib/firebase/admin";
import { auditEvent } from "@/features/contracts/audit-server";

/**
 * Servicio de SMS con el mismo patrón que el de email: si hay proveedor
 * configurado por variables de entorno se envía de verdad; si no, queda en
 * modo "mock" (registra y no cobra). Hoy soporta Twilio vía REST (sin SDK);
 * para otro proveedor (p. ej. uno colombiano) basta añadir otra rama.
 *
 * Variables (Twilio):
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER
 * Genérico de control:
 *   SMS_PROVIDER = "twilio" | "mock" (por defecto detecta Twilio o cae a mock)
 */

export type SmsTemplateCode =
  | "expedienteNovedadSms"
  | "renewalReminderSms"
  | "paymentReminderSms"
  | "genericSms";

export type SendSmsInput = {
  to: string;
  body: string;
  templateCode: SmsTemplateCode;
  relatedEntityType?: string;
  relatedEntityId?: string;
};

export type SendSmsOutput = {
  status: "sent" | "failed" | "mock" | "skipped";
  provider: "twilio" | "mock" | "none";
  errorMessage?: string;
};

/**
 * Normaliza a E.164 asumiendo Colombia (+57) cuando llega un número local de
 * 10 dígitos. Si ya viene con `+`, se respeta. Devuelve null si no es usable.
 */
export function normalizeCoPhone(raw: string | null | undefined): string | null {
  const t = (raw ?? "").trim();
  if (!t) return null;
  if (t.startsWith("+")) {
    const digits = t.replace(/[^\d]/g, "");
    return digits.length >= 8 ? `+${digits}` : null;
  }
  const digits = t.replace(/[^\d]/g, "");
  if (digits.length === 10) return `+57${digits}`; // celular colombiano
  if (digits.length === 12 && digits.startsWith("57")) return `+${digits}`;
  return null;
}

function resolveProvider(): "twilio" | "mock" {
  const explicit = process.env.SMS_PROVIDER?.trim().toLowerCase();
  if (explicit === "mock") return "mock";
  if (explicit === "twilio") return "twilio";
  const hasTwilio =
    process.env.TWILIO_ACCOUNT_SID?.trim() &&
    process.env.TWILIO_AUTH_TOKEN?.trim() &&
    process.env.TWILIO_FROM_NUMBER?.trim();
  return hasTwilio ? "twilio" : "mock";
}

async function sendViaTwilio(to: string, body: string): Promise<{ ok: boolean; errorMessage?: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID!.trim();
  const token = process.env.TWILIO_AUTH_TOKEN!.trim();
  const from = process.env.TWILIO_FROM_NUMBER!.trim();
  try {
    const form = new URLSearchParams({ To: to, From: from, Body: body.slice(0, 1000) });
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
      cache: "no-store",
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return { ok: false, errorMessage: `Twilio ${res.status}: ${txt.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, errorMessage: err instanceof Error ? err.message : "Error de red SMS" };
  }
}

async function saveSmsLog(input: {
  to: string;
  templateCode: SmsTemplateCode;
  provider: SendSmsOutput["provider"];
  status: "sent" | "failed" | "mock";
  relatedEntityType?: string;
  relatedEntityId?: string;
  errorMessage?: string;
}) {
  const firestore = getAdminFirestore();
  if (!firestore) return;
  const ref = firestore.collection("sms_logs").doc();
  const now = new Date().toISOString();
  // Enmascara el número en el log (no guardamos el celular completo).
  const masked = input.to.replace(/\d(?=\d{2})/g, "•");
  await ref.set({
    id: ref.id,
    to: masked,
    templateCode: input.templateCode,
    provider: input.provider,
    status: input.status,
    relatedEntityType: input.relatedEntityType ?? null,
    relatedEntityId: input.relatedEntityId ?? null,
    errorMessage: input.errorMessage ?? null,
    createdAt: now,
    sentAt: now,
  });
}

export async function sendSms(input: SendSmsInput): Promise<SendSmsOutput> {
  const to = normalizeCoPhone(input.to);
  if (!to) {
    return { status: "skipped", provider: "none", errorMessage: "Número de celular ausente o inválido." };
  }

  const provider = resolveProvider();
  if (provider === "mock") {
    await saveSmsLog({ ...input, to, provider: "mock", status: "mock" });
    if (process.env.NODE_ENV !== "production") {
      console.info("[sms_mock_sent]", { to: to.slice(0, 5) + "…", templateCode: input.templateCode });
    }
    auditEvent("sms_mock_sent", { templateCode: input.templateCode, relatedEntityId: input.relatedEntityId ?? null });
    return { status: "mock", provider: "mock" };
  }

  const result = await sendViaTwilio(to, input.body);
  await saveSmsLog({
    ...input,
    to,
    provider: "twilio",
    status: result.ok ? "sent" : "failed",
    errorMessage: result.errorMessage,
  });
  return result.ok
    ? { status: "sent", provider: "twilio" }
    : { status: "failed", provider: "twilio", errorMessage: result.errorMessage };
}
