import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAgencyMember } from "@/lib/auth/requireAgencyMember";
import { getSubmission, listSubmissions, setSubmissionStatus, type IntakeStatus } from "@/lib/agencies/intakeStore";

export const runtime = "nodejs";

/** GET /api/agency/[agencyId]/submissions?status=pending — bandeja de solicitudes. */
export async function GET(request: Request, { params }: { params: Promise<{ agencyId: string }> }) {
  const { agencyId } = await params;
  const gate = await requireAgencyMember(request, agencyId);
  if (!gate.ok) return gate.response;
  const status = new URL(request.url).searchParams.get("status") as IntakeStatus | null;
  const submissions = await listSubmissions(gate.firestore, agencyId, status ?? undefined);
  return NextResponse.json({ success: true, submissions });
}

const patchSchema = z.object({ id: z.string().trim().min(1), action: z.enum(["discard"]) });

/** PATCH — descarta una solicitud. */
export async function PATCH(request: Request, { params }: { params: Promise<{ agencyId: string }> }) {
  const { agencyId } = await params;
  const gate = await requireAgencyMember(request, agencyId);
  if (!gate.ok) return gate.response;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, errors: [{ field: "body", message: "JSON inválido." }] }, { status: 422 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, errors: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })) }, { status: 422 });
  }
  const sub = await getSubmission(gate.firestore, parsed.data.id);
  if (!sub || sub.agencyId !== agencyId) {
    return NextResponse.json({ success: false, errors: [{ field: "id", message: "Solicitud no encontrada." }] }, { status: 404 });
  }
  await setSubmissionStatus(gate.firestore, parsed.data.id, "discarded");
  return NextResponse.json({ success: true });
}
