import {
  CLAUSULA_CODEUDOR,
  COMPARECENCIA_CODEUDOR,
  CONTRACT_TEMPLATE,
  FIRMA_CODEUDOR,
  NOTIFICACION_CODEUDOR,
  wrapContractHtml,
} from "./contractClauses";
import { buildContractVariables, injectVariables } from "./contractVariables";
import { getContractVersionDescription, withDocumentHash } from "./contractVersioning";
import type { RenderedContract, ResidentialLeaseContractInput } from "./types";
import { validateContractData } from "./validateContractData";

function withConditionalBlocks(template: string, hasCodebtor: boolean): string {
  return template
    .replaceAll("[COMPARECENCIA_CODEUDOR_CONDICIONAL]", hasCodebtor ? COMPARECENCIA_CODEUDOR : "")
    .replaceAll("[CLAUSULA_CODEUDOR_CONDICIONAL]", hasCodebtor ? CLAUSULA_CODEUDOR : "")
    .replaceAll("[NOTIFICACION_CODEUDOR_CONDICIONAL]", hasCodebtor ? NOTIFICACION_CODEUDOR : "")
    .replaceAll("[FIRMA_CODEUDOR_CONDICIONAL]", hasCodebtor ? FIRMA_CODEUDOR : "");
}

/**
 * Genera HTML del contrato base (vivienda urbana) con bloques condicionales para codeudor.
 * - No firma ni emite PDF en esta capa (solo preparado).
 * - Retorna hash SHA-256 del HTML final para trazabilidad documental.
 */
export function renderResidentialLeaseContract(
  input: ResidentialLeaseContractInput,
): RenderedContract {
  const validation = validateContractData(input);
  if (!validation.ok) {
    const summary = validation.issues.map((i) => `${i.field}: ${i.message}`).join(" | ");
    throw new Error(`No se pudo generar contrato: ${summary}`);
  }

  const templated = withConditionalBlocks(CONTRACT_TEMPLATE, input.hasSolidaryCoDebtor);
  const vars = buildContractVariables(input);
  const body = injectVariables(templated, vars);
  const title = `Contrato ${input.contractVersion} - Arriendo Seguro`;
  const html = wrapContractHtml(body, title);

  return withDocumentHash({
    html,
    version: input.contractVersion,
    generatedAt: input.generatedAt,
    legalFramework: [
      "VIVIENDA_URBANA_CO",
      "TRATAMIENTO_DATOS_CO",
      "FIRMA_ELECTRONICA_CO",
    ],
  });
}

export function getContractRenderSummary(input: ResidentialLeaseContractInput): string {
  return [
    `Versión: ${input.contractVersion}`,
    `Descripción: ${getContractVersionDescription(input.contractVersion)}`,
    `Codeudor solidario: ${input.hasSolidaryCoDebtor ? "sí" : "no"}`,
  ].join("\n");
}

/**
 * TODO(Firma): integrar evento de firma electrónica real y reemplazar placeholders.
 * TODO(PDF): consumir renderContractPdfFromHtml() desde contractVersioning.ts cuando se instale librería.
 * TODO(Bitácora): persistir hash, IP, userAgent y timestamp de firma por cada firmante.
 */

