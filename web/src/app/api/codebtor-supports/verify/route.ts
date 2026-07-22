import { NextResponse } from "next/server";
import { z } from "zod";
import { getStorage } from "firebase-admin/storage";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireContractParticipant } from "@/lib/auth/serverAuth";
import { supportsCollection, type CodebtorSupportDoc } from "@/domain/codebtor-supports/firestore-supports";
import { supportPartySchema } from "@/domain/codebtor-supports/support-schema";
import { validateSupportDoc } from "@/lib/documents/validateSupportDoc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  contractId: z.string().min(3),
  contractVersionId: z.string().min(3),
  party: supportPartySchema,
  supportId: z.string().min(3),
});

type Party = { fullName?: string; documentNumber?: string };

/**
 * Validación IA (asistente NO vinculante) de un soporte post-venta del inquilino/
 * codeudor: verifica que sea del TIPO correcto y que nombre/número coincidan con
 * lo del contrato. Para las partes del contrato. Devuelve un veredicto para pintar
 * alerta ROJA de revisión, sin bloquear.
 */
export async function POST(request: Request) {
  const firestore = getAdminFirestore();
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET?.trim();
  if (!firestore || !bucketName) {
    return NextResponse.json({ success: true, status: "skipped", reason: "storage_off" });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, error: "invalid_input" }, { status: 422 });

  const participant = await requireContractParticipant(request, firestore, parsed.data.contractId, {
    kind: "by_version",
    contractVersionId: parsed.data.contractVersionId,
  });
  if (!participant.ok) return participant.response;

  const snap = await supportsCollection(firestore, parsed.data.contractId, parsed.data.party).doc(parsed.data.supportId).get();
  if (!snap.exists) return NextResponse.json({ success: true, status: "skipped", reason: "no_doc" });
  const doc = snap.data() as Partial<CodebtorSupportDoc>;
  if (doc.voided || doc.contractVersionId !== parsed.data.contractVersionId) {
    return NextResponse.json({ success: true, status: "skipped", reason: "no_doc" });
  }
  if (!doc.supportType) return NextResponse.json({ success: true, status: "skipped", reason: "no_key" });

  // Datos esperados (nombre + documento) de la parte, del payload de la versión.
  const vSnap = await firestore.collection("contract_versions").doc(parsed.data.contractVersionId).get();
  const payload = (vSnap.data() as { contractPayload?: { tenant?: Party; solidaryCoDebtor?: Party; solidaryCoDebtors?: Party[] } } | undefined)?.contractPayload ?? {};
  const expected: Party | undefined =
    parsed.data.party === "tenant"
      ? payload.tenant
      : payload.solidaryCoDebtors && payload.solidaryCoDebtors.length > 0
        ? payload.solidaryCoDebtors[0]
        : payload.solidaryCoDebtor;

  const gsPrefix = `gs://${bucketName}/`;
  const objectPath = (doc.storagePath ?? "").startsWith(gsPrefix) ? (doc.storagePath ?? "").slice(gsPrefix.length) : "";
  if (!objectPath) return NextResponse.json({ success: true, status: "skipped", reason: "no_doc" });

  let bytes: Buffer;
  try {
    const [buf] = await getStorage().bucket(bucketName).file(objectPath).download();
    bytes = buf;
  } catch {
    return NextResponse.json({ success: true, status: "skipped", reason: "download_error" });
  }

  const result = await validateSupportDoc({
    bytes,
    contentType: doc.contentType ?? "",
    fileName: doc.originalFilename ?? "",
    docKey: doc.supportType,
    expectedName: expected?.fullName ?? "",
    expectedDocNumber: expected?.documentNumber ?? "",
  });

  return NextResponse.json({ success: true, ...result });
}
