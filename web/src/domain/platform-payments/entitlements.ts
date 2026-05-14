import type { Firestore } from "firebase-admin/firestore";
import type { AccessEntitlement } from "./types";

/**
 * Devuelve todos los entitlements del usuario con `status === "active"`.
 * Útil para descubrir consumibles antes de que un contrato sea creado.
 */
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

/**
 * Devuelve TODOS los entitlements del usuario sin filtrar por estado.
 * Lo necesitamos para distinguir "el usuario sigue siendo Plus aunque ya
 * consumió su crédito (status: used)" de "el usuario nunca tuvo plan".
 *
 * Importante: solo filtramos por `validUntil`, no por `contractsUsed`,
 * porque un Plus consumido sigue dándole derecho a abrir y avanzar el
 * expediente que ya creó; lo único que se bloquea es la creación de
 * expedientes nuevos.
 */
export async function getAllEntitlementsForUser(
  firestore: Firestore,
  userId: string,
): Promise<AccessEntitlement[]> {
  const snap = await firestore
    .collection("access_entitlements")
    .where("userId", "==", userId)
    .get();
  return snap.docs.map((d) => d.data() as AccessEntitlement);
}

function isWithinValidity(entitlement: AccessEntitlement): boolean {
  if (!entitlement.validUntil) return true;
  const validUntil = Date.parse(entitlement.validUntil);
  if (!Number.isFinite(validUntil)) return true;
  return validUntil >= Date.now();
}

/**
 * Devuelve el entitlement Plus que el usuario puede CONSUMIR para crear
 * un contrato nuevo. Requiere `status: "active"` y créditos disponibles
 * (`contractsUsed < maxContractsAllowed`). Si un usuario ya gastó su
 * crédito, esta función devuelve `null` y se le mostrará "ya no puedes
 * crear más expedientes" al intentar crear uno nuevo.
 */
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
        e.contractsUsed < e.maxContractsAllowed &&
        isWithinValidity(e),
    ) ?? null
  );
}

/**
 * Devuelve cualquier Plus válido del usuario, incluso si su `status` ya
 * cambió a `"used"` por haber consumido todos los créditos disponibles.
 *
 * Esta es la función que debe usar el "guard" del wizard y la lista de
 * "Mis arriendos" para decidir si el usuario sigue siendo Plus y por
 * tanto puede abrir y trabajar sobre los expedientes que YA creó. Sin
 * ella el flujo se rompía así:
 *   1. Admin otorga Plus a usuario X.
 *   2. Usuario X crea su expediente; `consume-plus` deja
 *      `status: "used"` en el entitlement.
 *   3. Usuario X intenta abrir su expediente y `useDraftGuard` consulta
 *      la versión "consumible" → no encuentra nada → lo expulsa al
 *      dashboard mostrando "Pendiente de pago".
 */
export async function getAnyValidPlusEntitlementForUser(
  firestore: Firestore,
  userId: string,
): Promise<AccessEntitlement | null> {
  const all = await getAllEntitlementsForUser(firestore, userId);
  return (
    all.find(
      (e) =>
        e.planCode === "plus" &&
        e.accessType === "plus_paid" &&
        (e.status === "active" || e.status === "used") &&
        isWithinValidity(e),
    ) ?? null
  );
}

export async function getActiveDemoEntitlementForUser(
  firestore: Firestore,
  userId: string,
): Promise<AccessEntitlement | null> {
  const all = await getActiveEntitlementsForUser(firestore, userId);
  return (
    all.find(
      (e) =>
        e.planCode === "basic_demo" &&
        e.accessType === "demo" &&
        e.status === "active" &&
        isWithinValidity(e),
    ) ?? null
  );
}

/**
 * Variante de demo análoga a `getAnyValidPlusEntitlementForUser`: si en
 * el futuro el demo también consume créditos, el guard del wizard sigue
 * dejando entrar al usuario a expedientes existentes mientras la
 * vigencia siga activa.
 */
export async function getAnyValidDemoEntitlementForUser(
  firestore: Firestore,
  userId: string,
): Promise<AccessEntitlement | null> {
  const all = await getAllEntitlementsForUser(firestore, userId);
  return (
    all.find(
      (e) =>
        e.planCode === "basic_demo" &&
        e.accessType === "demo" &&
        (e.status === "active" || e.status === "used") &&
        isWithinValidity(e),
    ) ?? null
  );
}

