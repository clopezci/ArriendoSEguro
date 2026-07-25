import { NextResponse } from "next/server";
import { isBrebEnabled } from "@/domain/platform-payments/breb-checkout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Indica si Bre-B está disponible como método de pago, leyendo la configuración
 * del SERVIDOR (BREB_LLAVE / proveedor). Así el botón de Bre-B no depende de una
 * variable pública de build (NEXT_PUBLIC_*), que puede fallar si se marca como
 * "Sensitive" en Vercel. Público (solo devuelve un booleano, sin secretos).
 */
export function GET() {
  return NextResponse.json({ enabled: isBrebEnabled() });
}
