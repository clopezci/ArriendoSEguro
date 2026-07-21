import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { parseSignatureToken } from "@/domain/signatures/validateSignatureToken";
import {
  signalsForAudience,
  responsibilityIntro,
  type ResponsibilitySignal,
} from "@/domain/contracts/responsibilityAlerts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Devuelve al INQUILINO/contraparte (autenticado por su token de firma) las
 * señales de la "Constancia de alertas y responsabilidad" del contrato que va a
 * firmar. Lee el anexo ya congelado por el flujo del dueño; si aún no existe,
 * responde sin señales (el bloque no se muestra). No expone datos sensibles:
 * solo los puntos dirigidos a "ambas partes" o al arrendatario.
 */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const parsed = parseSignatureToken(token);
  if (!parsed) {
    return NextResponse.json({ success: false, errors: [{ field: "token", message: "Token inválido." }] }, { status: 422 });
  }

  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });
  }

  const sigSnap = await firestore.collection("signatures").doc(parsed.signatureId).get();
  if (!sigSnap.exists) {
    return NextResponse.json({ success: false, errors: [{ field: "token", message: "Token no encontrado." }] }, { status: 404 });
  }
  const signature = sigSnap.data() as { tokenHash?: string; contractId?: string; contractVersionId?: string };
  if (signature.tokenHash !== parsed.tokenHash) {
    return NextResponse.json({ success: false, errors: [{ field: "token", message: "Token inválido." }] }, { status: 422 });
  }

  const contractId = signature.contractId ?? "";
  const contractVersionId = signature.contractVersionId ?? "";
  const annexId = `annex_responsibility_${contractId}_${contractVersionId}`;
  const annexSnap = await firestore.collection("contract_annexes").doc(annexId).get();

  let signals: ResponsibilitySignal[] = [];
  if (annexSnap.exists) {
    const raw = (annexSnap.data() as { signalsJson?: string }).signalsJson ?? "[]";
    try {
      const arr = JSON.parse(raw) as ResponsibilitySignal[];
      if (Array.isArray(arr)) signals = arr;
    } catch {
      signals = [];
    }
  }

  return NextResponse.json({
    success: true,
    intro: responsibilityIntro("tenant"),
    signals: signalsForAudience(signals, "tenant"),
  });
}
