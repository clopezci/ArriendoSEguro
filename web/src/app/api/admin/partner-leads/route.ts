import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireInternalAdmin } from "@/lib/admin/internal-admin";
import {
  PARTNER_LEADS_COLLECTION,
  deriveLeadOutcome,
  type LeadResponse,
} from "@/domain/partners/partners";

export const runtime = "nodejs";

function firestoreUnavailable() {
  return NextResponse.json(
    { success: false, errors: [{ field: "server", message: "Firestore no configurado." }] },
    { status: 503 },
  );
}

/** Lista los leads con su estado derivado (control de referidos / comisiones). */
export async function GET(request: Request) {
  const auth = await requireInternalAdmin(request);
  if (!auth.ok) return auth.response;
  const firestore = getAdminFirestore();
  if (!firestore) return firestoreUnavailable();

  const snap = await firestore
    .collection(PARTNER_LEADS_COLLECTION)
    .orderBy("createdAtServer", "desc")
    .limit(200)
    .get()
    .catch(() => null);

  const leads = (snap?.docs ?? []).map((d) => {
    const x = d.data() as Record<string, unknown>;
    const outcome = deriveLeadOutcome(
      (x.partnerResponse as LeadResponse | null) ?? null,
      (x.userResponse as LeadResponse | null) ?? null,
    );
    return {
      id: d.id,
      partnerName: String(x.partnerName ?? ""),
      category: String(x.category ?? "otro"),
      clientName: String(x.clientName ?? ""),
      userEmail: String(x.userEmail ?? ""),
      sentAt: String(x.sentAt ?? ""),
      partnerResponse: (x.partnerResponse as string) ?? null,
      userResponse: (x.userResponse as string) ?? null,
      outcome,
      commissionStatus: String(x.commissionStatus ?? "open"),
    };
  });

  const stats = {
    total: leads.length,
    converted: leads.filter((l) => l.outcome.code === "converted").length,
    disputed: leads.filter((l) => l.outcome.needsReview).length,
    commissionEligible: leads.filter((l) => l.outcome.commissionEligible).length,
  };
  return NextResponse.json({ success: true, leads, stats });
}

const patchSchema = z.object({
  id: z.string().min(1),
  commissionStatus: z.enum(["open", "billed", "paid", "void"]),
});

/** Marca el estado de comisión del lead (control de cobro). */
export async function PATCH(request: Request) {
  const auth = await requireInternalAdmin(request);
  if (!auth.ok) return auth.response;
  const firestore = getAdminFirestore();
  if (!firestore) return firestoreUnavailable();

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, errors: [{ field: "body", message: "Datos inválidos." }] }, { status: 422 });
  }
  await firestore.collection(PARTNER_LEADS_COLLECTION).doc(parsed.data.id).set(
    {
      commissionStatus: parsed.data.commissionStatus,
      commissionUpdatedByEmail: auth.user.email,
      commissionUpdatedAtServer: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  return NextResponse.json({ success: true });
}
