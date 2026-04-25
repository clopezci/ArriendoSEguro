import type { Firestore } from "firebase-admin/firestore";
import type { AccessEntitlement } from "./types";

export async function getActiveEntitlementsForUser(
  firestore: Firestore,
  userId: string,
): Promise<AccessEntitlement[]> {
  const snap = await firestore
    .collection("access_entitlements")
    .where("userId", "==", userId)
    .where("status", "==", "active")
    .get();
  return snap.docs.map((d) => d.data() as AccessEntitlement);
}

export async function getActivePlusEntitlementForUser(
  firestore: Firestore,
  userId: string,
): Promise<AccessEntitlement | null> {
  const all = await getActiveEntitlementsForUser(firestore, userId);
  return (
    all.find(
      (e) =>
        e.planCode === "plus" &&
        e.accessType === "plus_paid" &&
        e.status === "active" &&
        e.contractsUsed < e.maxContractsAllowed,
    ) ?? null
  );
}

export async function getActiveDemoEntitlementForUser(
  firestore: Firestore,
  userId: string,
): Promise<AccessEntitlement | null> {
  const all = await getActiveEntitlementsForUser(firestore, userId);
  return all.find((e) => e.planCode === "basic_demo" && e.accessType === "demo" && e.status === "active") ?? null;
}

