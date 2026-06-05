import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireInternalAdmin } from "@/lib/admin/internal-admin";
import { auditPlatformPaymentEvent } from "@/domain/platform-payments/audit";
import { REFERRALS_COLLECTION, type ReferralStatus } from "@/domain/referrals/referrals";

export const runtime = "nodejs";

function firestoreUnavailable() {
  return NextResponse.json(
    { success: false, errors: [{ field: "server", message: "Firestore/Firebase Admin no configurado." }] },
    { status: 503 },
  );
}

/** Lista las referencias (para aprobar/rechazar desde el admin). */
export async function GET(request: Request) {
  const auth = await requireInternalAdmin(request);
  if (!auth.ok) return auth.response;
  const firestore = getAdminFirestore();
  if (!firestore) return firestoreUnavailable();

  const PAGE_LIMIT = 1000;
  const snap = await firestore.collection(REFERRALS_COLLECTION).limit(PAGE_LIMIT).get();
  const truncated = snap.size === PAGE_LIMIT;
  const referrals = snap.docs.map((d) => {
    const x = d.data() as Record<string, unknown>;
    return {
      referredUid: d.id,
      referredEmail: (x.referredEmail as string) ?? "",
      referrerEmail: (x.referrerEmail as string) ?? "",
      code: (x.code as string) ?? "",
      status: (x.status as ReferralStatus) ?? "pending",
      createdAt: (x.createdAt as string) ?? "",
      approvedAt: (x.approvedAt as string) ?? "",
    };
  });
  // Pendientes primero, luego por fecha desc.
  referrals.sort((a, b) => {
    if (a.status === "pending" && b.status !== "pending") return -1;
    if (b.status === "pending" && a.status !== "pending") return 1;
    return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
  });
  const pendingCount = referrals.filter((r) => r.status === "pending").length;
  return NextResponse.json({ success: true, referrals, pendingCount, truncated });
}

const patchSchema = z.object({
  referredUid: z.string().min(1),
  action: z.enum(["approve", "reject"]),
});

export async function PATCH(request: Request) {
  const auth = await requireInternalAdmin(request);
  if (!auth.ok) return auth.response;
  const firestore = getAdminFirestore();
  if (!firestore) return firestoreUnavailable();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, errors: [{ field: "body", message: "JSON inválido." }] }, { status: 422 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, errors: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })) },
      { status: 422 },
    );
  }

  const ref = firestore.collection(REFERRALS_COLLECTION).doc(parsed.data.referredUid);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ success: false, errors: [{ field: "referredUid", message: "Referencia no encontrada." }] }, { status: 404 });
  }

  const status: ReferralStatus = parsed.data.action === "approve" ? "approved" : "rejected";
  await ref.set(
    {
      status,
      approvedAt: status === "approved" ? new Date().toISOString() : null,
      reviewedByEmail: auth.user.email,
      reviewedAtServer: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  await auditPlatformPaymentEvent(firestore, "referral_reviewed", {
    referredUid: parsed.data.referredUid,
    status,
  });

  return NextResponse.json({ success: true, status });
}
