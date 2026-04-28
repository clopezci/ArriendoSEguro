export async function sendPaymentReminderEmail(input: {
  to: string;
  periodLabel: string;
  dueDate: string;
  expectedAmount: number;
  relatedEntityId?: string;
}): Promise<{ status: "sent" | "failed" | "mock" | "skipped"; providerResponse: string }> {
  const { paymentReminderEmail } = await import("@/services/email/emailTemplates");
  const { sendEmail } = await import("@/services/email/sendEmail");
  const template = paymentReminderEmail({
    periodLabel: input.periodLabel,
    dueDate: input.dueDate,
    expectedAmount: input.expectedAmount,
  });
  const result = await sendEmail({
    to: input.to,
    subject: template.subject,
    html: template.html,
    text: template.text,
    templateCode: "paymentReminderEmail",
    relatedEntityType: "scheduled_payment",
    relatedEntityId: input.relatedEntityId,
  });
  return {
    status: result.status,
    providerResponse: result.errorMessage ?? result.provider,
  };
}

