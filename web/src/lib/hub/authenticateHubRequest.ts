import type { Firestore } from "firebase-admin/firestore";
import { getHubAppByApiKey, type HubApp } from "@/domain/hub/hub-apps";
import { verifyHubSignature } from "@/domain/hub/hub-signature";

/**
 * Autentica una petición de una app externa al hub:
 *  - `x-hub-key`: API key (en claro) de la app.
 *  - `x-hub-timestamp`: milisegundos (anti-replay).
 *  - `x-hub-signature`: HMAC-SHA256 de `${timestamp}.${rawBody}` con el hmacSecret.
 */
export async function authenticateHubRequest(
  firestore: Firestore,
  request: Request,
  rawBody: string,
  nowMs: number,
): Promise<{ ok: true; app: HubApp } | { ok: false; status: number; message: string }> {
  const apiKey = request.headers.get("x-hub-key") ?? "";
  const timestamp = request.headers.get("x-hub-timestamp") ?? "";
  const signature = request.headers.get("x-hub-signature") ?? "";
  if (!apiKey || !timestamp || !signature) {
    return { ok: false, status: 401, message: "Faltan credenciales (x-hub-key / x-hub-timestamp / x-hub-signature)." };
  }
  const app = await getHubAppByApiKey(firestore, apiKey);
  if (!app) return { ok: false, status: 401, message: "API key inválida o aplicación inactiva." };
  const v = verifyHubSignature({ secret: app.hmacSecret, timestamp, rawBody, signature, nowMs });
  if (!v.valid) return { ok: false, status: 401, message: `Firma inválida (${v.reason}).` };
  return { ok: true, app };
}
