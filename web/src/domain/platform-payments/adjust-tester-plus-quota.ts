import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import type { AccessEntitlement } from "./types";
import { getAllEntitlementsForUser } from "./entitlements";
import { auditPlatformPaymentEvent } from "./audit";

/** Techo de seguridad para testers (evita errores de dedo en el panel). */
export const TESTER_PLUS_MAX_EXPEDIENTES = 50;
/** Más cupos por llamada desde el panel (+N). */
export const TESTER_PLUS_MAX_ADD_SLOTS = 20;

function isPlusPaid(e: AccessEntitlement): boolean {
  return e.planCode === "plus" && e.accessType === "plus_paid";
}

function isAdjustableStatus(e: AccessEntitlement): boolean {
  return e.status === "active" || e.status === "used";
}

function withinValidity(e: AccessEntitlement): boolean {
  if (!e.validUntil) return true;
  const t = Date.parse(e.validUntil);
  if (!Number.isFinite(t)) return true;
  return t >= Date.now();
}

/**
 * Si el usuario tiene varios Plus (manual + compra, etc.), priorizamos el que
 * tenga cupo disponible; si no, el más actualizado (`active` sobre `used`).
 */
export function pickPlusEntitlementToAdjustQuota(entitlements: AccessEntitlement[]): AccessEntitlement | null {
  const valid = entitlements.filter(
    (e) => isPlusPaid(e) && isAdjustableStatus(e) && withinValidity(e),
  );
  if (valid.length === 0) return null;

  const hasRoom = (e: AccessEntitlement) =>
    e.status === "active" && e.contractsUsed < e.maxContractsAllowed;

  valid.sort((a, b) => {
    const ar = hasRoom(a) ? 0 : 1;
    const br = hasRoom(b) ? 0 : 1;
    if (ar !== br) return ar - br;
    const as = a.status === "used" ? 1 : 0;
    const bs = b.status === "used" ? 1 : 0;
    if (as !== bs) return as - bs;
    const ta = Date.parse(a.updatedAt ?? a.createdAt ?? "") || 0;
    const tb = Date.parse(b.updatedAt ?? b.createdAt ?? "") || 0;
    return tb - ta;
  });
  return valid[0] ?? null;
}

export type AdjustQuotaResult =
  | { ok: false; reason: "user_not_found" | "no_plus_entitlement" | "nothing_to_do" | "payload"; email?: string }
  | {
      ok: true;
      entitlementId: string;
      previousMax: number;
      previousStatus: AccessEntitlement["status"];
      newMax: number;
      contractsUsed: number;
      status: AccessEntitlement["status"];
      userEmail: string;
      userId: string;
    };

/** Aplica nuevo máximo; reactiva a `active` si quedaron cupos libres. */
export async function applyTesterPlusQuotaAdjust(
  firestore: Firestore,
  entitlement: AccessEntitlement,
  requestedMaxContracts: number,
  requestedBy: string,
): Promise<AdjustQuotaResult> {
  const cap = TESTER_PLUS_MAX_EXPEDIENTES;
  let nextMax = Math.min(cap, requestedMaxContracts);
  const minMax = entitlement.contractsUsed;
  nextMax = Math.max(minMax, nextMax);
  const previousMax = entitlement.maxContractsAllowed;
  const nextStatus = minMax >= nextMax ? ("used" as const) : ("active" as const);

  if (nextMax === previousMax && nextStatus === entitlement.status) {
    return { ok: false, reason: "nothing_to_do" };
  }

  const previousStatus = entitlement.status;
  const nowIso = new Date().toISOString();

  await firestore.collection("access_entitlements").doc(entitlement.id).set(
    {
      maxContractsAllowed: nextMax,
      status: nextStatus,
      updatedAt: nowIso,
      updatedAtServer: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  await auditPlatformPaymentEvent(firestore, "admin_tester_plus_quota_adjusted", {
    entitlementId: entitlement.id,
    userId: entitlement.userId,
    previousMax,
    newMax: nextMax,
    contractsUsed: minMax,
    previousStatus,
    nextStatus,
    requestedBy,
  });

  return {
    ok: true,
    entitlementId: entitlement.id,
    previousMax,
    previousStatus,
    newMax: nextMax,
    contractsUsed: minMax,
    status: nextStatus,
    userEmail: entitlement.userEmail,
    userId: entitlement.userId,
  };
}

export async function adjustTesterPlusQuotaByEmail(deps: {
  firestore: Firestore;
  userId: string;
  requestedBy: string;
  mode: "set_max" | "add_slots";
  maxContractsAllowed?: number;
  slots?: number;
}): Promise<AdjustQuotaResult> {
  const all = await getAllEntitlementsForUser(deps.firestore, deps.userId);
  const picked = pickPlusEntitlementToAdjustQuota(all);
  if (!picked) return { ok: false, reason: "no_plus_entitlement" };

  let targetMax: number;
  if (deps.mode === "set_max") {
    const raw = deps.maxContractsAllowed;
    if (raw == null || !Number.isInteger(raw)) return { ok: false, reason: "payload" };
    targetMax = raw;
  } else {
    const s = deps.slots;
    if (s == null || !Number.isInteger(s) || s < 1) return { ok: false, reason: "payload" };
    const capped = Math.min(TESTER_PLUS_MAX_ADD_SLOTS, s);
    targetMax = picked.maxContractsAllowed + capped;
  }

  return applyTesterPlusQuotaAdjust(deps.firestore, picked, targetMax, deps.requestedBy);
}
