import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { listAgenciesForEmail } from "@/lib/agencies/agencyStore";

export const runtime = "nodejs";

/** GET /api/agency/me — agencias donde el usuario actual es miembro. */
export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;
  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });
  }
  try {
    const agencies = await listAgenciesForEmail(firestore, auth.user.email);
    return NextResponse.json({
      success: true,
      agencies: agencies.map((a) => ({ id: a.id, name: a.name, status: a.status })),
    });
  } catch {
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "Error del servidor." }] }, { status: 500 });
  }
}
