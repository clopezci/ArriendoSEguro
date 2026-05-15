import { getAdminFirestore } from "@/lib/firebase/admin";
import { auditEvent } from "@/features/contracts/audit-server";
import { MockEmailProvider, type EmailProvider } from "@/services/email/emailProvider";
import { ResendProvider } from "@/services/email/resendProvider";
import type { EmailTemplateCode } from "@/services/email/emailTemplates";

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  templateCode: EmailTemplateCode;
  relatedEntityType?: string;
  relatedEntityId?: string;
};

type SendEmailOutput = {
  status: "sent" | "failed" | "mock" | "skipped";
  provider: "resend" | "mock" | "none";
  errorMessage?: string;
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

function resolveFromAddress() {
  return process.env.EMAIL_FROM?.trim() || "ArriendoSeguro <no-reply@arriendoseguro.app>";
}

function resolveProvider(): EmailProvider {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (apiKey) {
    return new ResendProvider({ apiKey, from: resolveFromAddress() });
  }
  return new MockEmailProvider();
}

async function saveEmailLog(input: {
  to: string;
  subject: string;
  templateCode: EmailTemplateCode;
  provider: "resend" | "mock" | "none";
  status: "sent" | "failed" | "mock";
  relatedEntityType?: string;
  relatedEntityId?: string;
  errorMessage?: string;
}) {
  const firestore = getAdminFirestore();
  if (!firestore) return;
  const ref = firestore.collection("email_logs").doc();
  const now = new Date().toISOString();
  await ref.set({
    id: ref.id,
    to: input.to,
    subject: input.subject,
    templateCode: input.templateCode,
    provider: input.provider,
    status: input.status,
    relatedEntityType: input.relatedEntityType ?? null,
    relatedEntityId: input.relatedEntityId ?? null,
    createdAt: now,
    sentAt: now,
    errorMessage: input.errorMessage ?? null,
  });
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailOutput> {
  const to = input.to.trim().toLowerCase();
  if (!to || !emailRegex.test(to)) {
    return { status: "skipped", provider: "none", errorMessage: "Destinatario inválido o ausente." };
  }

  const provider = resolveProvider();
  const result = await provider.send({
    to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });

  if (!result.ok) {
    await saveEmailLog({
      to,
      subject: input.subject,
      templateCode: input.templateCode,
      provider: result.provider,
      status: "failed",
      relatedEntityType: input.relatedEntityType,
      relatedEntityId: input.relatedEntityId,
      errorMessage: result.errorMessage ?? "Error desconocido",
    });
    return { status: "failed", provider: result.provider, errorMessage: result.errorMessage };
  }

  const logStatus = result.provider === "mock" ? "mock" : "sent";
  await saveEmailLog({
    to,
    subject: input.subject,
    templateCode: input.templateCode,
    provider: result.provider,
    status: logStatus,
    relatedEntityType: input.relatedEntityType,
    relatedEntityId: input.relatedEntityId,
  });

  if (result.provider === "mock") {
    auditEvent("email_mock_sent", {
      to,
      templateCode: input.templateCode,
      relatedEntityType: input.relatedEntityType ?? null,
      relatedEntityId: input.relatedEntityId ?? null,
    });
    console.info("[email_mock_sent]", { to, templateCode: input.templateCode, subject: input.subject });
  }

  return { status: logStatus, provider: result.provider };
}

