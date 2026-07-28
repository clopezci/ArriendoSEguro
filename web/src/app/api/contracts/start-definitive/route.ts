import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { getActivePlusEntitlementForUser } from "@/domain/platform-payments/entitlements";
import { auditPlatformPaymentEvent } from "@/domain/platform-payments/audit";
import { CONTRACT_LIFECYCLE_COLLECTION } from "@/domain/contracts/contractLifecycle";
import { getContractLifecycle } from "@/lib/contracts/lifecycle";

export const runtime = "nodejs";

const schema = z.object({ contractId: z.string().min(3) });

/**
 * Inicia el contrato DEFINITIVO: lo bloquea (no borrable) y CONSUME el cupo Plus.
 * Idempotente: si ya está iniciado, no vuelve a consumir. Solo el dueño del
 * borrador puede iniciarlo.
 */
export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;
  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, errors: [{ field: "contractId", message: "contractId requerido." }] }, { status: 422 });
  }
  const contractId = parsed.data.contractId;

  // Propiedad: el borrador debe ser del usuario autenticado.
  const draftSnap = await firestore.collection("contract_drafts").doc(contractId).get();
  const ownerUid = (draftSnap.data() as { ownerUid?: string } | undefined)?.ownerUid;
  if (!draftSnap.exists || ownerUid !== auth.user.uid) {
    return NextResponse.json({ success: false, errors: [{ field: "auth", message: "Contrato no encontrado o no autorizado." }] }, { status: 403 });
  }

  // Debe existir una versión guardada (contrato generado) para poder iniciarlo.
  const contractSnap = await firestore.collection("contracts").doc(contractId).get();
  const hasVersion = Boolean((contractSnap.data() as { currentVersionId?: string } | undefined)?.currentVersionId);
  if (!hasVersion) {
    return NextResponse.json({ success: false, errors: [{ field: "contract", message: "Primero genera y guarda el contrato antes de iniciarlo." }] }, { status: 422 });
  }

  const life = await getContractLifecycle(firestore, contractId);
  if (life.started) {
    return NextResponse.json({ success: true, alreadyStarted: true, startedAt: life.startedAt });
  }

  const now = new Date().toISOString();
  const ref = firestore.collection(CONTRACT_LIFECYCLE_COLLECTION).doc(contractId);

  // Consumir el cupo Plus SOLO si no se había consumido antes por este contrato.
  let entitlementConsumed = life.entitlementConsumed === true;
  if (!entitlementConsumed) {
    const entitlement = await getActivePlusEntitlementForUser(firestore, auth.user.uid);
    if (!entitlement) {
      return NextResponse.json(
        { success: false, errors: [{ field: "access", message: "Necesitas un Plan Plus activo para iniciar el contrato." }] },
        { status: 403 },
      );
    }
    const nextUsed = entitlement.contractsUsed + 1;
    const nextStatus = nextUsed >= entitlement.maxContractsAllowed ? "used" : "active";
    await firestore.collection("access_entitlements").doc(entitlement.id).set(
      { contractsUsed: nextUsed, status: nextStatus, updatedAt: now, updatedAtServer: FieldValue.serverTimestamp() },
      { merge: true },
    );
    await auditPlatformPaymentEvent(firestore, "access_entitlement_used", {
      entitlementId: entitlement.id,
      userId: auth.user.uid,
      contractsUsed: nextUsed,
      via: "start_definitive",
    });
    entitlementConsumed = true;
  }

  await ref.set(
    {
      contractId,
      started: true,
      startedAt: now,
      startedByUid: auth.user.uid,
      entitlementConsumed,
      unlockedByAdminAt: FieldValue.delete(),
      updatedAt: now,
      updatedAtServer: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  await auditPlatformPaymentEvent(firestore, "contract_started_definitive", { contractId, userId: auth.user.uid });

  return NextResponse.json({ success: true, started: true, startedAt: now });
}
