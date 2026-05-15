import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { listFullySignedContractIdsForSignerEmail } from "@/lib/account/signedContractsForEmail";

export const runtime = "nodejs";

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

  try {
    const signedContractIds = await listFullySignedContractIdsForSignerEmail(firestore, auth.user.email);
    return NextResponse.json({
      success: true,
      signedContractsCount: signedContractIds.length,
    });
  } catch {
    return NextResponse.json(
      { success: false, errors: [{ field: "server", message: "No se pudo armar el resumen de cuenta." }] },
      { status: 500 },
    );
  }
}
