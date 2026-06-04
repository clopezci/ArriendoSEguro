/**
 * Selección del proveedor de firma según configuración.
 *
 * `SIGNATURE_PROVIDER=firma_dev` activa el adaptador externo **solo si** tiene
 * credenciales; en cualquier otro caso se usa el proveedor interno (firma
 * electrónica simple, Ley 527). Así, mientras no haya llaves, nada cambia.
 */

import type { SignatureProvider, SignatureProviderId } from "./types";
import { InternalSignatureProvider } from "./internalProvider";
import { FirmaDevSignatureProvider } from "./firmaDevProvider";

export function resolveSignatureProviderId(): SignatureProviderId {
  const raw = process.env.SIGNATURE_PROVIDER?.trim().toLowerCase();
  return raw === "firma_dev" ? "firma_dev" : "internal";
}

let cached: SignatureProvider | null = null;

export function getSignatureProvider(): SignatureProvider {
  if (cached) return cached;
  const wanted = resolveSignatureProviderId();
  if (wanted === "firma_dev") {
    const firmaDev = new FirmaDevSignatureProvider();
    if (firmaDev.isConfigured()) {
      cached = firmaDev;
      return cached;
    }
    // Pedido pero sin credenciales: caemos al interno para no romper la firma.
    if (process.env.NODE_ENV !== "production") {
      console.warn("[signatures] SIGNATURE_PROVIDER=firma_dev pero faltan credenciales; usando proveedor interno.");
    }
  }
  cached = new InternalSignatureProvider();
  return cached;
}

/** Información del proveedor activo (para diagnóstico/admin). No expone secretos. */
export function getActiveSignatureProviderInfo(): { id: SignatureProviderId; isExternal: boolean; configured: boolean } {
  const p = getSignatureProvider();
  return { id: p.id, isExternal: p.isExternal, configured: p.isConfigured() };
}

/** Solo para pruebas: limpia el proveedor memorizado. */
export function __resetSignatureProviderCacheForTests(): void {
  cached = null;
}
