import type { Firestore } from "firebase-admin/firestore";
import type { CodebtorSupportType } from "./support-schema";

export type CodebtorSupportDoc = {
  contractId: string;
  contractVersionId: string;
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

export function codebtorSupportsCollection(firestore: Firestore, contractId: string) {
  return firestore.collection("contracts").doc(contractId).collection("codebtor_supports");
}

export async function countActiveSupportsForType(
  firestore: Firestore,
  contractId: string,
  contractVersionId: string,
  supportType: CodebtorSupportType,
): Promise<number> {
  const snap = await codebtorSupportsCollection(firestore, contractId).get();
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
