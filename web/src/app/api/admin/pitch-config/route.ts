import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { isInternalAdminEmailAsync } from "@/lib/admin/internal-admin";
import { getAdminFirestore } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Contenido EDITABLE del elevator pitch (solo admin interno). Se guarda como JSON
 * en `admin_config/pitch`. El panel lo edita con doble clic y lo persiste aquí.
 */
async function gate(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return { ok: false as const, response: auth.response };
  if (!(await isInternalAdminEmailAsync(auth.user.email))) {
    return { ok: false as const, response: NextResponse.json({ success: false, error: "forbidden" }, { status: 403 }) };
  }
  const firestore = getAdminFirestore();
  if (!firestore) return { ok: false as const, response: NextResponse.json({ success: false, error: "server_not_configured" }, { status: 503 }) };
  return { ok: true as const, email: auth.user.email, firestore };
}

export async function GET(request: Request) {
  const g = await gate(request);
  if (!g.ok) return g.response;
  const snap = await g.firestore.collection("admin_config").doc("pitch").get();
  const data = snap.data() as { model?: unknown; updatedAt?: string } | undefined;
  return NextResponse.json({ success: true, model: data?.model ?? null, updatedAt: data?.updatedAt ?? null });
}

const MAX_BYTES = 200 * 1024;

export async function PUT(request: Request) {
  const g = await gate(request);
  if (!g.ok) return g.response;
  const body = (await request.json().catch(() => null)) as { model?: unknown } | null;
  const model = body?.model;
  if (!model || typeof model !== "object") {
    return NextResponse.json({ success: false, errors: [{ field: "model", message: "Modelo inválido." }] }, { status: 422 });
  }
  if (Buffer.byteLength(JSON.stringify(model), "utf8") > MAX_BYTES) {
    return NextResponse.json({ success: false, errors: [{ field: "model", message: "El contenido supera el tamaño permitido." }] }, { status: 422 });
  }
  await g.firestore.collection("admin_config").doc("pitch").set(
    { model, updatedAt: new Date().toISOString(), updatedBy: g.email, updatedAtServer: FieldValue.serverTimestamp() },
    { merge: true },
  );
  return NextResponse.json({ success: true });
}
