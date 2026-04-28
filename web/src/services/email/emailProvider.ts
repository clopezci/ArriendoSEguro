export type EmailProviderName = "resend" | "mock";

export type EmailProviderSendInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type EmailProviderSendResult = {
  ok: boolean;
  provider: EmailProviderName;
  externalId?: string;
  errorMessage?: string;
};

export interface EmailProvider {
  send(input: EmailProviderSendInput): Promise<EmailProviderSendResult>;
}

export class MockEmailProvider implements EmailProvider {
  async send(input: EmailProviderSendInput): Promise<EmailProviderSendResult> {
    console.info("[mock_email_provider]", {
      to: input.to,
      subject: input.subject,
      preview: input.text.slice(0, 180),
    });
    return { ok: true, provider: "mock", externalId: "mock-email-id" };
  }
}

