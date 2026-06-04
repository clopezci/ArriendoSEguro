import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import {
  CONTRACT_DRAFTS_COLLECTION,
  buildDraftDocument,
  parseIncomingDraft,
} from "@/domain/contracts/contractDraftSync";

export const runtime = "nodejs";

const MAX_JSON_BYTES = 300_000;

function firestoreUnavailable() {
  return NextResponse.json(
    { success: false, errors: [{ field: "server", message: "Firestore/Firebase Admin no configurado." }] },
    { status: 503 },
  );
}

/** Lista los borradores del usuario autenticado (resume desde cualquier dispositivo). */
export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;

  const firestore = getAdminFirestore();
  if (!firestore) return firestoreUnavailable();

  const snap = await firestore
    .collection(CONTRACT_DRAFTS_COLLECTION)
    .where("ownerUid", "==", auth.user.uid)
    .get();

  const drafts = snap.docs
    .map((d) => (d.data() as { payload?: unknown }).payload)
    .filter((p): p is Record<string, unknown> => typeof p === "object" && p !== null);

  return NextResponse.json({ success: true, drafts });
}

/** Upsert de un borrador. El dueño se fija con el uid del token, no con el cuerpo. */
export async function PUT(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;

  const firestore = getAdminFirestore();
  if (!firestore) return firestoreUnavailable();

  const len = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(len) && len > MAX_JSON_BYTES) {
    return NextResponse.json(
      { success: false, errors: [{ field: "payload", message: "Solicitud demasiado grande." }] },
      { status: 413 },
    );
  }

  let body: unknown;
  try {
    const raw = await request.text();
    if (raw.length > MAX_JSON_BYTES) {
      return NextResponse.json(
        { success: false, errors: [{ field: "payload", message: "Solicitud demasiado grande." }] },
        { status: 413 },
      );
    }
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      { success: false, errors: [{ field: "body", message: "JSON inválido." }] },
      { status: 422 },
    );
  }

  const draftRaw = (body as { draft?: unknown })?.draft;
  const parsed = parseIncomingDraft(draftRaw);
  if (!parsed.ok) {
    return NextResponse.json(
      { success: false, errors: [{ field: "draft", message: parsed.message }] },
      { status: 422 },
    );
  }

  const doc = buildDraftDocument(auth.user.uid, parsed.draft);
  await firestore
    .collection(CONTRACT_DRAFTS_COLLECTION)
    .doc(doc.draftId)
    .set(
      {
        ownerUid: doc.ownerUid,
        ownerEmail: auth.user.email,
        draftId: doc.draftId,
        lastUpdatedAt: doc.lastUpdatedAt,
        payload: doc.payload,
        updatedAtServer: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

  return NextResponse.json({ success: true, draftId: doc.draftId });
}

/** Borra un borrador del usuario (solo si es el dueño). */
export async function DELETE(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;

  const firestore = getAdminFirestore();
  if (!firestore) return firestoreUnavailable();

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json(
      { success: false, errors: [{ field: "id", message: "Falta el id del borrador." }] },
      { status: 422 },
    );
  }

  const ref = firestore.collection(CONTRACT_DRAFTS_COLLECTION).doc(id);
  const snap = await ref.get();
  if (snap.exists && (snap.data() as { ownerUid?: string }).ownerUid === auth.user.uid) {
    await ref.delete();
  }
  // Idempotente: si no existe o no es del usuario, respondemos ok sin filtrar info.
  return NextResponse.json({ success: true });
}
