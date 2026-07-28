import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { getContractLifecycle } from "@/lib/contracts/lifecycle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Estado del ciclo de vida (¿iniciado/bloqueado?) de un contrato. */
export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;
  const firestore = getAdminFirestore();
  if (!firestore) return NextResponse.json({ success: false, error: "server" }, { status: 503 });
  const id = new URL(request.url).searchParams.get("contractId") ?? "";
  if (!id) return NextResponse.json({ success: false, error: "missing_id" }, { status: 422 });
  const life = await getContractLifecycle(firestore, id);
  return NextResponse.json({ success: true, started: life.started, startedAt: life.startedAt ?? null });
}
