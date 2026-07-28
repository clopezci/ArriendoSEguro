import "server-only";
import type { Firestore } from "firebase-admin/firestore";
import {
  CONTRACT_LIFECYCLE_COLLECTION,
  resolveContractLifecycle,
  type ContractLifecycle,
} from "@/domain/contracts/contractLifecycle";

/** Lee el ciclo de vida de un contrato (o el estado por defecto: no iniciado). */
export async function getContractLifecycle(firestore: Firestore, contractId: string): Promise<ContractLifecycle> {
  try {
    const snap = await firestore.collection(CONTRACT_LIFECYCLE_COLLECTION).doc(contractId).get();
    return resolveContractLifecycle(contractId, snap.exists ? snap.data() : undefined);
  } catch {
    return resolveContractLifecycle(contractId, undefined);
  }
}

/** ¿El contrato está iniciado y bloqueado? (no borrable salvo por admin). */
export async function isContractStarted(firestore: Firestore, contractId: string): Promise<boolean> {
  const life = await getContractLifecycle(firestore, contractId);
  return life.started;
}
