import { NextResponse } from "next/server";
import { requireAgencyMember } from "@/lib/auth/requireAgencyMember";
import { updateAgency } from "@/lib/agencies/agencyStore";
import { sanitizeIntakeFields } from "@/domain/agencies/types";

export const runtime = "nodejs";

/** GET — campos personalizados actuales de la agencia. */
export async function GET(request: Request, { params }: { params: Promise<{ agencyId: string }> }) {
  const { agencyId } = await params;
  const gate = await requireAgencyMember(request, agencyId);
  if (!gate.ok) return gate.response;
  return NextResponse.json({ success: true, fields: gate.agency.intakeFields ?? [] });
}

/** PUT — reemplaza el conjunto de campos personalizados ({ fields: [...] }). */
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
  const fields = sanitizeIntakeFields((body as { fields?: unknown })?.fields);
  await updateAgency(gate.firestore, agencyId, { intakeFields: fields });
  return NextResponse.json({ success: true, fields });
}
