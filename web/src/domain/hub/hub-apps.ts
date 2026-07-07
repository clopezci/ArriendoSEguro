/**
 * Registro de aplicaciones externas que facturan a través del hub de pagos de
 * ArriendoSeguro (una sola cuenta Wompi central). Cada app tiene:
 *  - `apiKey` (secreto) para autenticar sus peticiones — se guarda HASHEADO.
 *  - `hmacSecret` para firmar el cuerpo de sus peticiones y para que la app
 *    verifique las notificaciones (webhooks) que le enviamos de vuelta.
 *  - `webhookUrl`: a dónde notificamos el estado de cada pago.
 */

import { createHash, randomBytes } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";

export const HUB_APPS_COLLECTION = "hub_apps";

export interface HubApp {
  id: string;
  name: string;
  apiKeyPrefix: string;
  apiKeyHash: string;
  hmacSecret: string;
  webhookUrl: string;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
}

/** Vista pública (sin secretos) para el panel admin. */
export type HubAppPublic = {
  id: string;
  name: string;
  apiKeyPrefix: string;
  webhookUrl: string;
  active: boolean;
  createdAt: string;
};

export function toPublicHubApp(app: HubApp): HubAppPublic {
  return {
    id: app.id,
    name: app.name,
    apiKeyPrefix: app.apiKeyPrefix,
    webhookUrl: app.webhookUrl,
    active: app.active,
    createdAt: app.createdAt,
  };
}

export function hashApiKey(plainKey: string): string {
  return createHash("sha256").update(plainKey).digest("hex");
}

/** Genera credenciales nuevas. El `apiKey`/`hmacSecret` en claro se muestran UNA vez. */
export function generateHubCredentials(): {
  apiKey: string;
  apiKeyPrefix: string;
  apiKeyHash: string;
  hmacSecret: string;
} {
  const apiKey = `hubk_${randomBytes(24).toString("hex")}`;
  const hmacSecret = `hubs_${randomBytes(24).toString("hex")}`;
  return {
    apiKey,
    apiKeyPrefix: apiKey.slice(0, 13),
    apiKeyHash: hashApiKey(apiKey),
    hmacSecret,
  };
}

/** Busca una app activa por su API key (en claro). Devuelve null si no existe/está inactiva. */
export async function getHubAppByApiKey(firestore: Firestore, plainKey: string): Promise<HubApp | null> {
  if (!plainKey) return null;
  const snap = await firestore
    .collection(HUB_APPS_COLLECTION)
    .where("apiKeyHash", "==", hashApiKey(plainKey))
    .where("active", "==", true)
    .limit(1)
    .get();
  const doc = snap.docs[0];
  return doc ? (doc.data() as HubApp) : null;
}

export async function getHubAppById(firestore: Firestore, id: string): Promise<HubApp | null> {
  const snap = await firestore.collection(HUB_APPS_COLLECTION).doc(id).get();
  return snap.exists ? (snap.data() as HubApp) : null;
}
