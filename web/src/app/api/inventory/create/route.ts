import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { validateInventoryDraft } from "@/domain/inventory/validateInventory";
import { auditEvent } from "@/features/contracts/audit-server";
import { requireContractParticipant } from "@/lib/auth/serverAuth";
import { shouldBlockForPlus, plusRequiredResponse } from "@/lib/auth/contractPlusGate";

export const runtime = "nodejs";

const schema = z.object({
  leaseProcessId: z.string().min(3),
  contractId: z.string().min(3),
  contractVersionId: z.string().min(3),
  // "initial" = acta de entrega inicial; "final" = acta de entrega y devolución
  // (al terminar el arriendo). Reusa el mismo flujo; se guardan por separado.
  inventoryType: z.enum(["initial", "final"]),
});

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, errors: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })) },
        { status: 422 },
      );
    }
    const issues = validateInventoryDraft(parsed.data);
    if (issues.length) return NextResponse.json({ success: false, errors: issues }, { status: 422 });

    const firestore = getAdminFirestore();
    if (!firestore) return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });

    const versionSnap = await firestore.collection("contract_versions").doc(parsed.data.contractVersionId).get();
    if (!versionSnap.exists) {
      return NextResponse.json(
        { success: false, errors: [{ field: "contractVersionId", message: "Versión contractual no existe." }] },
        { status: 404 },
      );
    }
    const v = versionSnap.data() as { contractId?: string } | undefined;
    if (v?.contractId !== parsed.data.contractId) {
      return NextResponse.json(
        { success: false, errors: [{ field: "contractVersionId", message: "La versión no pertenece al contrato." }] },
        { status: 422 },
      );
    }

    // Autenticación (cierra hueco previo) + gate de pago: el inventario es Plan Plus.
    const participant = await requireContractParticipant(request, firestore, parsed.data.contractId, {
      kind: "by_version",
      contractVersionId: parsed.data.contractVersionId,
    });
    if (!participant.ok) return participant.response;
    if (await shouldBlockForPlus(firestore, participant.user.uid)) {
      return plusRequiredResponse("El inventario del inmueble");
    }

    const ref = firestore.collection("inventories").doc();
    const now = new Date().toISOString();
    await ref.set({
      id: ref.id,
      ...parsed.data,
      status: "draft",
      createdByUserId: participant.user.uid,
      completedAt: null,
      signedAt: null,
      generatedHtml: null,
      generatedPdfUrl: null,
      documentHash: null,
      createdAt: now,
      updatedAt: now,
      createdAtServer: FieldValue.serverTimestamp(),
      updatedAtServer: FieldValue.serverTimestamp(),
    });
    auditEvent("inventory_created", { inventoryId: ref.id, contractId: parsed.data.contractId });
    return NextResponse.json({ success: true, inventoryId: ref.id, status: "draft" });
  } catch {
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "No se pudo crear inventario." }] }, { status: 500 });
  }
}

