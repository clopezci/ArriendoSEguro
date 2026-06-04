import type { PersonParty, ResidentialLeaseContractInput } from "./types";

/**
 * Utilidades para soportar **uno o varios** codeudores solidarios de forma
 * aditiva (sin romper el flujo de un único codeudor).
 *
 * Esquema de sufijos en placeholders/variables: el primer codeudor usa las
 * claves sin sufijo (`NOMBRE_CODEUDOR`), y los siguientes `_2`, `_3`, …
 * (`NOMBRE_CODEUDOR_2`). Así los contratos y firmas existentes (un codeudor)
 * quedan idénticos.
 */

/** Lista efectiva de codeudores: prioriza `solidaryCoDebtors`; cae a `solidaryCoDebtor`. */
export function resolveCodebtors(input: ResidentialLeaseContractInput): PersonParty[] {
  if (input.solidaryCoDebtors && input.solidaryCoDebtors.length > 0) {
    return input.solidaryCoDebtors;
  }
  if (input.hasSolidaryCoDebtor && input.solidaryCoDebtor) {
    return [input.solidaryCoDebtor];
  }
  return [];
}

export function codebtorCount(input: ResidentialLeaseContractInput): number {
  return resolveCodebtors(input).length;
}

/** Sufijo de variables/placeholders para el codeudor en posición `index` (0-based). */
export function codebtorSuffix(index: number): string {
  return index === 0 ? "" : `_${index + 1}`;
}

/**
 * Repite un bloque de plantilla (con placeholders `[..._CODEUDOR]`) una vez por
 * cada codeudor, ajustando los placeholders al sufijo correspondiente. El primer
 * bloque queda igual que hoy.
 */
export function repeatCodebtorBlock(block: string, count: number): string {
  if (count <= 0) return "";
  const parts: string[] = [];
  for (let i = 0; i < count; i += 1) {
    parts.push(i === 0 ? block : block.replaceAll("_CODEUDOR]", `_CODEUDOR_${i + 1}]`));
  }
  return parts.join("\n");
}
