import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";

export async function logPaymentAudit(
  event: string,
  data: Record<string, string | number | boolean | null | undefined>,
): Promise<void> {
  const firestore = getAdminFirestore();
  if (!firestore) return;
  const now = new Date().toISOString();
  await firestore.collection("audit_logs").add({
    event,
    ...data,
    at: now,
    createdAt: now,
    createdAtServer: FieldValue.serverTimestamp(),
  });
}
