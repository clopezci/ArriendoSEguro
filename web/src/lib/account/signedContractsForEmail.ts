import type { Firestore } from "firebase-admin/firestore";

/**
 * Contratos en estado `signed` donde el correo aparece al menos una vez
 * como firmante con estado `signed` en `signatures`. Sirve para retención
 * legal y para bloquear borrado automático de cuenta.
 */
export async function listFullySignedContractIdsForSignerEmail(
  firestore: Firestore,
  email: string,
): Promise<string[]> {
  const normalized = email.trim().toLowerCase();
  const snap = await firestore.collection("signatures").where("signerEmail", "==", normalized).limit(500).get();
  const candidates = new Set<string>();
  for (const d of snap.docs) {
    const s = d.data() as { signatureStatus?: string; contractId?: string };
    if (s.signatureStatus === "signed" && s.contractId) candidates.add(s.contractId);
  }
  const out: string[] = [];
  for (const cid of candidates) {
    const c = await firestore.collection("contracts").doc(cid).get();
    const status = (c.data() as { status?: string } | undefined)?.status;
    if (c.exists && status === "signed") out.push(cid);
  }
  return out;
}
