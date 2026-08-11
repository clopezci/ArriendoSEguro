import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireContractParticipant } from "@/lib/auth/serverAuth";
import { auditEvent } from "@/features/contracts/audit-server";

export const runtime = "nodejs";

type Err = { success: false; errors: { field: string; message: string }[] };

const schema = z.object({
  contractId: z.string().min(3),
  scheduledPaymentId: z.string().min(3),
});

/**
 * El DUEÑO re-habilita los mensajes de cobro de UN pago (ese mes) tras una
 * conciliación (p. ej. el inquilino incumplió el acuerdo). Reinicia un CICLO de
 * cobro nuevo desde hoy (`escCycleStart`), limpiando la pausa de conciliación y
 * los marcadores del ciclo anterior, para que la escalera (día 1 → requerimiento
 * día 6 → aviso al dueño día 7) vuelva a correr bajo las condiciones ya definidas.
 * Solo el arrendador. La mora REAL (para los textos) sigue contándose desde el
 * vencimiento; el ciclo solo decide el paso.
 */
export async function POST(request: Request) {
  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json<Err>({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json<Err>({ success: false, errors: [{ field: "body", message: "Datos inválidos." }] }, { status: 422 });
  }
  const { contractId, scheduledPaymentId } = parsed.data;

  const participant = await requireContractParticipant(request, firestore, contractId, { kind: "current" });
  if (!participant.ok) return participant.response;
  if (participant.role !== "landlord") {
    return NextResponse.json<Err>({ success: false, errors: [{ field: "role", message: "Solo el dueño puede re-habilitar el cobro." }] }, { status: 403 });
  }

  const ref = firestore.collection("scheduled_payments").doc(scheduledPaymentId);
  const snap = await ref.get();
  const row = snap.data() as { contractId?: string; status?: string } | undefined;
  if (!snap.exists || row?.contractId !== contractId) {
    return NextResponse.json<Err>({ success: false, errors: [{ field: "payment", message: "Pago no encontrado en este contrato." }] }, { status: 404 });
  }
  if (row?.status === "reported_paid" || row?.status === "cancelled") {
    return NextResponse.json<Err>({ success: false, errors: [{ field: "payment", message: "Este pago ya está reportado o cancelado; no hay cobro que reactivar." }] }, { status: 409 });
  }

  const now = new Date().toISOString();
  await ref.set(
    {
      // Ciclo nuevo desde hoy → la escalera vuelve a correr para este mes.
      escCycleStart: now,
      escConciliationStatus: "none",
      escLastCodebtorDay: 0,
      escLateWarnedAt: FieldValue.delete(),
      escFinalOwnerNoticeAt: FieldValue.delete(),
      escRemindersReenabledAt: now,
      updatedAt: now,
    },
    { merge: true },
  );

  auditEvent("payment_reminders_reenabled", { contractId, scheduledPaymentId, by: participant.user.email });
  return NextResponse.json({ success: true });
}
