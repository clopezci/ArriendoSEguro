import "server-only";
import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import {
  TAX_CONFIG_COLLECTION,
  TAX_CONFIG_DOC_ID,
  resolveTaxConfig,
  type TaxConfig,
} from "@/domain/tax/taxConfig";

/** Lee la config tributaria de Firestore (o defaults). Nunca lanza. */
export async function getTaxConfig(firestore: Firestore): Promise<TaxConfig> {
  try {
    const snap = await firestore.collection(TAX_CONFIG_COLLECTION).doc(TAX_CONFIG_DOC_ID).get();
    return resolveTaxConfig(snap.exists ? snap.data() : undefined);
  } catch {
    return resolveTaxConfig(undefined);
  }
}

/** Guarda (merge) cambios de la config tributaria. */
export async function saveTaxConfig(
  firestore: Firestore,
  patch: Partial<TaxConfig>,
  updatedByEmail?: string | null,
): Promise<TaxConfig> {
  const ref = firestore.collection(TAX_CONFIG_COLLECTION).doc(TAX_CONFIG_DOC_ID);
  await ref.set(
    {
      ...patch,
      updatedAt: new Date().toISOString(),
      updatedByEmail: updatedByEmail ?? null,
      updatedAtServer: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  const snap = await ref.get();
  return resolveTaxConfig(snap.data());
}
