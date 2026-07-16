import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireContractParticipant } from "@/lib/auth/serverAuth";
import { auditEvent } from "@/features/contracts/audit-server";
import {
  CUSTOM_ALERTS_COLLECTION,
  validateCustomAlert,
  type AlertFrequency,
} from "@/domain/contracts/customAlerts";

export const runtime = "nodejs";

type Err = { success: false; errors: { field: string; message: string }[] };
function err(message: string, status = 422, field = "body") {
  return NextResponse.json<Err>({ success: false, errors: [{ field, message }] }, { status });
}

type AlertRow = {
  id: string;
  name: string;
  message: string;
  frequency: AlertFrequency;
  startDate: string;
  nextFireAt: string | null;
  enabled: boolean;
};

/** GET ?contractId= → alertas del dueño para ese contrato. */
export async function GET(request: Request) {
  const firestore = getAdminFirestore();
  if (!firestore) return err("Firestore no configurado.", 503, "server");
  const contractId = new URL(request.url).searchParams.get("contractId") ?? "";
  if (!contractId) return err("Falta el contrato.");
  const participant = await requireContractParticipant(request, firestore, contractId, { kind: "current" });
  if (!participant.ok) return participant.response;

  // Consulta por un solo campo (evita índice compuesto) y filtra el dueño en código.
  const snap = await firestore
    .collection(CUSTOM_ALERTS_COLLECTION)
    .where("contractId", "==", contractId)
    .limit(200)
    .get();
  const alerts: AlertRow[] = snap.docs
    .map((d) => d.data() as AlertRow & { ownerUid?: string })
    .filter((a) => a.ownerUid === participant.user.uid)
    .map((a) => ({ id: a.id, name: a.name, message: a.message, frequency: a.frequency, startDate: a.startDate, nextFireAt: a.nextFireAt, enabled: a.enabled }))
    .sort((a, b) => (a.startDate < b.startDate ? -1 : 1));
  return NextResponse.json({ success: true, alerts });
}

/** POST → crea una alerta personalizada (solo el arrendador). */
export async function POST(request: Request) {
  const firestore = getAdminFirestore();
  if (!firestore) return err("Firestore no configurado.", 503, "server");
  const body = (await request.json().catch(() => null)) as
    | { contractId?: string; name?: string; message?: string; frequency?: string; startDate?: string }
    | null;
  if (!body?.contractId) return err("Falta el contrato.");
  const participant = await requireContractParticipant(request, firestore, body.contractId, { kind: "current" });
  if (!participant.ok) return participant.response;
  if (participant.role !== "landlord") return err("Solo el arrendador puede crear alertas.", 403, "auth");

  const validationError = validateCustomAlert(body);
  if (validationError) return err(validationError);

  const now = new Date().toISOString();
  const ref = firestore.collection(CUSTOM_ALERTS_COLLECTION).doc();
  await ref.set({
    id: ref.id,
    contractId: body.contractId,
    ownerUid: participant.user.uid,
    ownerEmail: participant.user.email,
    name: body.name!.trim(),
    message: body.message!.trim(),
    frequency: body.frequency as AlertFrequency,
    startDate: body.startDate,
    nextFireAt: `${body.startDate}T12:00:00.000Z`,
    enabled: true,
    createdAt: now,
    createdAtServer: FieldValue.serverTimestamp(),
  });
  auditEvent("custom_alert_created", { contractId: body.contractId, frequency: body.frequency });
  return NextResponse.json({ success: true, id: ref.id });
}

/** DELETE ?id= → elimina una alerta del dueño. */
export async function DELETE(request: Request) {
  const firestore = getAdminFirestore();
  if (!firestore) return err("Firestore no configurado.", 503, "server");
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!id) return err("Falta el id.");
  const ref = firestore.collection(CUSTOM_ALERTS_COLLECTION).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return NextResponse.json({ success: true });
  const data = snap.data() as { contractId?: string; ownerUid?: string };
  // Verifica que quien borra sea participante del contrato de la alerta y su dueño.
  const participant = await requireContractParticipant(request, firestore, data.contractId ?? "", { kind: "current" });
  if (!participant.ok) return participant.response;
  if (data.ownerUid !== participant.user.uid) return err("No autorizado.", 403, "auth");
  await ref.delete();
  auditEvent("custom_alert_deleted", { contractId: data.contractId ?? "" });
  return NextResponse.json({ success: true });
}
