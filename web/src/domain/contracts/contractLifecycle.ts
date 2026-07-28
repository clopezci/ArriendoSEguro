/**
 * Ciclo de vida "definitivo" de un contrato (anti-abuso del cupo Plus).
 *
 * Regla de producto:
 * - Mientras el contrato NO se ha iniciado, se puede borrar y rehacer libremente
 *   (etapa de prueba/ajuste). El cupo Plus NO se consume todavía.
 * - Al pulsar "Iniciar contrato definitivo" (tras contrato + firmas + acta), el
 *   contrato queda INICIADO y BLOQUEADO: no se puede borrar (solo el admin puede
 *   desbloquear) y se CONSUME el cupo Plus. Un nuevo contrato tendrá valor normal.
 *
 * Se guarda en una colección propia (`contract_lifecycle`, doc = contractId) para
 * no tocar el esquema de contratos/versiones.
 */

export const CONTRACT_LIFECYCLE_COLLECTION = "contract_lifecycle";

export interface ContractLifecycle {
  contractId: string;
  /** El dueño ya "inició" el contrato definitivo (queda bloqueado). */
  started: boolean;
  startedAt?: string;
  startedByUid?: string;
  /** Se consumió el cupo Plus al iniciar (para no consumirlo dos veces). */
  entitlementConsumed?: boolean;
  /** El admin lo desbloqueó (permite ajustes/borrado excepcional). */
  unlockedByAdminAt?: string;
  updatedAt?: string;
}

export function resolveContractLifecycle(contractId: string, stored: unknown): ContractLifecycle {
  const o = (typeof stored === "object" && stored !== null ? stored : {}) as Record<string, unknown>;
  const started = o.started === true && o.unlockedByAdminAt == null;
  return {
    contractId,
    started,
    startedAt: typeof o.startedAt === "string" ? o.startedAt : undefined,
    startedByUid: typeof o.startedByUid === "string" ? o.startedByUid : undefined,
    entitlementConsumed: o.entitlementConsumed === true,
    unlockedByAdminAt: typeof o.unlockedByAdminAt === "string" ? o.unlockedByAdminAt : undefined,
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : undefined,
  };
}
