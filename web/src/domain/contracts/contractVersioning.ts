import type { ContractVersion, RenderedContract } from "./types";
import { generateDocumentHash } from "./hash";

export const CONTRACT_VERSION_REGISTRY: Record<ContractVersion, string> = {
  "AS-LEASE-MVP-2026.1":
    "Plantilla base de arrendamiento vivienda urbana con bloques condicionales de codeudor.",
};

export function isKnownContractVersion(version: string): version is ContractVersion {
  return Object.prototype.hasOwnProperty.call(CONTRACT_VERSION_REGISTRY, version);
}

export function getContractVersionDescription(version: string): string {
  if (isKnownContractVersion(version)) return CONTRACT_VERSION_REGISTRY[version];
  return "Versión no registrada (permitida para pruebas controladas).";
}

export function computeDocumentHash(html: string): string {
  return generateDocumentHash(html);
}

/**
 * TODO(PDF): integrar librería de generación PDF y devolver buffer/base64.
 * Se deja preparado para no bloquear el MVP documental HTML.
 */
export async function renderContractPdfFromHtml(html: string): Promise<never> {
  void html;
  throw new Error("PDF aún no implementado. TODO: integrar motor PDF.");
}

export function withDocumentHash(
  partial: Omit<RenderedContract, "documentHash">,
): RenderedContract {
  return {
    ...partial,
    documentHash: computeDocumentHash(partial.html),
  };
}

