/**
 * Configuración de anuncios, editable por admins vía Firestore `app_settings/ads`.
 *
 * - `mode`:
 *    - "house"   → publicidad interna (house ads): tips y features de
 *                  ArriendoSeguro. Es el modo por defecto y sirve MIENTRAS
 *                  Google aprueba AdSense.
 *    - "adsense" → anuncios reales de Google AdSense (requiere que cada
 *                  placement tenga su `slot` de unidad de anuncio).
 *    - "off"     → no se muestra nada.
 * - `adClient`: publisher ID (ca-pub-...). Por defecto el del sitio.
 * - `slots`: mapa placement → ID de unidad de anuncio (data-ad-slot). Se llena
 *   cuando Google aprueba y creas las unidades. Si un placement no tiene slot en
 *   modo "adsense", cae a la house ad para no dejar hueco.
 *
 * Al aprobar AdSense, el cambio es mínimo: en /admin pones `mode = adsense` y
 * pegas los slot IDs. No hay que tocar código.
 */

import type { Firestore } from "firebase-admin/firestore";
import { z } from "zod";

export const ADS_COLLECTION = "app_settings";
export const ADS_DOC_ID = "ads";

export type AdsMode = "house" | "adsense" | "off";

/** Publisher ID por defecto (público; aparece en ads.txt y el script). */
export const DEFAULT_AD_CLIENT =
  process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID?.trim() || "ca-pub-7622431410037127";

/** Placements soportados (los que colocamos en el sitio). */
export const AD_PLACEMENTS = ["blog_article", "blog_index", "content"] as const;
export type AdPlacement = (typeof AD_PLACEMENTS)[number];

export type ResolvedAdsConfig = {
  mode: AdsMode;
  adClient: string;
  slots: Record<string, string>;
};

const storedSchema = z.object({
  mode: z.enum(["house", "adsense", "off"]).optional(),
  adClient: z.string().max(60).nullable().optional(),
  slots: z.record(z.string(), z.string()).optional(),
  updatedAt: z.string().optional(),
  updatedByEmail: z.string().optional(),
});

export function getDefaultAdsConfig(): ResolvedAdsConfig {
  return { mode: "house", adClient: DEFAULT_AD_CLIENT, slots: {} };
}

export function resolveAdsConfigFromFirestoreData(stored: unknown): ResolvedAdsConfig {
  const parsed = storedSchema.safeParse(stored);
  const base = getDefaultAdsConfig();
  if (!parsed.success) return base;
  const client = parsed.data.adClient?.trim();
  const slots: Record<string, string> = {};
  for (const [k, v] of Object.entries(parsed.data.slots ?? {})) {
    const val = String(v ?? "").trim();
    if (val) slots[k] = val;
  }
  return {
    mode: parsed.data.mode ?? base.mode,
    adClient: client && /^ca-pub-\d{10,}$/i.test(client) ? client : base.adClient,
    slots,
  };
}

export async function getResolvedAdsConfig(firestore: Firestore): Promise<ResolvedAdsConfig> {
  const snap = await firestore.collection(ADS_COLLECTION).doc(ADS_DOC_ID).get();
  if (!snap.exists) return getDefaultAdsConfig();
  return resolveAdsConfigFromFirestoreData(snap.data());
}

export async function getAdsConfigForPublicPages(
  firestore: Firestore | null | undefined,
): Promise<ResolvedAdsConfig> {
  if (!firestore) return getDefaultAdsConfig();
  try {
    return await getResolvedAdsConfig(firestore);
  } catch {
    return getDefaultAdsConfig();
  }
}
