import { injectVariables } from "../contractVariables";
import { withDocumentHash } from "../contractVersioning";
import type { RenderedContract, ResidentialLeaseContractInput } from "../types";
import { validateContractData } from "../validateContractData";
import {
  CLAUSULA_CODEUDOR_V2026_2,
  CLAUSULA_ESPECIALES_V2026_2,
  CLAUSULA_NOTARIZACION_V2026_2,
  COMPARECENCIA_CODEUDOR_V2026_2,
  CONTRACT_TEMPLATE_V2026_2,
  FIRMA_CODEUDOR_V2026_2,
  NOTIFICACION_CODEUDOR_V2026_2,
  wrapContractHtmlV2026_2,
} from "./contractClauses";
import {
  buildContractVariablesV2026_2,
  shouldRenderNotarization,
  shouldRenderSpecialClauses,
} from "./contractVariables";
import { buildUtilityGuaranteeBlock } from "../renderResidentialLeaseContract";

/**
 * Aplica los bloques condicionales propios de la versión 2026.2.
 * - Codeudor: si `hasSolidaryCoDebtor`.
 * - Cláusulas especiales: si `specialClauses.enabled` y hay contenido.
 * - Autenticación notarial: si `notarization.wantsNotarization`.
 */
function withConditionalBlocksV2026_2(
  template: string,
  input: ResidentialLeaseContractInput,
): string {
  const hasCodebtor = input.hasSolidaryCoDebtor;
  const hasSpecial = shouldRenderSpecialClauses(input);
  const hasNotarization = shouldRenderNotarization(input);

  return template
    .replaceAll(
      "[COMPARECENCIA_CODEUDOR_CONDICIONAL]",
      hasCodebtor ? COMPARECENCIA_CODEUDOR_V2026_2 : "",
    )
    .replaceAll(
      "[CLAUSULA_CODEUDOR_CONDICIONAL]",
      hasCodebtor ? CLAUSULA_CODEUDOR_V2026_2 : "",
    )
    .replaceAll(
      "[NOTIFICACION_CODEUDOR_CONDICIONAL]",
      hasCodebtor ? NOTIFICACION_CODEUDOR_V2026_2 : "",
    )
    .replaceAll(
      "[FIRMA_CODEUDOR_CONDICIONAL]",
      hasCodebtor ? FIRMA_CODEUDOR_V2026_2 : "",
    )
    .replaceAll(
      "[CLAUSULA_ESPECIALES_CONDICIONAL]",
      hasSpecial ? CLAUSULA_ESPECIALES_V2026_2 : "",
    )
    .replaceAll(
      "[CLAUSULA_NOTARIZACION_CONDICIONAL]",
      hasNotarization ? CLAUSULA_NOTARIZACION_V2026_2 : "",
    )
    .replaceAll(
      "[GARANTIA_SERVICIOS_PUBLICOS_CONDICIONAL]",
      buildUtilityGuaranteeBlock(input),
    );
}

/**
 * Render del contrato bajo la plantilla `AS-LEASE-2026.2`.
 *
 * Importante: el render se invoca desde `renderResidentialLeaseDispatch` cuando
 * el flag `NEXT_PUBLIC_LEASE_TEMPLATE_2026_2_ENABLED` está en `true` y el payload
 * trae `contractVersion: "AS-LEASE-2026.2"`.
 */
export function renderResidentialLeaseContractV2026_2(
  input: ResidentialLeaseContractInput,
): RenderedContract {
  const validation = validateContractData(input);
  if (!validation.ok) {
    const summary = validation.issues.map((i) => `${i.field}: ${i.message}`).join(" | ");
    throw new Error(`No se pudo generar contrato 2026.2: ${summary}`);
  }

  const templated = withConditionalBlocksV2026_2(CONTRACT_TEMPLATE_V2026_2, input);
  const vars = buildContractVariablesV2026_2(input);
  const body = injectVariables(templated, vars);
  const title = `Contrato ${input.contractVersion} - Arriendo Seguro`;
  const html = wrapContractHtmlV2026_2(body, title);

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
