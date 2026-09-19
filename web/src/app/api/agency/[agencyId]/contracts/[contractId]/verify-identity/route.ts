import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { requireAgencyMember } from "@/lib/auth/requireAgencyMember";
import { verifyIdentity, isIdentityConfigured } from "@/lib/identity/hubClient";
import { CONTRACTS_COLLECTION } from "@/lib/agencies/agencyContracts";

export const runtime = "nodejs";
const MAX_JSON_BYTES = 12_000_000;

const schema = z.object({
  cedula: z.string().trim().min(3).max(30),
  fotoCedula: z.string().min(10),
  selfie: z.string().min(10).optional(),
  nivel: z.enum(["basico", "medio", "alto", "maximo"]).optional(),
});

/**
 * POST /api/agency/[agencyId]/contracts/[contractId]/verify-identity
 * Verifica identidad y GUARDA el resultado en el contrato (`identityCheck`).
 * Ese resultado es el que consulta el envío a firma para bloquear reprobados.
 */
export async function POST(request: Request, { params }: { params: Promise<{ agencyId: string; contractId: string }> }) {
  const { agencyId, contractId } = await params;
  const gate = await requireAgencyMember(request, agencyId);
  if (!gate.ok) return gate.response;
  if (!isIdentityConfigured()) {
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "Módulo de identidad no configurado." }] }, { status: 503 });
  }

  const contractRef = gate.firestore.collection(CONTRACTS_COLLECTION).doc(contractId);
  const snap = await contractRef.get();
  if (!snap.exists || (snap.data() as Record<string, unknown>).agencyId !== agencyId) {
    return NextResponse.json({ success: false, errors: [{ field: "contractId", message: "Contrato no encontrado." }] }, { status: 404 });
  }

  const raw = await request.text();
  if (raw.length > MAX_JSON_BYTES) {
    return NextResponse.json({ success: false, errors: [{ field: "payload", message: "Imágenes demasiado grandes." }] }, { status: 413 });
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ success: false, errors: [{ field: "body", message: "JSON inválido." }] }, { status: 422 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, errors: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })) }, { status: 422 });
  }

  const result = await verifyIdentity(parsed.data);
  if (!result.available) {
    return NextResponse.json({ success: false, result, errors: [{ field: "identity", message: "No se pudo consultar el servicio de identidad." }] }, { status: 502 });
  }

  // Persistimos un resumen del resultado en el contrato (no las fotos).
  await contractRef.set(
    {
      identityCheck: {
        approved: result.approved,
        confianza: result.confianza ?? null,
        nombreRegistrado: result.nombreRegistrado ?? null,
        cedulaVigente: result.cedulaVigente ?? null,
        faceMatch: result.faceMatch ?? null,
        liveness: result.liveness ?? null,
        checkedAt: new Date().toISOString(),
        byUid: gate.user.uid,
      },
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return NextResponse.json({ success: true, result });
}
