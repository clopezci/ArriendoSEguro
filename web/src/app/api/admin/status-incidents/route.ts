import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireInternalAdmin } from "@/lib/admin/internal-admin";
import { STATUS_INCIDENTS_COLLECTION } from "@/domain/observability/observabilityConfig";
import { sanitizeFreeText } from "@/lib/text/sanitize";

export const runtime = "nodejs";

function firestoreUnavailable() {
  return NextResponse.json(
    { success: false, errors: [{ field: "server", message: "Firestore no configurado." }] },
    { status: 503 },
  );
}

export async function GET(request: Request) {
  const auth = await requireInternalAdmin(request);
  if (!auth.ok) return auth.response;
  const firestore = getAdminFirestore();
  if (!firestore) return firestoreUnavailable();

  const snap = await firestore
    .collection(STATUS_INCIDENTS_COLLECTION)
    .orderBy("createdAtServer", "desc")
    .limit(50)
    .get()
    .catch(() => null);
  const incidents = (snap?.docs ?? []).map((d) => {
    const x = d.data() as Record<string, unknown>;
    return {
      id: d.id,
      title: String(x.title ?? ""),
      body: String(x.body ?? ""),
      severity: String(x.severity ?? "minor"),
      status: String(x.status ?? "investigating"),
      createdAt: String(x.createdAt ?? ""),
    };
  });
  return NextResponse.json({ success: true, incidents });
}

const createSchema = z.object({
  title: z.string().min(3).max(160),
  body: z.string().max(2000).optional(),
  severity: z.enum(["minor", "major", "critical"]).optional(),
});

export async function POST(request: Request) {
  const auth = await requireInternalAdmin(request);
  if (!auth.ok) return auth.response;
  const firestore = getAdminFirestore();
  if (!firestore) return firestoreUnavailable();

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, errors: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })) },
      { status: 422 },
    );
  }
  const now = new Date().toISOString();
  const ref = firestore.collection(STATUS_INCIDENTS_COLLECTION).doc();
  await ref.set({
    title: sanitizeFreeText(parsed.data.title),
    body: parsed.data.body ? sanitizeFreeText(parsed.data.body) : "",
    severity: parsed.data.severity ?? "minor",
    status: "investigating",
    createdAt: now,
    createdByEmail: auth.user.email,
    createdAtServer: FieldValue.serverTimestamp(),
  });
  return NextResponse.json({ success: true, id: ref.id });
}

const patchSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["investigating", "monitoring", "resolved"]),
});

export async function PATCH(request: Request) {
  const auth = await requireInternalAdmin(request);
  if (!auth.ok) return auth.response;
  const firestore = getAdminFirestore();
  if (!firestore) return firestoreUnavailable();

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, errors: [{ field: "body", message: "Datos inválidos." }] },
      { status: 422 },
    );
  }
  await firestore.collection(STATUS_INCIDENTS_COLLECTION).doc(parsed.data.id).set(
    {
      status: parsed.data.status,
      ...(parsed.data.status === "resolved" ? { resolvedAt: new Date().toISOString() } : {}),
      updatedByEmail: auth.user.email,
      updatedAtServer: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  return NextResponse.json({ success: true, status: parsed.data.status });
}
