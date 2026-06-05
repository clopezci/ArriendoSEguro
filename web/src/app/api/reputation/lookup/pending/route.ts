import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { LOOKUP_CONSENTS_COLLECTION } from "@/lib/reputation/aggregate-store";

export const runtime = "nodejs";

/** Solicitudes de consulta de MI reputación que están pendientes de mi decisión. */
export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;
  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json(
      { success: false, errors: [{ field: "server", message: "Firestore no configurado." }] },
      { status: 503 },
    );
  }

  const snap = await firestore
    .collection(LOOKUP_CONSENTS_COLLECTION)
    .where("subjectEmail", "==", auth.user.email)
    .get()
    .catch(() => null);

  const requests = (snap?.docs ?? [])
    .map((d) => {
      const x = d.data() as Record<string, unknown>;
      return {
        requesterUid: (x.requesterUid as string) ?? "",
        requesterEmail: (x.requesterEmail as string) ?? "",
        status: (x.status as string) ?? "pending",
        requestedAt: (x.requestedAt as string) ?? "",
      };
    })
    .sort((a, b) => (b.requestedAt ?? "").localeCompare(a.requestedAt ?? ""));

  return NextResponse.json({ success: true, requests });
}
