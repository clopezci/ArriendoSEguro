/**
 * Feature flag del **directorio de reputación** (consulta entre usuarios
 * registrados). Apagado por defecto: se activa con
 * `NEXT_PUBLIC_REPUTATION_DIRECTORY_ENABLED=true` SOLO tras el visto bueno del
 * abogado (revisión Habeas Data, Ley 1581 de 2012 y posible Ley 1266 de 2008).
 *
 * Mismo patrón que la plantilla de contrato 2026.2 (activación diferida por
 * validación legal). Ver docs/REPUTACION-DIRECTORIO.md.
 */
export function isReputationDirectoryEnabled(): boolean {
  return process.env.NEXT_PUBLIC_REPUTATION_DIRECTORY_ENABLED === "true";
}

/** Versión de la política/autorización aceptada (para evidencia Habeas Data). */
export const REPUTATION_DIRECTORY_POLICY_VERSION = "2026-07-directorio-v1";
