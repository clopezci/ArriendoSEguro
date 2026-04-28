import { Resend } from "resend";
import type { EmailProvider, EmailProviderSendInput, EmailProviderSendResult } from "@/services/email/emailProvider";

export class ResendProvider implements EmailProvider {
  private readonly client: Resend;
  private readonly from: string;

  constructor(input: { apiKey: string; from: string }) {
    this.client = new Resend(input.apiKey);
    this.from = input.from;
  }

  async send(input: EmailProviderSendInput): Promise<EmailProviderSendResult> {
    try {
      const result = await this.client.emails.send({
        from: this.from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      });

      if (result.error) {
        return { ok: false, provider: "resend", errorMessage: result.error.message };
      }

      return { ok: true, provider: "resend", externalId: result.data?.id };
    } catch (error) {
      return {
        ok: false,
        provider: "resend",
        errorMessage: error instanceof Error ? error.message : "Error desconocido al enviar correo.",
      };
    }
  }
}

