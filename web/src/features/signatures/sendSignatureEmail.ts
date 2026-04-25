export async function sendSignatureEmail(input: {
  to: string;
  signerName: string;
  partyType: string;
  signingUrl: string;
  tokenExpiresAt: string;
}): Promise<{ delivered: boolean; mode: "placeholder" }> {
  // TODO: integrar proveedor real (Resend/SendGrid) cuando esté habilitado.
  if (process.env.NODE_ENV !== "production") {
    console.info("[signature_email_placeholder]", input);
  }
  return { delivered: false, mode: "placeholder" };
}

