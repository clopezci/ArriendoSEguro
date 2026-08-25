import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { isInternalAdminEmailAsync } from "@/lib/admin/internal-admin";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { getAdminFirestore } from "@/lib/firebase/admin";
import type { Firestore } from "firebase-admin/firestore";

export const runtime = "nodejs";

/**
 * Admin: lista y revoca los accesos Plus vigentes (los permisos de "usuario pago"
 * que se dan manualmente a los testers). GET lista los `access_entitlements`
 * activos; POST {entitlementId} los revoca (status → "revoked").
 */

function isInternalEnabled() {
  return process.env.NODE_ENV === "development" || process.env.ADMIN_INTERNAL_ENABLED === "true";
}
async function isAllowedAdmin(email: string): Promise<boolean> {
  if (process.env.NODE_ENV === "development") return true;
  return isInternalAdminEmailAsync(email);
}

async function gate(request: Request): Promise<{ ok: true; firestore: Firestore; admin: string } | { ok: false; response: NextResponse }> {
  if (!isInternalEnabled()) {
    return { ok: false, response: NextResponse.json({ success: false, errors: [{ field: "server", message: "No disponible." }] }, { status: 404 }) };
  }
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return { ok: false, response: auth.response };
  if (!(await isAllowedAdmin(auth.user.email))) {
    return { ok: false, response: NextResponse.json({ success: false, errors: [{ field: "auth", message: "No autorizado." }] }, { status: 403 }) };
  }
  const firestore = getAdminFirestore();
  if (!firestore) {
    return { ok: false, response: NextResponse.json({ success: false, errors: [{ field: "server", message: "Firebase Admin no configurado." }] }, { status: 503 }) };
  }
  return { ok: true, firestore, admin: auth.user.email };
}

export async function GET(request: Request) {
  const g = await gate(request);
  if (!g.ok) return g.response;

  const snap = await g.firestore.collection("access_entitlements").where("status", "==", "active").get();
  const grants = snap.docs
    .map((d) => d.data() as Record<string, unknown>)
    .map((x) => ({
      id: String(x.id ?? ""),
      userEmail: String(x.userEmail ?? ""),
      accessType: String(x.accessType ?? ""),
      planCode: String(x.planCode ?? ""),
      maxContractsAllowed: Number(x.maxContractsAllowed ?? 0),
      contractsUsed: Number(x.contractsUsed ?? 0),
      validUntil: (x.validUntil as string) ?? null,
      createdAt: (x.createdAt as string) ?? null,
    }))
    .sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));

  return NextResponse.json({ success: true, grants });
}

const postSchema = z.object({ entitlementId: z.string().min(1) });

export async function POST(request: Request) {
  const g = await gate(request);
  if (!g.ok) return g.response;

  const parsed = postSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, errors: [{ field: "body", message: "Datos inválidos." }] }, { status: 422 });
  }

  const ref = g.firestore.collection("access_entitlements").doc(parsed.data.entitlementId);
  const doc = await ref.get();
  if (!doc.exists) {
    return NextResponse.json({ success: false, errors: [{ field: "entitlementId", message: "No existe ese acceso." }] }, { status: 404 });
  }
  await ref.set(
    { status: "revoked", updatedAt: new Date().toISOString(), updatedAtServer: FieldValue.serverTimestamp(), revokedBy: g.admin },
    { merge: true },
  );
  return NextResponse.json({ success: true });
}
