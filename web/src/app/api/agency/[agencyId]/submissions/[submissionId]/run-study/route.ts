import { NextResponse } from "next/server";
import { requireAgencyMember } from "@/lib/auth/requireAgencyMember";
import { getSubmission, updateSubmissionStudy } from "@/lib/agencies/intakeStore";
import { runExternalStudy } from "@/lib/agencies/externalStudy";

export const runtime = "nodejs";

/**
 * POST /api/agency/[agencyId]/submissions/[submissionId]/run-study
 * Corre el estudio externo (DataCrédito/agregador) para la cédula del solicitante
 * y guarda el score. La llave se descifra y usa solo en el servidor.
 */
export async function POST(request: Request, { params }: { params: Promise<{ agencyId: string; submissionId: string }> }) {
  const { agencyId, submissionId } = await params;
  const gate = await requireAgencyMember(request, agencyId);
  if (!gate.ok) return gate.response;

  const sub = await getSubmission(gate.firestore, submissionId);
  if (!sub || sub.agencyId !== agencyId) {
    return NextResponse.json({ success: false, errors: [{ field: "submissionId", message: "Solicitud no encontrada." }] }, { status: 404 });
  }

  const result = await runExternalStudy(gate.firestore, agencyId, sub.tenant.documentNumber);
  if (!result.available) {
    const msg =
      result.error === "not_configured"
        ? "Aún no configuras el estudio externo (endpoint + llave)."
        : "No se pudo consultar el estudio externo.";
    return NextResponse.json({ success: false, error: result.error, errors: [{ field: "external", message: msg }] }, { status: 502 });
  }
  if (typeof result.score === "number") {
    await updateSubmissionStudy(gate.firestore, submissionId, { score: result.score });
  }
  return NextResponse.json({ success: true, score: result.score ?? null });
}
