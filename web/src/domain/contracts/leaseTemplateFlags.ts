import type { ContractVersion } from "./types";

/**
 * Bloque 11: activación controlada de la plantilla `AS-LEASE-2026.2` para
 * nuevos borradores y render en servidor. El abogado debe validar el texto
 * antes de poner `true` en producción.
 *
 * Solo variable pública: el valor se inyecta en el bundle del cliente y en
 * el servidor (Vercel / `.env.local`).
 */
export function isLeaseTemplate2026_2Enabled(): boolean {
  return process.env.NEXT_PUBLIC_LEASE_TEMPLATE_2026_2_ENABLED === "true";
}

export function getDefaultLeaseContractVersion(): ContractVersion {
  return isLeaseTemplate2026_2Enabled() ? "AS-LEASE-2026.2" : "AS-LEASE-MVP-2026.1";
}
