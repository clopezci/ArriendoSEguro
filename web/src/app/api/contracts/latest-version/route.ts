import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";

export const runtime = "nodejs";

/**
 * Devuelve SOLO lo que la UI necesita para navegar (id de versión, estado y los
 * términos del canon), **sin exponer datos personales** (partes, documentos,
 * dirección, HTML del contrato). Antes devolvía el `contractPayload` completo
 * sin sesión, lo que filtraba PII por `contractId`.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const contractId = url.searchParams.get("contractId") ?? "";
    if (!contractId) return NextResponse.json({ success: false, errors: [{ field: "contractId", message: "contractId obligatorio." }] }, { status: 422 });
    const firestore = getAdminFirestore();
    if (!firestore) return NextResponse.json({ success: true, contract: null, version: null });
    const contractSnap = await firestore.collection("contracts").doc(contractId).get();
    if (!contractSnap.exists) return NextResponse.json({ success: true, contract: null, version: null });
    const contract = contractSnap.data() as { currentVersionId?: string; status?: string } | undefined;
    const safeContract = { currentVersionId: contract?.currentVersionId ?? null, status: contract?.status ?? null };
    if (!contract?.currentVersionId) return NextResponse.json({ success: true, contract: safeContract, version: null });
    const versionSnap = await firestore.collection("contract_versions").doc(contract.currentVersionId).get();
    const v = versionSnap.data() as
      | {
          contractId?: string;
          status?: string;
          hasSolidaryCoDebtor?: boolean;
          contractPayload?: { lease?: unknown };
          pdfGeneratedAt?: string;
        }
      | undefined;
    // Solo el bloque `lease` (canon, fechas, día de pago) + el booleano
    // `hasSolidaryCoDebtor` (no es PII); nunca partes/inmueble/HTML. Incluimos
    // `pdfGeneratedAt` (solo la marca de tiempo, NO la URL del PDF) para que la
    // UI pueda rehidratar el paso "PDF" como completado tras recargar.
    const safeVersion = versionSnap.exists
      ? {
          id: versionSnap.id,
          contractId: v?.contractId ?? null,
          status: v?.status ?? null,
          hasSolidaryCoDebtor: Boolean(v?.hasSolidaryCoDebtor),
          contractPayload: { lease: v?.contractPayload?.lease ?? null },
          pdfGeneratedAt: v?.pdfGeneratedAt ?? null,
        }
      : null;
    return NextResponse.json({ success: true, contract: safeContract, version: safeVersion });
  } catch {
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "No se pudo consultar la versión actual." }] }, { status: 500 });
  }
}

