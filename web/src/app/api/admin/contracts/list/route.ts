import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { isInternalAdminEmailAsync } from "@/lib/admin/internal-admin";
import { getAdminFirestore } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DraftPayload = {
  landlord?: { fullName?: string; email?: string };
  tenant?: { fullName?: string };
  property?: { address?: string };
};

/**
 * Listado de expedientes para el ADMIN (explorador). Trae borradores recientes y
 * permite filtrar por texto (correo, nombres, dirección o id). Solo admin interno.
 */
export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;
  if (!(await isInternalAdminEmailAsync(auth.user.email))) {
    return NextResponse.json({ success: false, error: "forbidden" }, { status: 403 });
  }
  const firestore = getAdminFirestore();
  if (!firestore) return NextResponse.json({ success: false, error: "server" }, { status: 503 });

  const q = (new URL(request.url).searchParams.get("q") ?? "").trim().toLowerCase();

  let snap;
  try {
    snap = await firestore.collection("contract_drafts").orderBy("lastUpdatedAt", "desc").limit(400).get();
  } catch {
    snap = await firestore.collection("contract_drafts").limit(400).get();
  }

  const rows = snap.docs.map((d) => {
    const data = d.data() as { draftId?: string; ownerEmail?: string; lastUpdatedAt?: string; payload?: DraftPayload };
    const p = data.payload ?? {};
    return {
      id: data.draftId ?? d.id,
      ownerEmail: data.ownerEmail ?? "",
      landlordName: p.landlord?.fullName ?? "",
      tenantName: p.tenant?.fullName ?? "",
      address: p.property?.address ?? "",
      updatedAt: data.lastUpdatedAt ?? "",
    };
  });

  const filtered = q
    ? rows.filter((r) =>
        [r.id, r.ownerEmail, r.landlordName, r.tenantName, r.address].join(" ").toLowerCase().includes(q),
      )
    : rows;

  return NextResponse.json({ success: true, total: filtered.length, contracts: filtered.slice(0, 100) });
}
