import type { Firestore } from "firebase-admin/firestore";
import type { CodebtorSupportType, SupportParty } from "./support-schema";

export type CodebtorSupportDoc = {
  contractId: string;
  contractVersionId: string;
  party?: SupportParty;
  supportType: CodebtorSupportType;
  storagePath: string;
  contentType: string;
  sizeBytes: number;
  originalFilename: string;
  uploadedAt: string;
  uploadedByUid: string;
  voided?: boolean;
  voidedAt?: string | null;
};

/**
 * Subcolección de soportes por parte. El codeudor conserva `codebtor_supports`
 * (histórico); el inquilino usa `tenant_supports`. Así no se requiere migración.
 */
export function supportsCollection(firestore: Firestore, contractId: string, party: SupportParty) {
  const name = party === "tenant" ? "tenant_supports" : "codebtor_supports";
  return firestore.collection("contracts").doc(contractId).collection(name);
}

export async function countActiveSupportsForType(
  firestore: Firestore,
  contractId: string,
  contractVersionId: string,
  party: SupportParty,
  supportType: CodebtorSupportType,
): Promise<number> {
  const snap = await supportsCollection(firestore, contractId, party).get();
  let n = 0;
  for (const d of snap.docs) {
    const row = d.data() as Partial<CodebtorSupportDoc>;
    if (row.voided) continue;
    if (row.contractVersionId !== contractVersionId) continue;
    if (row.supportType !== supportType) continue;
    n += 1;
  }
  return n;
}
