export async function sendPaymentReminderEmail(input: {
  to: string;
  cc?: string;
  subject: string;
  message: string;
}): Promise<{ status: "sent_mock" | "failed"; providerResponse: string }> {
  // TODO: integrar proveedor real de correo.
  if (process.env.NODE_ENV !== "production") {
    console.info("[payment_reminder_mock]", input);
  }
  return { status: "sent_mock", providerResponse: "MVP mock send" };
}

