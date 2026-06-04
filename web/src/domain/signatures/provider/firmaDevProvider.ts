/**
 * Adaptador (STUB) para **Firma.dev**.
 *
 * Está listo para implementarse cuando el fundador entregue las credenciales.
 * Mientras `FIRMA_DEV_API_KEY` no esté definida, `isConfigured()` devuelve
 * false y la factory cae al proveedor interno. Cuando lleguen las llaves:
 *
 *   1. Define en Vercel: `SIGNATURE_PROVIDER=firma_dev`, `FIRMA_DEV_API_KEY`,
 *      y (si aplica) `FIRMA_DEV_API_BASE`, `FIRMA_DEV_WEBHOOK_SECRET`.
 *   2. Implementa las llamadas HTTP marcadas con TODO usando la API de Firma.dev
 *      (crear solicitud de firma, consultar estado, descargar documento firmado).
 *   3. Cablea el webhook del proveedor a una ruta `api/signatures/firma-dev/webhook`
 *      que actualice el estado del expediente.
 *
 * Ver la guía en `web/docs/acciones-manuales-fundador.md` (§7c).
 */

import {
  SignatureProviderNotConfiguredError,
  type SignatureProvider,
  type SignatureRequestInput,
  type SignatureRequestResult,
  type SignatureProviderStatus,
} from "./types";

export interface FirmaDevConfig {
  apiKey: string;
  apiBase: string;
}

export function readFirmaDevConfig(): FirmaDevConfig | null {
  const apiKey = process.env.FIRMA_DEV_API_KEY?.trim();
  if (!apiKey) return null;
  const apiBase = process.env.FIRMA_DEV_API_BASE?.trim() || "https://api.firma.dev";
  return { apiKey, apiBase };
}

export class FirmaDevSignatureProvider implements SignatureProvider {
  readonly id = "firma_dev" as const;
  readonly isExternal = true;

  isConfigured(): boolean {
    return readFirmaDevConfig() !== null;
  }

  async createSignatureRequest(_input: SignatureRequestInput): Promise<SignatureRequestResult> {
    const config = readFirmaDevConfig();
    if (!config) throw new SignatureProviderNotConfiguredError("firma_dev");
    // TODO(firma-dev): POST a `${config.apiBase}/...` con Authorization Bearer
    // `${config.apiKey}` para crear la solicitud de firma con los firmantes y el
    // documento (input.documentUrl / input.documentHash). Devolver providerRef y
    // signingUrl por firmante.
    throw new SignatureProviderNotConfiguredError("firma_dev");
  }

  async getStatus(_providerRef: string): Promise<SignatureProviderStatus> {
    const config = readFirmaDevConfig();
    if (!config) throw new SignatureProviderNotConfiguredError("firma_dev");
    // TODO(firma-dev): GET a `${config.apiBase}/...` para consultar el estado de
    // la solicitud y mapearlo a SignatureProviderStatus.
    throw new SignatureProviderNotConfiguredError("firma_dev");
  }
}
