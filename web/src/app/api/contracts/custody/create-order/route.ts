import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireContractParticipant } from "@/lib/auth/serverAuth";
import { buildWompiCheckoutUrl } from "@/domain/platform-payments/wompi-checkout";
import { isWompiConfigured } from "@/domain/platform-payments/provider-factory";
import { CUSTODY_ORDERS_COLLECTION, CUSTODY_PRICE_COP, CUSTODY_REFERENCE_PREFIX } from "@/features/contracts/custody-webhook";
import { appConfig } from "@/lib/config";
import type { ResidentialLeaseContractInput } from "@/domain/contracts/types";

export const runtime = "nodejs";

/**
 * Crea el cobro de $20.000 por CUSTODIA EN LA NUBE (5 años) de un contrato, con el
 * Web Checkout de Wompi (misma cuenta central). El `reference` lleva prefijo
 * CUSTODIA_ para que el webhook lo enrute a su handler propio. El monto es
 * autoritativo en el servidor. Solo el arrendador (dueño).
 */
export async function POST(request: Request) {
  try {
    const firestore = getAdminFirestore();
    if (!firestore) return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });
    if (!isWompiConfigured()) return NextResponse.json({ success: false, errors: [{ field: "server", message: "Pasarela de pago no configurada." }] }, { status: 503 });

    const body = (await request.json().catch(() => null)) as { contractId?: string } | null;
    const contractId = body?.contractId?.trim() ?? "";
    if (!contractId) return NextResponse.json({ success: false, errors: [{ field: "contractId", message: "contractId obligatorio." }] }, { status: 422 });

    const contractSnap = await firestore.collection("contracts").doc(contractId).get();
    if (!contractSnap.exists) return NextResponse.json({ success: false, errors: [{ field: "contractId", message: "Contrato no encontrado." }] }, { status: 404 });
    const currentVersionId = (contractSnap.data() as { currentVersionId?: string } | undefined)?.currentVersionId ?? "";
    if (!currentVersionId) return NextResponse.json({ success: false, errors: [{ field: "version", message: "El contrato no tiene versión guardada." }] }, { status: 422 });

    const participant = await requireContractParticipant(request, firestore, contractId, { kind: "by_version", contractVersionId: currentVersionId });
    if (!participant.ok) return participant.response;
    if (participant.role !== "landlord") {
      return NextResponse.json({ success: false, errors: [{ field: "role", message: "Solo el arrendador puede activar la custodia." }] }, { status: 403 });
    }

    const versionSnap = await firestore.collection("contract_versions").doc(currentVersionId).get();
    const payload = (versionSnap.data() as { contractPayload?: ResidentialLeaseContractInput } | undefined)?.contractPayload;
    const fullName = (payload?.landlord?.fullName ?? "").trim();

    const reference = `${CUSTODY_REFERENCE_PREFIX}${contractId}_${Date.now()}_${randomUUID().slice(0, 8)}`;
    const base = appConfig.publicUrl.replace(/\/$/, "");
    const redirectUrl = `${base}/dashboard/contracts/${contractId}/cerrar?custody=return&order=${encodeURIComponent(reference)}`;

    await firestore.collection(CUSTODY_ORDERS_COLLECTION).doc(reference).set({
      reference,
      contractId,
      contractVersionId: currentVersionId,
      userId: participant.user.uid,
      userEmail: participant.user.email,
      amount: CUSTODY_PRICE_COP,
      currency: "COP",
      status: "pending",
      createdAt: new Date().toISOString(),
      createdAtServer: FieldValue.serverTimestamp(),
    });

    const checkoutUrl = buildWompiCheckoutUrl({
      reference,
      amountInCents: CUSTODY_PRICE_COP * 100,
      currency: "COP",
      redirectUrl,
      customerEmail: participant.user.email,
      customerFullName: fullName || undefined,
    });

    return NextResponse.json({ success: true, checkoutUrl, reference, amount: CUSTODY_PRICE_COP });
  } catch (e) {
    if (process.env.NODE_ENV !== "production") console.error("contracts/custody/create-order", e);
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "No se pudo iniciar el pago de la custodia." }] }, { status: 500 });
  }
}
