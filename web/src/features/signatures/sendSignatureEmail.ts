export async function sendSignatureEmail(input: {
  to: string;
  signerName: string;
  partyType: string;
  signingUrl: string;
  tokenExpiresAt: string;
  contractId?: string;
  useInviteTemplate?: boolean;
  inviterName?: string;
}): Promise<{ delivered: boolean; mode: "real" | "mock" | "failed" | "skipped" }> {
  const { inviteCounterpartyEmail, signatureRequestEmail } = await import("@/services/email/emailTemplates");
  const { sendEmail } = await import("@/services/email/sendEmail");
  const labelByPartyType: Record<string, string> = {
    landlord: "arrendador",
    tenant: "arrendatario",
    solidaryCoDebtor: "codeudor",
  };
  const template = input.useInviteTemplate
    ? inviteCounterpartyEmail({
        inviterName: input.inviterName ?? "La contraparte",
        contractLabel: `Contrato ${input.contractId ?? ""}`.trim(),
        invitationUrl: input.signingUrl,
      })
    : signatureRequestEmail({
        signerName: input.signerName,
        partyTypeLabel: labelByPartyType[input.partyType] ?? input.partyType,
        signingUrl: input.signingUrl,
        tokenExpiresAt: input.tokenExpiresAt,
      });
  const result = await sendEmail({
    to: input.to,
    subject: template.subject,
    html: template.html,
    text: template.text,
    templateCode: input.useInviteTemplate ? "inviteCounterpartyEmail" : "signatureRequestEmail",
    relatedEntityType: "contract",
    relatedEntityId: input.contractId,
  });
  return {
    delivered: result.status === "sent" || result.status === "mock",
    mode:
      result.status === "sent"
        ? "real"
        : result.status === "mock"
          ? "mock"
          : result.status === "skipped"
            ? "skipped"
            : "failed",
  };
}

