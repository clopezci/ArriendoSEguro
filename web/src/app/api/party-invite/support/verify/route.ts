import { NextResponse } from "next/server";
import { z } from "zod";
import { getStorage } from "firebase-admin/storage";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { PARTY_INVITE_SUPPORTS_COLLECTION } from "@/domain/party-invite/inviteSupports";
import { validateSupportDoc } from "@/lib/documents/validateSupportDoc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ supportId: z.string().min(3) });

type Party = { fullName?: string; documentNumber?: string };

/**
 * Validación IA (asistente NO vinculante) de un documento soporte del inquilino/
 * codeudor: verifica que sea del TIPO correcto y que el nombre/número coincidan
 * con lo tecleado. Solo el DUEÑO del expediente. Devuelve un veredicto para
 * pintar una alerta ROJA de revisión, sin bloquear.
 */
export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;
  const firestore = getAdminFirestore();
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET?.trim();
  if (!firestore || !bucketName) {
    return NextResponse.json({ success: true, status: "skipped", reason: "storage_off" });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, error: "invalid_input" }, { status: 422 });

  const snap = await firestore.collection(PARTY_INVITE_SUPPORTS_COLLECTION).doc(parsed.data.supportId).get();
  if (!snap.exists) return NextResponse.json({ success: true, status: "skipped", reason: "no_doc" });
  const doc = snap.data() as {
    contractDraftId?: string;
    inviterUid?: string;
    role?: string;
    docKey?: string;
    codebtorSlot?: number;
    storagePath?: string;
    contentType?: string;
    fileName?: string;
  };

  // Solo el dueño del expediente (quien invitó) puede verificar.
  const draftSnap = doc.contractDraftId
    ? await firestore.collection("contract_drafts").doc(doc.contractDraftId).get()
    : null;
  const draft = draftSnap?.data() as { ownerUid?: string; payload?: Record<string, unknown> } | undefined;
  const ownerUid = doc.inviterUid ?? draft?.ownerUid;
  if (ownerUid && ownerUid !== auth.user.uid) {
    return NextResponse.json({ success: false, error: "forbidden" }, { status: 403 });
  }
  if (!doc.docKey) return NextResponse.json({ success: true, status: "skipped", reason: "no_key" });

  // Datos esperados (nombre + documento) de la parte, según rol y slot.
  const payload = (draft?.payload ?? {}) as {
    tenant?: Party;
    solidaryCoDebtor?: Party;
    solidaryCoDebtors?: Party[];
  };
  let expected: Party | undefined;
  if (doc.role === "tenant") {
    expected = payload.tenant;
  } else {
    const slot = doc.codebtorSlot ?? 0;
    const list = payload.solidaryCoDebtors;
    expected = list && list.length > 0 ? list[slot] : payload.solidaryCoDebtor;
  }

  const gsPrefix = `gs://${bucketName}/`;
  const objectPath = (doc.storagePath ?? "").startsWith(gsPrefix) ? (doc.storagePath ?? "").slice(gsPrefix.length) : "";
  if (!objectPath) return NextResponse.json({ success: true, status: "skipped", reason: "no_doc" });

  const contentType = (doc.contentType ?? "").toLowerCase();
  const fileName = (doc.fileName ?? "").toLowerCase();
  const isImage = contentType.startsWith("image/") || /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(fileName);

  // Imágenes → URL firmada (sin tope de base64). PDF/Word → descarga y extrae texto.
  let bytes: Buffer | undefined;
  let imageUrl: string | undefined;
  try {
    if (isImage) {
      const [url] = await getStorage().bucket(bucketName).file(objectPath).getSignedUrl({ action: "read", expires: Date.now() + 15 * 60 * 1000 });
      imageUrl = url;
    } else {
      const [buf] = await getStorage().bucket(bucketName).file(objectPath).download();
      bytes = buf;
    }
  } catch {
    return NextResponse.json({ success: true, status: "skipped", reason: "download_error" });
  }

  const result = await validateSupportDoc({
    bytes,
    imageUrl,
    contentType: doc.contentType ?? "",
    fileName: doc.fileName ?? "",
    docKey: doc.docKey,
    expectedName: expected?.fullName ?? "",
    expectedDocNumber: expected?.documentNumber ?? "",
  });

  return NextResponse.json({ success: true, ...result });
}
