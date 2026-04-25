import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { parseSignatureToken, isTokenExpired } from "@/domain/signatures/validateSignatureToken";
import { nextSignatureStatusOnOpen } from "@/domain/signatures/signatureStatus";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get("token") ?? "";
    const parsed = parseSignatureToken(token);
    if (!parsed) {
      return NextResponse.json({ success: false, errors: [{ field: "token", message: "Token inválido." }] }, { status: 422 });
    }

    const firestore = getAdminFirestore();
    if (!firestore) {
      return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });
    }
    const signatureRef = firestore.collection("signatures").doc(parsed.signatureId);
    const snap = await signatureRef.get();
    if (!snap.exists) {
      return NextResponse.json({ success: false, errors: [{ field: "token", message: "Token no encontrado." }] }, { status: 404 });
    }
    const signature = snap.data() as {
      tokenHash: string;
      tokenExpiresAt: string;
      signatureStatus: string;
      contractId: string;
      contractVersionId: string;
      signerName: string;
      signerEmail: string;
      partyType: string;
      documentHash: string;
    };
    if (signature.tokenHash !== parsed.tokenHash) {
      return NextResponse.json({ success: false, errors: [{ field: "token", message: "Token inválido." }] }, { status: 422 });
    }
    if (isTokenExpired(signature.tokenExpiresAt)) {
      if (signature.signatureStatus !== "signed") {
        await signatureRef.set({ signatureStatus: "expired", updatedAt: new Date().toISOString() }, { merge: true });
      }
      return NextResponse.json({ success: false, errors: [{ field: "token", message: "El enlace de firma expiró." }] }, { status: 410 });
    }

    const nextStatus = nextSignatureStatusOnOpen(signature.signatureStatus as never);
    if (nextStatus !== signature.signatureStatus) {
      await signatureRef.set({ signatureStatus: nextStatus, updatedAt: new Date().toISOString() }, { merge: true });
    }

    const versionSnap = await firestore.collection("contract_versions").doc(signature.contractVersionId).get();
    const version = versionSnap.data() as { versionNumber?: number; documentHash?: string; pdfUrl?: string } | undefined;
    if (!version?.documentHash || version.documentHash !== signature.documentHash) {
      return NextResponse.json(
        { success: false, errors: [{ field: "documentHash", message: "La versión cambió, solicita un nuevo enlace." }] },
        { status: 422 },
      );
    }
    return NextResponse.json({
      success: true,
      signerName: signature.signerName,
      signerEmail: signature.signerEmail,
      partyType: signature.partyType,
      contractId: signature.contractId,
      contractVersionId: signature.contractVersionId,
      versionNumber: version?.versionNumber ?? 1,
      documentHash: signature.documentHash,
      pdfUrl: version?.pdfUrl ?? null,
      signatureStatus: nextStatus,
      tokenExpiresAt: signature.tokenExpiresAt,
    });
  } catch {
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "No se pudo cargar el enlace de firma." }] }, { status: 500 });
  }
}

