import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireContractParticipant } from "@/lib/auth/serverAuth";
import { auditEvent } from "@/features/contracts/audit-server";
import { shouldBlockForPlus, plusRequiredResponse } from "@/lib/auth/contractPlusGate";

export const runtime = "nodejs";

type Err = { success: false; errors: { field: string; message: string }[] };

/** Lee la preferencia de recordatorio de vencimiento (default: activado). */
export async function GET(request: Request) {
  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json<Err>(
      { success: false, errors: [{ field: "server", message: "Firestore no configurado." }] },
      { status: 503 },
    );
  }
  const contractId = new URL(request.url).searchParams.get("contractId") ?? "";
  if (!contractId) {
    return NextResponse.json<Err>(
      { success: false, errors: [{ field: "contractId", message: "Falta contractId." }] },
      { status: 422 },
    );
  }
  const participant = await requireContractParticipant(request, firestore, contractId, { kind: "current" });
  if (!participant.ok) return participant.response;

  const snap = await firestore.collection("contracts").doc(contractId).get();
  const enabled = (snap.data() as { renewalReminderEnabled?: boolean } | undefined)?.renewalReminderEnabled;
  return NextResponse.json({ success: true, enabled: enabled !== false });
}

const schema = z.object({ contractId: z.string().min(3), enabled: z.boolean() });

export async function POST(request: Request) {
  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json<Err>(
      { success: false, errors: [{ field: "server", message: "Firestore no configurado." }] },
      { status: 503 },
    );
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json<Err>(
      { success: false, errors: [{ field: "body", message: "Datos inválidos." }] },
      { status: 422 },
    );
  }
  const participant = await requireContractParticipant(request, firestore, parsed.data.contractId, { kind: "current" });
  if (!participant.ok) return participant.response;

  if (await shouldBlockForPlus(firestore, participant.user.uid)) {
    return plusRequiredResponse("Las alertas de vencimiento");
  }

  await firestore.collection("contracts").doc(parsed.data.contractId).set(
    { renewalReminderEnabled: parsed.data.enabled, updatedAt: new Date().toISOString(), updatedAtServer: FieldValue.serverTimestamp() },
    { merge: true },
  );
  auditEvent("renewal_reminder_pref_updated", { contractId: parsed.data.contractId, enabled: parsed.data.enabled, byRole: participant.role });
  return NextResponse.json({ success: true, enabled: parsed.data.enabled });
}
