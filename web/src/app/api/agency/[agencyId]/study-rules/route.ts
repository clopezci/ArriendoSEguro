import { NextResponse } from "next/server";
import { requireAgencyMember } from "@/lib/auth/requireAgencyMember";
import { updateAgency } from "@/lib/agencies/agencyStore";
import { sanitizeStudyRules } from "@/domain/agencies/studyRules";

export const runtime = "nodejs";

/** GET — reglas de estudio de la agencia. */
export async function GET(request: Request, { params }: { params: Promise<{ agencyId: string }> }) {
  const { agencyId } = await params;
  const gate = await requireAgencyMember(request, agencyId);
  if (!gate.ok) return gate.response;
  return NextResponse.json({ success: true, rules: gate.agency.studyRules ?? [] });
}

/** PUT — reemplaza las reglas ({ rules: [...] }). */
export async function PUT(request: Request, { params }: { params: Promise<{ agencyId: string }> }) {
  const { agencyId } = await params;
  const gate = await requireAgencyMember(request, agencyId);
  if (!gate.ok) return gate.response;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, errors: [{ field: "body", message: "JSON inválido." }] }, { status: 422 });
  }
  const rules = sanitizeStudyRules((body as { rules?: unknown })?.rules);
  await updateAgency(gate.firestore, agencyId, { studyRules: rules });
  return NextResponse.json({ success: true, rules });
}
