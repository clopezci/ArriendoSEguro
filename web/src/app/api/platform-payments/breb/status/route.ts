import { NextResponse } from "next/server";
import { isBrebEnabled } from "@/domain/platform-payments/breb-checkout";
import { isWompiConfigured } from "@/domain/platform-payments/provider-factory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Indica si Bre-B está disponible como método de pago, leyendo la configuración
 * del SERVIDOR. Bre-B es un método DENTRO de la pasarela (Wompi): pagar con Bre-B
 * es transparente para el usuario (elige Bre-B en la pasarela y vuelve solo), sin
 * que se le muestre ninguna llave. Por eso el botón aparece si hay pasarela
 * configurada (Wompi) o si hay un modo Bre-B propio habilitado. Público (solo
 * devuelve un booleano, sin secretos).
 */
export function GET() {
  return NextResponse.json({ enabled: isWompiConfigured() || isBrebEnabled() });
}
