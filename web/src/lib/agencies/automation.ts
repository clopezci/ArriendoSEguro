import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";
import { encryptSecret, decryptSecret, secretsConfigured } from "@/lib/security/agencySecrets";
import { AGENCY_SECRETS_COLLECTION } from "@/lib/agencies/externalStudy";

/**
 * Automatización por agencia (Fase C): en vez de incrustar un motor, emitimos
 * los eventos (ej. "solicitud nueva") a un **webhook saliente** que la agencia
 * configura (su n8n / Zapier / Make / CRM). Así conectan cualquier herramienta.
 * El secreto de verificación se guarda cifrado (mismo esquema que las llaves).
 */

type StoredAutomation = { webhookUrl?: string; webhookSecretEnc?: string };

export interface AutomationPublicConfig {
  webhookUrl: string;
  hasSecret: boolean;
  secretsAvailable: boolean;
}

export async function getAutomationConfig(firestore: Firestore, agencyId: string): Promise<AutomationPublicConfig> {
  const snap = await firestore.collection(AGENCY_SECRETS_COLLECTION).doc(agencyId).get();
  const d = snap.exists ? (snap.data() as StoredAutomation) : null;
  return { webhookUrl: d?.webhookUrl ?? "", hasSecret: Boolean(d?.webhookSecretEnc), secretsAvailable: secretsConfigured() };
}

export async function setAutomationConfig(
  firestore: Firestore,
  agencyId: string,
  input: { webhookUrl?: string; webhookSecret?: string },
): Promise<{ ok: boolean; error?: string }> {
  const patch: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
  if (typeof input.webhookUrl === "string") patch.webhookUrl = input.webhookUrl.trim().slice(0, 500);
  if (typeof input.webhookSecret === "string" && input.webhookSecret.trim()) {
    if (!secretsConfigured()) return { ok: false, error: "secrets_not_configured" };
    const enc = encryptSecret(input.webhookSecret.trim());
    if (!enc) return { ok: false, error: "encrypt_failed" };
    patch.webhookSecretEnc = enc;
  }
  await firestore.collection(AGENCY_SECRETS_COLLECTION).doc(agencyId).set(patch, { merge: true });
  return { ok: true };
}

/**
 * Emite un evento al webhook de la agencia (fire-and-forget). Nunca lanza; no
 * bloquea el flujo. Si no hay URL configurada, no hace nada.
 */
export async function emitAgencyEvent(
  firestore: Firestore,
  agencyId: string,
  event: string,
  data: Record<string, unknown>,
): Promise<void> {
  try {
    const snap = await firestore.collection(AGENCY_SECRETS_COLLECTION).doc(agencyId).get();
    const cfg = snap.exists ? (snap.data() as StoredAutomation) : null;
    if (!cfg?.webhookUrl) return;
    const secret = decryptSecret(cfg.webhookSecretEnc);
    await fetch(cfg.webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json", ...(secret ? { "x-webhook-secret": secret } : {}) },
      body: JSON.stringify({ event, agencyId, at: new Date().toISOString(), data }),
      signal: AbortSignal.timeout(10_000),
    }).catch(() => {});
  } catch {
    /* best-effort */
  }
}
