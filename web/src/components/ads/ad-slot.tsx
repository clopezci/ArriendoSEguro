"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HOUSE_ADS, pickHouseAd, type HouseAd } from "@/content/ads/house-ads";

type AdsMode = "house" | "adsense" | "off";
type AdsConfig = { mode: AdsMode; adClient: string; slots: Record<string, string> };

const DEFAULT_AD_CLIENT =
  process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID?.trim() || "ca-pub-7622431410037127";
const DEFAULT_CONFIG: AdsConfig = { mode: "house", adClient: DEFAULT_AD_CLIENT, slots: {} };

// Caché a nivel de módulo: una sola petición por sesión aunque haya varios slots.
let cachedPromise: Promise<AdsConfig> | null = null;
function fetchAdsConfig(): Promise<AdsConfig> {
  if (!cachedPromise) {
    cachedPromise = fetch("/api/ads-config")
      .then((r) => r.json())
      .then((j: { success?: boolean; mode?: AdsMode; adClient?: string; slots?: Record<string, string> }) =>
        j?.success
          ? {
              mode: j.mode ?? "house",
              adClient: j.adClient || DEFAULT_AD_CLIENT,
              slots: j.slots ?? {},
            }
          : DEFAULT_CONFIG,
      )
      .catch(() => DEFAULT_CONFIG);
  }
  return cachedPromise;
}

/**
 * Espacio de anuncio. Según la config de `/admin`:
 *  - "house"   → publicidad interna (tips/features de ArriendoSeguro).
 *  - "adsense" → unidad real de Google (si el placement tiene slot; si no, house).
 *  - "off"     → no muestra nada.
 */
export function AdSlot({ placement, className = "" }: { placement: string; className?: string }) {
  const [config, setConfig] = useState<AdsConfig | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;
    void fetchAdsConfig().then((c) => {
      if (!cancelled) setConfig(c);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Barrera dura: NUNCA se muestran anuncios dentro de la aplicación (/dashboard,
  // donde viven las funciones premium: firma, inventario, pagos…) ni en el portal
  // del inquilino (/panel). Los anuncios solo aparecen en páginas públicas y
  // gratuitas (blog, informativas).
  if (pathname?.startsWith("/dashboard") || pathname?.startsWith("/panel")) return null;

  if (!config || config.mode === "off") return null;

  const slotId = config.slots[placement];
  if (config.mode === "adsense" && slotId) {
    return <AdSenseUnit adClient={config.adClient} slotId={slotId} className={className} />;
  }
  return <HouseAdCard placement={placement} className={className} />;
}

function AdSenseUnit({ adClient, slotId, className }: { adClient: string; slotId: string; className: string }) {
  const pushed = useRef(false);
  useEffect(() => {
    if (pushed.current) return;
    pushed.current = true;
    try {
      const w = window as unknown as { adsbygoogle?: Array<Record<string, unknown>> };
      w.adsbygoogle = w.adsbygoogle || [];
      w.adsbygoogle.push({});
    } catch {
      /* si el script aún no cargó, Google lo procesa al terminar de cargar */
    }
  }, []);

  return (
    <div className={`my-6 ${className}`} aria-label="Publicidad">
      <p className="mb-1 text-center text-[10px] uppercase tracking-wide text-slate-400">Publicidad</p>
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={adClient}
        data-ad-slot={slotId}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}

function HouseAdCard({ placement, className }: { placement: string; className: string }) {
  // Rota entre las house ads cada ~12 s (arranca por una selección estable del placement).
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setOffset((o) => (o + 1) % HOUSE_ADS.length), 12000);
    return () => clearInterval(t);
  }, []);
  const ad: HouseAd = pickHouseAd(placement, offset);

  return (
    <aside
      className={`my-6 overflow-hidden rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-5 shadow-sm ${className}`}
      aria-label="Contenido de ArriendoSeguro"
    >
      <p className="mb-1 text-[10px] uppercase tracking-wide text-violet-400">ArriendoSeguro · {ad.tag}</p>
      <div className="flex items-start gap-3">
        <span className="text-2xl" aria-hidden>
          {ad.emoji}
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-slate-900">{ad.title}</p>
          <p className="mt-1 text-sm text-slate-600">{ad.body}</p>
          <Link
            href={ad.href}
            className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-violet-700 hover:underline"
          >
            {ad.ctaLabel} →
          </Link>
        </div>
      </div>
    </aside>
  );
}
