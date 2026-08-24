import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { isInternalAdminEmail } from "@/lib/admin/internal-admin";
import { getAdminFirestore } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Gasto de marketing mensual (COP) para calcular el CAC. Es el ÚNICO dato del
 * tablero que no se puede derivar solo: lo captura el dueño una vez al mes.
 * Se guarda en `admin_config/marketing`. Solo admin interno.
 */
async function gate(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return { ok: false as const, response: auth.response };
  if (!isInternalAdminEmail(auth.user.email)) {
    return { ok: false as const, response: NextResponse.json({ success: false, error: "forbidden" }, { status: 403 }) };
  }
  const firestore = getAdminFirestore();
  if (!firestore) return { ok: false as const, response: NextResponse.json({ success: false, error: "server_not_configured" }, { status: 503 }) };
  return { ok: true as const, email: auth.user.email, firestore };
}

export async function GET(request: Request) {
  const g = await gate(request);
  if (!g.ok) return g.response;
  const snap = await g.firestore.collection("admin_config").doc("marketing").get();
  const data = snap.data() as { monthlyCop?: number; updatedAt?: string } | undefined;
  return NextResponse.json({ success: true, monthlyCop: Number(data?.monthlyCop ?? 0) || 0, updatedAt: data?.updatedAt ?? null });
}

const schema = z.object({ monthlyCop: z.number().min(0).max(1_000_000_000) });

export async function PUT(request: Request) {
  const g = await gate(request);
  if (!g.ok) return g.response;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, errors: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })) }, { status: 422 });
  }
  await g.firestore.collection("admin_config").doc("marketing").set(
    { monthlyCop: Math.round(parsed.data.monthlyCop), updatedAt: new Date().toISOString(), updatedBy: g.email, updatedAtServer: FieldValue.serverTimestamp() },
    { merge: true },
  );
  return NextResponse.json({ success: true, monthlyCop: Math.round(parsed.data.monthlyCop) });
}
