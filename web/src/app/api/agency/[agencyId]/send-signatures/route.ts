import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAgencyMember } from "@/lib/auth/requireAgencyMember";
import { getCredits } from "@/lib/agencies/agencyStore";
import { sendAgencySignaturesForContract } from "@/lib/agencies/agencySignatures";

export const runtime = "nodejs";
const MAX = 100;

const bodySchema = z.object({ contractIds: z.array(z.string().trim().min(1)).min(1).max(MAX) });

/**
 * POST /api/agency/[agencyId]/send-signatures — envía la ronda de firma de uno o
 * varios contratos. Cada contrato consume 1 crédito (idempotente). Si un contrato
 * se queda sin crédito, se detiene ahí y el resto queda pendiente (se informa).
 */
export async function POST(request: Request, { params }: { params: Promise<{ agencyId: string }> }) {
  const { agencyId } = await params;
  const gate = await requireAgencyMember(request, agencyId);
  if (!gate.ok) return gate.response;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ success: false, errors: [{ field: "body", message: "JSON inválido." }] }, { status: 422 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, errors: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })) },
      { status: 422 },
    );
  }

  const results = [];
  let sentContracts = 0;
  let noCredits = false;
  for (const contractId of parsed.data.contractIds) {
    const r = await sendAgencySignaturesForContract(gate.firestore, agencyId, contractId, gate.user.uid);
    results.push(r);
    if (r.ok) sentContracts += 1;
    if (r.error === "no_credits") {
      noCredits = true;
      break; // sin saldo: detener; el resto queda pendiente
    }
  }

  const blockedIdentity = results.filter((r) => r.error === "identity_failed").length;
  const credits = (await getCredits(gate.firestore, agencyId)).balance;
  return NextResponse.json({ success: true, sentContracts, noCredits, blockedIdentity, credits, results });
}
