import type { RenderedContract, ResidentialLeaseContractInput } from "./types";
import { renderResidentialLeaseContract } from "./renderResidentialLeaseContract";
import { renderResidentialLeaseContractV2026_2 } from "./v2026-2/renderResidentialLeaseContract";
import { isLeaseTemplate2026_2Enabled } from "./leaseTemplateFlags";

/**
 * Selecciona la plantilla según `contractVersion` y el flag de activación
 * oficial (Bloque 11).
 */
export function renderResidentialLeaseDispatch(input: ResidentialLeaseContractInput): RenderedContract {
  if (input.contractVersion === "AS-LEASE-2026.2") {
    if (!isLeaseTemplate2026_2Enabled()) {
      throw new Error(
        "La plantilla AS-LEASE-2026.2 no está habilitada en este entorno. " +
          "Configura NEXT_PUBLIC_LEASE_TEMPLATE_2026_2_ENABLED=true tras la validación legal.",
      );
    }
    return renderResidentialLeaseContractV2026_2(input);
  }
  return renderResidentialLeaseContract(input);
}
