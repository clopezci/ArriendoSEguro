import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { getAdminFirestore } from "@/lib/firebase/admin";
import {
  getActiveDemoEntitlementForUser,
  getActivePlusEntitlementForUser,
  getAnyValidDemoEntitlementForUser,
  getAnyValidPlusEntitlementForUser,
} from "@/domain/platform-payments/entitlements";

export const runtime = "nodejs";

/**
 * Devuelve el estado de acceso del usuario autenticado.
 *
 * - `plusActive` / `demoActive`: el usuario tiene el plan VIGENTE (puede
 *   abrir expedientes que ya tenga, ver el contrato, generar PDF, etc.).
 *   Incluye los casos en los que el entitlement quedó en `status: "used"`
 *   después de haber consumido todos sus créditos: el plan sigue
 *   existiendo, simplemente ya no permite crear nuevos expedientes.
 * - `canCreateRealContract` / `canUseDemo`: el usuario puede CREAR un
 *   expediente nuevo (queda crédito por consumir).
 *
 * Esta separación es clave para que el guard del wizard
 * (`useDraftGuard`) y la pantalla de "Mis arriendos" no expulsen al
 * usuario que ya creó un expediente con su Plan Plus.
 */
export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;
  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json(
      { success: false, errors: [{ field: "server", message: "Firestore/Firebase Admin no configurado." }] },
      { status: 503 },
    );
  }

  try {
    const [plusValid, demoValid, plusConsumable, demoConsumable] = await Promise.all([
      getAnyValidPlusEntitlementForUser(firestore, auth.user.uid),
      getAnyValidDemoEntitlementForUser(firestore, auth.user.uid),
      getActivePlusEntitlementForUser(firestore, auth.user.uid),
      getActiveDemoEntitlementForUser(firestore, auth.user.uid),
    ]);
    return NextResponse.json({
      success: true,
      plusActive: Boolean(plusValid),
      demoActive: Boolean(demoValid),
      plusEntitlement: plusValid,
      demoEntitlement: demoValid,
      canCreateRealContract: Boolean(plusConsumable),
      canUseDemo: Boolean(demoConsumable),
    });
  } catch {
    return NextResponse.json(
      { success: false, errors: [{ field: "server", message: "No se pudo consultar accesos." }] },
      { status: 500 },
    );
  }
}

