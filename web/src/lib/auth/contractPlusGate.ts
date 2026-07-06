import { NextResponse } from "next/server";
import type { Firestore } from "firebase-admin/firestore";
import { getResolvedFreeTier } from "@/domain/platform-payments/free-tier";
import {
  getAnyValidPlusEntitlementForUser,
  getAnyValidDemoEntitlementForUser,
} from "@/domain/platform-payments/entitlements";

/**
 * Gate de pago para las funciones de **posventa** (firma, inventario, pagos,
 * novedades, evidencia, reputación, alertas, soportes). Con el tier gratis
 * activo, generar el contrato es gratis pero estas funciones son Plan Plus
 * (o demo). Si el tier gratis está apagado, el flujo ya exigía Plus al crear,
 * así que no se vuelve a bloquear aquí.
 */
export async function userHasPlusOrDemo(firestore: Firestore, uid: string): Promise<boolean> {
  const [plus, demo] = await Promise.all([
    getAnyValidPlusEntitlementForUser(firestore, uid),
    getAnyValidDemoEntitlementForUser(firestore, uid),
  ]);
  return Boolean(plus || demo);
}

/** `true` si hay que bloquear: tier gratis activo y el usuario no tiene Plus/demo. */
export async function shouldBlockForPlus(firestore: Firestore, uid: string): Promise<boolean> {
  const freeTier = await getResolvedFreeTier(firestore);
  if (!freeTier.enabled) return false;
  return !(await userHasPlusOrDemo(firestore, uid));
}

/** Respuesta 402 estándar con CTA a Plus. `feature` describe la acción. */
export function plusRequiredResponse(feature = "Esta función") {
  return NextResponse.json(
    {
      success: false,
      errors: [
        {
          field: "plus_required",
          message: `${feature} es parte de Plan Plus. Actívalo en «Planes» para continuar y dejar respaldo de tu arriendo.`,
        },
      ],
    },
    { status: 402 },
  );
}
