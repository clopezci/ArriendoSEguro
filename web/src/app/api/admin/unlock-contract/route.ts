import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { isInternalAdminEmailAsync } from "@/lib/admin/internal-admin";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { CONTRACT_LIFECYCLE_COLLECTION } from "@/domain/contracts/contractLifecycle";
import { auditPlatformPaymentEvent } from "@/domain/platform-payments/audit";

export const runtime = "nodejs";

const schema = z.object({ contractId: z.string().min(3) });

/** Desbloquea un contrato iniciado (solo admin): permite ajustes/borrado excepcional. */
export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;
  if (!(await isInternalAdminEmailAsync(auth.user.email))) {
    return NextResponse.json({ success: false, error: "forbidden" }, { status: 403 });
  }
  const firestore = getAdminFirestore();
  if (!firestore) return NextResponse.json({ success: false, error: "server" }, { status: 503 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, errors: [{ field: "contractId", message: "contractId requerido." }] }, { status: 422 });
  }
  const now = new Date().toISOString();
  await firestore.collection(CONTRACT_LIFECYCLE_COLLECTION).doc(parsed.data.contractId).set(
    { started: false, unlockedByAdminAt: now, updatedAt: now, updatedAtServer: FieldValue.serverTimestamp() },
    { merge: true },
  );
  await auditPlatformPaymentEvent(firestore, "contract_unlocked_by_admin", {
    contractId: parsed.data.contractId,
    adminEmail: auth.user.email,
  });
  return NextResponse.json({ success: true });
}
