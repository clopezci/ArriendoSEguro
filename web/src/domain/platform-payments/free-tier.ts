/**
 * Configuración del "tier gratis" (crear/imprimir contrato sin costo), editable
 * por admins vía Firestore `app_settings/free_tier`.
 *
 * - `enabled`: si está activo, crear el contrato es gratis (con marca de agua) y
 *   la posventa es Plan Plus. Si se apaga, crear un contrato pasa a requerir
 *   Plan Plus (cuyo precio/promoción se maneja en `plan_plus_pricing`).
 * - `label`: etiqueta corta que ve el usuario (por defecto "Gratis por tiempo
 *   limitado").
 * - `message`: texto descriptivo del plan gratis.
 *
 * Si no existe el documento, se usa el valor por defecto (env
 * `NEXT_PUBLIC_FREE_TIER_ENABLED` para `enabled`, y textos por defecto).
 */

import type { Firestore } from "firebase-admin/firestore";
import { z } from "zod";

export const FREE_TIER_COLLECTION = "app_settings";
export const FREE_TIER_DOC_ID = "free_tier";

export const DEFAULT_FREE_TIER_LABEL = "Gratis por tiempo limitado";
export const DEFAULT_FREE_TIER_MESSAGE =
  "Crea e imprime tu contrato de arrendamiento. Sale con una marca discreta «arriendoseguro.app» y recomendaciones; es utilizable.";

export type ResolvedFreeTier = {
  enabled: boolean;
  label: string;
  message: string;
};

/** Valor por defecto de `enabled` desde la variable de entorno (compatibilidad). */
export function envDefaultFreeTierEnabled(): boolean {
  return process.env.NEXT_PUBLIC_FREE_TIER_ENABLED !== "false";
}

const storedSchema = z.object({
  enabled: z.boolean().optional(),
  label: z.string().max(60).nullable().optional(),
  message: z.string().max(400).nullable().optional(),
  updatedAt: z.string().optional(),
  updatedByEmail: z.string().optional(),
});

export function getDefaultResolvedFreeTier(): ResolvedFreeTier {
  return {
    enabled: envDefaultFreeTierEnabled(),
    label: DEFAULT_FREE_TIER_LABEL,
    message: DEFAULT_FREE_TIER_MESSAGE,
  };
}

export function resolveFreeTierFromFirestoreData(stored: unknown): ResolvedFreeTier {
  const parsed = storedSchema.safeParse(stored);
  const base = getDefaultResolvedFreeTier();
  if (!parsed.success) return base;
  return {
    enabled: typeof parsed.data.enabled === "boolean" ? parsed.data.enabled : base.enabled,
    label: parsed.data.label?.trim() || base.label,
    message: parsed.data.message?.trim() || base.message,
  };
}

export async function getResolvedFreeTier(firestore: Firestore): Promise<ResolvedFreeTier> {
  const snap = await firestore.collection(FREE_TIER_COLLECTION).doc(FREE_TIER_DOC_ID).get();
  if (!snap.exists) return getDefaultResolvedFreeTier();
  return resolveFreeTierFromFirestoreData(snap.data());
}

export async function getFreeTierForPublicPages(
  firestore: Firestore | null | undefined,
): Promise<ResolvedFreeTier> {
  if (!firestore) return getDefaultResolvedFreeTier();
  try {
    return await getResolvedFreeTier(firestore);
  } catch {
    return getDefaultResolvedFreeTier();
  }
}
