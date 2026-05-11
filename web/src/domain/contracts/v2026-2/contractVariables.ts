import type { ResidentialLeaseContractInput } from "../types";

/**
 * Variables específicas para la plantilla `AS-LEASE-2026.2`.
 *
 * Reutiliza el `buildContractVariables` base (que cubre arrendador, arrendatario,
 * inmueble, canon, fechas y codeudor) y agrega las nuevas claves que requiere
 * la plantilla 2026.2.
 */

import { buildContractVariables } from "../contractVariables";
import type { ContractVariableMap } from "../contractVariables";
import type { ContractType } from "../types";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const CONTRACT_TYPE_LABEL: Record<ContractType, string> = {
  VIVIENDA_URBANA: "vivienda urbana",
  VIVIENDA_RURAL: "vivienda rural",
  HABITACION: "habitación",
  COMERCIAL: "local comercial",
  RURAL_PRODUCTIVO: "inmueble rural productivo",
};

function formatContractTypeLabel(type: ContractType | undefined): string {
  if (!type) return "vivienda urbana";
  return CONTRACT_TYPE_LABEL[type] ?? "vivienda urbana";
}

function formatSpecialClauses(input: ResidentialLeaseContractInput): string {
  const sc = input.specialClauses;
  if (!sc || !sc.enabled) return "";
  const items: string[] = [];
  for (const item of sc.selected ?? []) {
    items.push(`<li>${escapeHtml(item)}</li>`);
  }
  if (sc.freeText && sc.freeText.trim().length > 0) {
    items.push(`<li>${escapeHtml(sc.freeText.trim())}</li>`);
  }
  if (items.length === 0) return "";
  return `<ol>${items.join("")}</ol>`;
}

export function buildContractVariablesV2026_2(
  input: ResidentialLeaseContractInput,
): ContractVariableMap {
  const base = buildContractVariables(input);

  const specialClausesContent = formatSpecialClauses(input);

  return {
    ...base,
    VERSION_CONTRATO: escapeHtml(String(input.contractVersion)),
    TIPO_CONTRATO_LEGIBLE: escapeHtml(formatContractTypeLabel(input.contractType)),
    DETALLE_CLAUSULAS_ESPECIALES:
      specialClausesContent ||
      "No se incorporaron cláusulas especiales en el presente contrato.",
  };
}

/**
 * Helper para evaluar si en el render 2026.2 deben aparecer los bloques
 * condicionales adicionales (cláusulas especiales y autenticación notarial).
 */
export function shouldRenderSpecialClauses(input: ResidentialLeaseContractInput): boolean {
  const sc = input.specialClauses;
  if (!sc || !sc.enabled) return false;
  const hasItems = (sc.selected ?? []).length > 0;
  const hasFreeText = Boolean(sc.freeText && sc.freeText.trim().length > 0);
  return hasItems || hasFreeText;
}

export function shouldRenderNotarization(input: ResidentialLeaseContractInput): boolean {
  return Boolean(input.notarization?.wantsNotarization);
}
