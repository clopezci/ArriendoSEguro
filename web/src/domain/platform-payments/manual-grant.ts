import { FieldValue } from "firebase-admin/firestore";
import type { Auth } from "firebase-admin/auth";
import type { Firestore } from "firebase-admin/firestore";
import { getActivePlusEntitlementForUser } from "./entitlements";
import { auditPlatformPaymentEvent } from "./audit";
import { TESTER_PLUS_MAX_EXPEDIENTES } from "./adjust-tester-plus-quota";

type GrantResult =
  | { ok: false; reason: "user_not_found"; email: string }
  | { ok: true; status: "already_exists" | "created"; entitlementId: string; userId: string; userEmail: string };

export async function grantManualPlusEntitlement(
  deps: {
    auth: Auth;
    firestore: Firestore;
    requestedBy: string;
  },
  input: {
    email: string;
    validDays?: number;
    maxContractsAllowed?: number;
  },
): Promise<GrantResult> {
  const email = input.email.trim().toLowerCase();
  const validDays = Math.max(1, input.validDays ?? 30);
  let userId = "";
  let userEmail = email;

  try {
    const user = await deps.auth.getUserByEmail(email);
    userId = user.uid;
    userEmail = (user.email ?? email).toLowerCase();
  } catch {
    return { ok: false, reason: "user_not_found", email };
  }

  const existing = await getActivePlusEntitlementForUser(deps.firestore, userId);
  if (existing) {
    await auditPlatformPaymentEvent(deps.firestore, "manual_plus_entitlement_already_exists", {
      entitlementId: existing.id,
      userId,
      userEmail,
      requestedBy: deps.requestedBy,
    });
    return { ok: true, status: "already_exists", entitlementId: existing.id, userId, userEmail };
  }

  const nowDate = new Date();
  const nowIso = nowDate.toISOString();
  const validUntilDate = new Date(nowDate);
  validUntilDate.setDate(validUntilDate.getDate() + validDays);
  const validUntilIso = validUntilDate.toISOString();

  const maxContracts = Math.min(
    TESTER_PLUS_MAX_EXPEDIENTES,
    Math.max(1, Math.floor(input.maxContractsAllowed ?? 1)),
  );

  const entitlementRef = deps.firestore.collection("access_entitlements").doc();
  await entitlementRef.set({
    id: entitlementRef.id,
    userId,
    userEmail,
    leaseProcessId: null,
    planCode: "plus",
    accessType: "plus_paid",
    status: "active",
    maxContractsAllowed: maxContracts,
    contractsUsed: 0,
    validUntil: validUntilIso,
    createdAt: nowIso,
    updatedAt: nowIso,
    createdAtServer: FieldValue.serverTimestamp(),
    updatedAtServer: FieldValue.serverTimestamp(),
  });

  await auditPlatformPaymentEvent(deps.firestore, "manual_plus_entitlement_created", {
    entitlementId: entitlementRef.id,
    userId,
    userEmail,
    requestedBy: deps.requestedBy,
    validUntil: validUntilIso,
  });

  return { ok: true, status: "created", entitlementId: entitlementRef.id, userId, userEmail };
}

