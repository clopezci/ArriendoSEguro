/**
 * Proveedor de firma **interno** (el actual): firma electrónica simple con
 * token + OTP por correo + evidencia (Ley 527 de 1999 y Decreto 2364 de 2012).
 *
 * El flujo real lo manejan las rutas `api/signatures/*` y las colecciones de
 * Firestore. Este adaptador existe para que el resto del código pueda hablar
 * con "un proveedor" de forma uniforme. Por eso `createSignatureRequest`
 * devuelve una referencia interna y `getStatus` indica que el estado vive en el
 * flujo interno (no en un tercero).
 */

import type {
  SignatureProvider,
  SignatureRequestInput,
  SignatureRequestResult,
  SignatureProviderStatus,
} from "./types";

export class InternalSignatureProvider implements SignatureProvider {
  readonly id = "internal" as const;
  readonly isExternal = false;

  isConfigured(): boolean {
    return true; // el flujo interno siempre está disponible
  }

  async createSignatureRequest(input: SignatureRequestInput): Promise<SignatureRequestResult> {
    // El flujo interno genera sus propios tokens por firmante en
    // `api/signatures/start`. Aquí solo devolvemos una referencia estable.
    return {
      providerRef: `internal:${input.contractVersionId}`,
      signers: input.signers.map((s) => ({ party: s.party })),
    };
  }

  async getStatus(providerRef: string): Promise<SignatureProviderStatus> {
    // El estado real se consulta en el flujo interno (Firestore), no aquí.
    return { providerRef, status: "in_progress", signers: [] };
  }
}
