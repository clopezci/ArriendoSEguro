import { FieldValue } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";
import { auditEvent } from "@/features/contracts/audit";

export async function auditPlatformPaymentEvent(
  firestore: Firestore,
  event: string,
  payload: Record<string, string | number | boolean | null | undefined>,
): Promise<void> {
  const now = new Date().toISOString();
  await firestore.collection("audit_logs").add({
    event,
    ...payload,
    at: now,
    createdAtServer: FieldValue.serverTimestamp(),
  });
  auditEvent(event, payload);
}

