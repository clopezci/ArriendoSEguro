/**
 * Convención ÚNICA de "fases del viaje" de un contrato, para que el indicador de
 * progreso, el guard de posventa y la vista previa cuenten la misma historia y no
 * se contradigan.
 *
 * Fases:
 *   1. datos       — completar los datos mínimos del contrato (Bloque 1, pasos 1-9).
 *   2. robustecer  — añadir codeudores, garantía, cláusulas, etc. (opcional).
 *   3. firmar      — firma electrónica (Plan Plus).
 *   4. pdf         — descargar el contrato en PDF.
 *   5. posventa    — pagos, novedades, evidencias (tras firmar).
 *
 * Módulo PURO (sin React ni acceso a red): recibe el estado ya cargado y devuelve
 * el estado de cada fase. Testeable.
 */

export type ContractPhase = "datos" | "robustecer" | "firmar" | "pdf" | "posventa";

/** Estado visual de una fase. */
export type PhaseState = "done" | "active" | "todo" | "locked";

export const CONTRACT_PHASES: { key: ContractPhase; label: string; hint: string }[] = [
  { key: "datos", label: "1. Datos", hint: "Completa los datos mínimos del contrato." },
  { key: "robustecer", label: "2. Robustecer", hint: "Codeudores, garantía o cláusulas (opcional)." },
  { key: "firmar", label: "3. Firmar", hint: "Firma electrónica con respaldo legal (Plan Plus)." },
  { key: "pdf", label: "4. PDF", hint: "Descarga el contrato en PDF." },
  { key: "posventa", label: "5. Posventa", hint: "Pagos, novedades y evidencias tras firmar." },
];

/** Resumen mínimo de `/api/contracts/latest-version` necesario para derivar fases. */
export type JourneyLatest = {
  currentVersionId?: string | null;
  contractStatus?: string | null;
};

/** ¿El estado del contrato indica que ya está firmado (completa o totalmente)? */
export function isSignedStatus(status?: string | null): boolean {
  return status === "signed";
}

/** ¿La firma está en curso (algunas partes firmaron)? */
export function isSignatureInProgressStatus(status?: string | null): boolean {
  return (status ?? "").includes("signature");
}

/**
 * Deriva el estado de cada fase a partir de lo que ya existe en el servidor.
 * - Sin versión guardada: solo "datos" está activa; el resto bloqueado.
 * - Con versión guardada: "datos" hecha; robustecer/firmar/pdf disponibles.
 * - Firmado: "firmar" hecha; posventa disponible.
 */
export function deriveJourneyState(latest: JourneyLatest | null): Record<ContractPhase, PhaseState> {
  const saved = Boolean(latest?.currentVersionId);
  const signed = isSignedStatus(latest?.contractStatus);
  const signing = isSignatureInProgressStatus(latest?.contractStatus);

  return {
    datos: saved ? "done" : "active",
    robustecer: saved ? "todo" : "locked",
    firmar: signed ? "done" : signing ? "active" : saved ? "active" : "locked",
    pdf: saved ? "todo" : "locked",
    posventa: signed ? "todo" : "locked",
  };
}
