import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireContractParticipant } from "@/lib/auth/serverAuth";
import { auditEvent } from "@/features/contracts/audit-server";
import { validatePaymentSettings, PAYMENT_SETTINGS_COLLECTION } from "@/domain/payments/paymentSettings";

export const runtime = "nodejs";

function firestoreUnavailable() {
  return NextResponse.json(
    { success: false, errors: [{ field: "server", message: "Firestore no configurado." }] },
    { status: 503 },
  );
}

/** Devuelve la configuración de pago del contrato (para el dueño). */
export async function GET(request: Request) {
  const firestore = getAdminFirestore();
  if (!firestore) return firestoreUnavailable();
  const contractId = new URL(request.url).searchParams.get("contractId") ?? "";
  if (!contractId) {
    return NextResponse.json({ success: false, errors: [{ field: "contractId", message: "Falta contractId." }] }, { status: 422 });
  }
  const participant = await requireContractParticipant(request, firestore, contractId, { kind: "current" });
  if (!participant.ok) return participant.response;

  const snap = await firestore.collection(PAYMENT_SETTINGS_COLLECTION).doc(contractId).get();
  return NextResponse.json({ success: true, settings: snap.exists ? snap.data() : { method: "none", consentAccepted: false } });
}

/** Guarda la configuración (solo el arrendador). */
export async function PUT(request: Request) {
  const firestore = getAdminFirestore();
  if (!firestore) return firestoreUnavailable();

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const contractId = String(body?.contractId ?? "");
  if (!contractId) {
    return NextResponse.json({ success: false, errors: [{ field: "contractId", message: "Falta contractId." }] }, { status: 422 });
  }
  const participant = await requireContractParticipant(request, firestore, contractId, { kind: "current" });
  if (!participant.ok) return participant.response;
  if (participant.role !== "landlord") {
    return NextResponse.json({ success: false, errors: [{ field: "auth", message: "Solo el arrendador configura el método de pago." }] }, { status: 403 });
  }

  const v = validatePaymentSettings(body ?? {});
  if (!v.ok) return NextResponse.json({ success: false, errors: [{ field: "settings", message: v.message }] }, { status: 422 });

  const now = new Date().toISOString();
  await firestore.collection(PAYMENT_SETTINGS_COLLECTION).doc(contractId).set(
    {
      ...v.value,
      contractId,
      consentAt: v.value.method !== "none" ? now : null,
      updatedAt: now,
      updatedByUid: participant.user.uid,
      updatedAtServer: FieldValue.serverTimestamp(),
    },
    { merge: false },
  );

  auditEvent("payment_settings_updated", { contractId, method: v.value.method });
  return NextResponse.json({ success: true });
}
