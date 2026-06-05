import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireContractParticipant } from "@/lib/auth/serverAuth";
import { appConfig } from "@/lib/config";
import { createUploadToken } from "@/lib/payments/uploadTokenStore";

export const runtime = "nodejs";

const schema = z.object({
  contractId: z.string().min(3),
  contractVersionId: z.string().min(3),
  scheduledPaymentId: z.string().optional(),
  periodLabel: z.string().min(1).max(80),
  dueDate: z.string().min(4).max(40),
  expectedAmount: z.number().nonnegative(),
});

/** Genera (o reutiliza) el enlace de subida de pago para compartir con el inquilino. */
export async function POST(request: Request) {
  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, errors: [{ field: "body", message: "Datos inválidos." }] }, { status: 422 });
  }
  const participant = await requireContractParticipant(request, firestore, parsed.data.contractId, {
    kind: "by_version",
    contractVersionId: parsed.data.contractVersionId,
  });
  if (!participant.ok) return participant.response;
  if (participant.role !== "landlord") {
    return NextResponse.json({ success: false, errors: [{ field: "auth", message: "Solo el arrendador genera el enlace." }] }, { status: 403 });
  }

  const vSnap = await firestore.collection("contract_versions").doc(parsed.data.contractVersionId).get();
  const landlordName =
    ((vSnap.data() as { contractPayload?: { landlord?: { fullName?: string } } } | undefined)?.contractPayload?.landlord
      ?.fullName ?? "El arrendador").trim() || "El arrendador";

  const token = await createUploadToken(firestore, {
    contractId: parsed.data.contractId,
    contractVersionId: parsed.data.contractVersionId,
    scheduledPaymentId: parsed.data.scheduledPaymentId ?? null,
    periodLabel: parsed.data.periodLabel,
    dueDate: parsed.data.dueDate,
    expectedAmount: parsed.data.expectedAmount,
    landlordName,
  });

  const link = `${appConfig.publicUrl.replace(/\/$/, "")}/pago/${token}`;
  return NextResponse.json({ success: true, token, link });
}
