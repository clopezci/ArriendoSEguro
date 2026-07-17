import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireContractParticipant } from "@/lib/auth/serverAuth";
import { reopenAfterRejection } from "@/domain/maintenance/maintenance";
import type { MaintenanceRequest } from "@/domain/maintenance/maintenance";
import { auditEvent } from "@/features/contracts/audit-server";
import { logServerError } from "@/lib/observability/observability";

export const runtime = "nodejs";

const schema = z.object({
  contractId: z.string().min(3),
  requestId: z.string().min(3),
  action: z.enum(["reopen", "resolve", "cancel"]),
});

/**
 * Acciones del flujo de mantenimiento que no son del dueño:
 *  - reopen: el reportante insiste tras un rechazo (reabre a "open").
 *  - resolve: cualquiera de las partes marca la reparación como resuelta.
 *  - cancel: el reportante retira su solicitud.
 */
export async function POST(request: Request) {
  try {
    const firestore = getAdminFirestore();
    if (!firestore) {
      return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });
    }
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ success: false, errors: [{ field: "body", message: "Datos inválidos." }] }, { status: 422 });
    }
    const { contractId, requestId, action } = parsed.data;

    const participant = await requireContractParticipant(request, firestore, contractId, { kind: "current" });
    if (!participant.ok) return participant.response;

    const ref = firestore.collection("contracts").doc(contractId).collection("maintenance").doc(requestId);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ success: false, errors: [{ field: "requestId", message: "Solicitud no encontrada." }] }, { status: 404 });
    }
    const cur = snap.data() as MaintenanceRequest;
    const isReporter = participant.user.uid === cur.reportedByUid;
    const now = new Date().toISOString();

    if (action === "reopen") {
      if (!isReporter) {
        return NextResponse.json({ success: false, errors: [{ field: "role", message: "Solo quien reportó puede insistir." }] }, { status: 403 });
      }
      if (cur.status !== "rejected") {
        return NextResponse.json({ success: false, errors: [{ field: "status", message: "Solo puedes insistir sobre una solicitud rechazada." }] }, { status: 409 });
      }
      const nextStatus = reopenAfterRejection({ status: cur.status, rejectionCount: cur.rejectionCount ?? 0 }).status;
      await ref.set({ status: nextStatus, updatedAt: now }, { merge: true });
      auditEvent("maintenance_reopened", { contractId, requestId });
      return NextResponse.json({ success: true, status: nextStatus });
    }

    if (action === "cancel") {
      if (!isReporter) {
        return NextResponse.json({ success: false, errors: [{ field: "role", message: "Solo quien reportó puede cancelar." }] }, { status: 403 });
      }
      if (cur.status === "resolved" || cur.status === "cancelled") {
        return NextResponse.json({ success: false, errors: [{ field: "status", message: "La solicitud ya está cerrada." }] }, { status: 409 });
      }
      await ref.set({ status: "cancelled", updatedAt: now }, { merge: true });
      auditEvent("maintenance_cancelled", { contractId, requestId });
      return NextResponse.json({ success: true, status: "cancelled" });
    }

    // resolve: cualquiera de las partes (dueño o inquilino) marca la reparación como resuelta.
    if (cur.status === "resolved" || cur.status === "cancelled") {
      return NextResponse.json({ success: false, errors: [{ field: "status", message: "La solicitud ya está cerrada." }] }, { status: 409 });
    }
    await ref.set({ status: "resolved", resolvedAt: now, updatedAt: now }, { merge: true });
    auditEvent("maintenance_resolved", { contractId, requestId, byRole: participant.role });
    return NextResponse.json({ success: true, status: "resolved" });
  } catch (err) {
    await logServerError("maintenance/update", err);
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "No se pudo actualizar la solicitud." }] }, { status: 500 });
  }
}
