import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";
import { encryptSecret, decryptSecret, secretsConfigured } from "@/lib/security/agencySecrets";

/**
 * Configuración de estudio externo por agencia (DataCrédito u otro proveedor).
 * Provider-agnóstico: la agencia pone un endpoint (de su agregador o su propio
 * proxy) + su API key (cifrada) + cómo leer el score de la respuesta. La llave
 * vive en la colección aislada `agency_secrets`, SIEMPRE cifrada, nunca se
 * devuelve al cliente ni se registra.
 */

export const AGENCY_SECRETS_COLLECTION = "agency_secrets";

export interface ExternalStudyPublicConfig {
  endpoint: string;
  scorePath: string;
  hasKey: boolean;
  secretsAvailable: boolean;
}

type StoredConfig = { endpoint?: string; scorePath?: string; keyEnc?: string };

export async function getExternalConfig(firestore: Firestore, agencyId: string): Promise<ExternalStudyPublicConfig> {
  const snap = await firestore.collection(AGENCY_SECRETS_COLLECTION).doc(agencyId).get();
  const d = snap.exists ? (snap.data() as StoredConfig) : null;
  return {
    endpoint: d?.endpoint ?? "",
    scorePath: d?.scorePath ?? "score",
    hasKey: Boolean(d?.keyEnc),
    secretsAvailable: secretsConfigured(),
  };
}

export async function setExternalConfig(
  firestore: Firestore,
  agencyId: string,
  input: { endpoint?: string; scorePath?: string; apiKey?: string },
): Promise<{ ok: boolean; error?: string }> {
  const patch: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
  if (typeof input.endpoint === "string") patch.endpoint = input.endpoint.trim().slice(0, 500);
  if (typeof input.scorePath === "string") patch.scorePath = input.scorePath.trim().slice(0, 100) || "score";
  // La llave solo se toca si viene una nueva no vacía (así no se borra al editar).
  if (typeof input.apiKey === "string" && input.apiKey.trim()) {
    if (!secretsConfigured()) return { ok: false, error: "secrets_not_configured" };
    const enc = encryptSecret(input.apiKey.trim());
    if (!enc) return { ok: false, error: "encrypt_failed" };
    patch.keyEnc = enc;
  }
  await firestore.collection(AGENCY_SECRETS_COLLECTION).doc(agencyId).set(patch, { merge: true });
  return { ok: true };
}

function readPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, k) => {
    if (acc && typeof acc === "object" && k in (acc as Record<string, unknown>)) return (acc as Record<string, unknown>)[k];
    return undefined;
  }, obj);
}

/**
 * Corre el estudio externo para una cédula. Descifra la llave en el servidor,
 * hace POST { cedula } al endpoint de la agencia con header x-api-key, y lee el
 * score por `scorePath`. No lanza. La llave nunca sale de aquí.
 */
export async function runExternalStudy(
  firestore: Firestore,
  agencyId: string,
  cedula: string,
): Promise<{ available: boolean; score?: number; error?: string }> {
  const snap = await firestore.collection(AGENCY_SECRETS_COLLECTION).doc(agencyId).get();
  const cfg = snap.exists ? (snap.data() as StoredConfig) : null;
  if (!cfg?.endpoint || !cfg?.keyEnc) return { available: false, error: "not_configured" };
  const apiKey = decryptSecret(cfg.keyEnc);
  if (!apiKey) return { available: false, error: "decrypt_failed" };
  try {
    const res = await fetch(cfg.endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({ cedula: String(cedula).replace(/\D/g, "") }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return { available: false, error: `http_${res.status}` };
    const data = (await res.json()) as unknown;
    const raw = readPath(data, cfg.scorePath || "score");
    const score = typeof raw === "number" ? raw : Number(raw);
    return { available: true, score: Number.isFinite(score) ? score : undefined };
  } catch {
    return { available: false, error: "network" };
  }
}
