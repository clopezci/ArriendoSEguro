import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { auditEvent } from "@/features/contracts/audit-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Verificación MANUAL de un documento por el dueño. Cuando la validación asistida
 * por IA marca un documento en alerta (roja/ámbar) pero el dueño lo revisó a ojo y
 * está correcto, puede marcarlo como "revisado por él". Queda REGISTRADO (quién y
 * cuándo) para trazabilidad y la alerta deja de mostrarse. Es SIEMPRE OPCIONAL y
 * no reemplaza el juramento final.
 *
 * Colección `document_manual_reviews`, id = `${scope}__${key}` (sanitizado).
 *   - scope: contractDraftId o contractId (agrupa los documentos del expediente).
 *   - key:   identificador único del documento dentro del expediente
 *            (p. ej. "property", "tenant:cedula", "codebtor_2:certificado_libertad").
 */
const COLLECTION = "document_manual_reviews";

const bodySchema = z.object({
  scope: z.string().trim().min(1).max(200),
  key: z.string().trim().min(1).max(200),
  reviewed: z.boolean().default(true),
  note: z.string().trim().max(400).optional(),
});

function docId(scope: string, key: string): string {
  return `${scope}__${key}`.replace(/[^A-Za-z0-9_:.-]/g, "_").slice(0, 400);
}

/** GET ?scope=... → { reviewed: string[] } (keys marcadas como revisadas). */
export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;

  const scope = new URL(request.url).searchParams.get("scope")?.trim() ?? "";
  if (!scope) return NextResponse.json({ success: false, error: "missing_scope" }, { status: 422 });

  const firestore = getAdminFirestore();
  if (!firestore) return NextResponse.json({ success: true, reviewed: [] });

  const snap = await firestore.collection(COLLECTION).where("scope", "==", scope).limit(500).get().catch(() => null);
  const reviewed = (snap?.docs ?? [])
    .map((d) => d.data() as { key?: string; reviewed?: boolean })
    .filter((r) => r.reviewed !== false && typeof r.key === "string")
    .map((r) => r.key as string);
  return NextResponse.json({ success: true, reviewed });
}

/** POST { scope, key, reviewed } → marca/desmarca la revisión manual. */
export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, error: "invalid_input" }, { status: 422 });
  const { scope, key, reviewed, note } = parsed.data;

  const firestore = getAdminFirestore();
  if (!firestore) return NextResponse.json({ success: false, error: "no_db" }, { status: 503 });

  const now = new Date().toISOString();
  const ref = firestore.collection(COLLECTION).doc(docId(scope, key));
  await ref.set(
    {
      scope,
      key,
      reviewed,
      note: note ?? null,
      reviewedByUid: auth.user.uid,
      reviewedByEmail: auth.user.email ?? null,
      reviewedAt: reviewed ? now : null,
      updatedAt: now,
    },
    { merge: true },
  );

  auditEvent("document_manual_review", { scope, key, reviewed });
  return NextResponse.json({ success: true, reviewed });
}
