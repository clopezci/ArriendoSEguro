export type AllowedReporterRole = "landlord" | "tenant" | "solidaryCoDebtor";

export function validatePaymentReporter(input: {
  contractPayload?: {
    landlord?: { email?: string };
    tenant?: { email?: string };
    solidaryCoDebtor?: { email?: string };
  };
  userEmail?: string;
  reportedByRole?: string;
}): { ok: boolean; role?: AllowedReporterRole; errors: Array<{ field: string; message: string }> } {
  const email = (input.userEmail ?? "").trim().toLowerCase();
  const role = input.reportedByRole;
  if (!email || !role) {
    return { ok: false, errors: [{ field: "auth", message: "Usuario y rol del reporte son obligatorios." }] };
  }
  if (role !== "landlord" && role !== "tenant" && role !== "solidaryCoDebtor") {
    return { ok: false, errors: [{ field: "reportedByRole", message: "Rol no permitido para reportar pago." }] };
  }

  const contractPayload = input.contractPayload;
  const roleEmail =
    role === "landlord"
      ? contractPayload?.landlord?.email
      : role === "tenant"
        ? contractPayload?.tenant?.email
        : contractPayload?.solidaryCoDebtor?.email;

  if (!roleEmail || roleEmail.trim().toLowerCase() !== email) {
    return { ok: false, errors: [{ field: "auth", message: "El usuario no está asociado al contrato con ese rol." }] };
  }
  return { ok: true, role, errors: [] };
}

