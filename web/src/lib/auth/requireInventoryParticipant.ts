import type { Firestore } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { requireContractParticipant, type ContractParticipantRole } from "@/lib/auth/serverAuth";
import type { DecodedIdToken } from "firebase-admin/auth";

/**
 * Gate de autorización para rutas que operan sobre un inventario.
 *
 * Carga `inventories/<inventoryId>` para resolver el contrato/versión al que
 * pertenece y delega en `requireContractParticipant` para verificar que el
 * email del usuario autenticado corresponde a una parte del contrato.
 *
 * Devuelve la MISMA forma de unión que `requireContractParticipant`, de modo
 * que los callers pueden hacer `if (!gate.ok) return gate.response;`.
 */
export async function requireInventoryParticipant(
  request: Request,
  firestore: Firestore,
  inventoryId: string,
): Promise<
  | {
      ok: true;
      user: { uid: string; email: string; decoded: DecodedIdToken };
      role: ContractParticipantRole;
    }
  | { ok: false; response: NextResponse }
> {
  const snap = await firestore.collection("inventories").doc(inventoryId).get();
  if (!snap.exists) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, errors: [{ field: "inventoryId", message: "Inventario no encontrado." }] },
        { status: 404 },
      ),
    };
  }

  const data = snap.data() as { contractId?: string; contractVersionId?: string } | undefined;
  const contractId = (data?.contractId ?? "").trim();
  const contractVersionId = (data?.contractVersionId ?? "").trim();

  if (!contractId) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, errors: [{ field: "inventoryId", message: "El inventario no está asociado a un contrato." }] },
        { status: 404 },
      ),
    };
  }

  if (contractVersionId) {
    return requireContractParticipant(request, firestore, contractId, {
      kind: "by_version",
      contractVersionId,
    });
  }

  return requireContractParticipant(request, firestore, contractId, { kind: "current" });
}
