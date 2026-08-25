"use client";

import { useMemo, useState } from "react";

/**
 * Generador de enlaces con UTMs para campañas. Sin backend: arma la URL con los
 * parámetros que GA4 lee para clasificar el tráfico por fuente/medio/campaña, y
 * la copia al portapapeles. Pensado para no equivocarse escribiéndolos a mano.
 */

const BASE_URL = "https://arriendoseguro.app";

// Presets de "medio" según de dónde venga el clic (lo que GA4 usa para el canal).
const SOURCES: { id: string; label: string; source: string; medium: string; hint: string }[] = [
  { id: "fb_paid", label: "Facebook — anuncio pagado", source: "facebook", medium: "paid", hint: "Cae en “Paid Social”" },
  { id: "ig_paid", label: "Instagram — anuncio pagado", source: "instagram", medium: "paid", hint: "Cae en “Paid Social”" },
  { id: "fb_org", label: "Facebook — post gratis", source: "facebook", medium: "social", hint: "Cae en “Organic Social”" },
  { id: "ig_org", label: "Instagram — post gratis", source: "instagram", medium: "social", hint: "Cae en “Organic Social”" },
  { id: "google_paid", label: "Google Ads (manual)", source: "google", medium: "cpc", hint: "Normalmente Google Ads se autoetiqueta; usa esto solo si no vinculaste GA4" },
  { id: "whatsapp", label: "WhatsApp / mensaje", source: "whatsapp", medium: "referral", hint: "Para links que mandas por chat" },
  { id: "otro", label: "Otro (manual)", source: "", medium: "", hint: "Escribe fuente y medio a mano" },
];

const DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g");

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

export function UtmBuilder() {
  const [preset, setPreset] = useState(SOURCES[0]);
  const [campaign, setCampaign] = useState("lanzamiento_agosto");
  const [customSource, setCustomSource] = useState("");
  const [customMedium, setCustomMedium] = useState("");
  const [path, setPath] = useState("/");
  const [content, setContent] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const source = preset.id === "otro" ? slugify(customSource) : preset.source;
  const medium = preset.id === "otro" ? slugify(customMedium) : preset.medium;
  const campaignSlug = slugify(campaign);

  const url = useMemo(() => {
    const p = new URLSearchParams();
    if (source) p.set("utm_source", source);
    if (medium) p.set("utm_medium", medium);
    if (campaignSlug) p.set("utm_campaign", campaignSlug);
    if (content.trim()) p.set("utm_content", slugify(content));
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    const qs = p.toString();
    return `${BASE_URL}${cleanPath}${qs ? `?${qs}` : ""}`;
  }, [source, medium, campaignSlug, content, path]);

  const ready = Boolean(source && medium && campaignSlug);

  async function copy(text: string, tag: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(tag);
      setTimeout(() => setCopied((c) => (c === tag ? null : c)), 1800);
    } catch {
      setCopied("error");
    }
  }

  // Paquete rápido: los 3 enlaces más comunes con la campaña actual.
  const quickLinks = useMemo(() => {
    const mk = (src: string, med: string) => {
      const p = new URLSearchParams();
      p.set("utm_source", src);
      p.set("utm_medium", med);
      if (campaignSlug) p.set("utm_campaign", campaignSlug);
      return `${BASE_URL}/?${p.toString()}`;
    };
    return [
      { label: "Facebook pagado", url: mk("facebook", "paid") },
      { label: "Instagram pagado", url: mk("instagram", "paid") },
      { label: "Post gratis (FB/IG)", url: mk("facebook", "social") },
    ];
  }, [campaignSlug]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-violet-200 bg-violet-50/40 p-4">
        <h3 className="text-sm font-bold text-violet-900">🔗 Generador de enlaces de campaña (UTM)</h3>
        <p className="mt-1 text-xs text-slate-600">
          Arma el enlace etiquetado para que el tablero (GA4) sepa de dónde llegó cada persona y a
          qué campaña. Copia el enlace y úsalo como destino del anuncio o del post.
        </p>
      </div>

      {/* Constructor */}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">¿De dónde viene el clic?</span>
          <select
            value={preset.id}
            onChange={(e) => setPreset(SOURCES.find((s) => s.id === e.target.value) ?? SOURCES[0])}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {SOURCES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-[11px] text-slate-400">{preset.hint}</span>
        </label>

        <label className="block">
          <span className="text-xs font-semibold text-slate-500">Nombre de la campaña</span>
          <input
            value={campaign}
            onChange={(e) => setCampaign(e.target.value)}
            placeholder="lanzamiento_agosto"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <span className="mt-1 block text-[11px] text-slate-400">
            Se limpia solo: <code>{campaignSlug || "—"}</code>
          </span>
        </label>

        {preset.id === "otro" && (
          <>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500">Fuente (utm_source)</span>
              <input
                value={customSource}
                onChange={(e) => setCustomSource(e.target.value)}
                placeholder="tiktok, boletin, aliado…"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500">Medio (utm_medium)</span>
              <input
                value={customMedium}
                onChange={(e) => setCustomMedium(e.target.value)}
                placeholder="paid, social, email, referral…"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </>
        )}

        <label className="block">
          <span className="text-xs font-semibold text-slate-500">Página de destino (opcional)</span>
          <input
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="/"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <span className="mt-1 block text-[11px] text-slate-400">Ej: <code>/</code>, <code>/blog</code>, <code>/plantillas</code></span>
        </label>

        <label className="block">
          <span className="text-xs font-semibold text-slate-500">Variante (opcional, utm_content)</span>
          <input
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="video_a, imagen_b…"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <span className="mt-1 block text-[11px] text-slate-400">Para comparar 2 anuncios de la misma campaña</span>
        </label>
      </div>

      {/* Resultado */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <span className="text-xs font-semibold text-slate-500">Tu enlace</span>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
          <code className="flex-1 break-all rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-800">{url}</code>
          <button
            type="button"
            onClick={() => copy(url, "main")}
            disabled={!ready}
            className="shrink-0 rounded-lg bg-[#5646E5] px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
          >
            {copied === "main" ? "¡Copiado! ✓" : "Copiar"}
          </button>
        </div>
        {!ready && (
          <p className="mt-2 text-[11px] text-rose-500">Completa fuente, medio y nombre de campaña.</p>
        )}
      </div>

      {/* Paquete rápido */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <h4 className="text-xs font-bold uppercase text-slate-500">
          Paquete rápido para “{campaignSlug || "campaña"}”
        </h4>
        <p className="mt-1 text-[11px] text-slate-400">Los 3 enlaces más usados, listos para copiar.</p>
        <ul className="mt-3 space-y-2">
          {quickLinks.map((q) => (
            <li key={q.label} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
              <span className="w-40 shrink-0 text-xs font-semibold text-slate-600">{q.label}</span>
              <code className="flex-1 break-all rounded bg-slate-50 px-2 py-1 text-[11px] text-slate-700">{q.url}</code>
              <button
                type="button"
                onClick={() => copy(q.url, q.label)}
                className="shrink-0 rounded-md border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-[#5646E5] hover:text-violet-800"
              >
                {copied === q.label ? "✓" : "Copiar"}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Ayuda */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 text-xs text-slate-700">
        <p className="font-semibold text-amber-900">¿Dónde pego esto en Facebook?</p>
        <p className="mt-1">
          Al crear o <strong>Impulsar</strong> el anuncio, usa este enlace completo como
          <strong> destino/sitio web</strong>. (También puedes pegar solo lo que va después del
          <code> ? </code> en el campo <strong>“Parámetros de URL”</strong>.) Luego, en el tablero
          <strong> Lean → canales</strong>, verás cuánta gente llegó por cada fuente y campaña.
        </p>
        <p className="mt-2 text-amber-800">
          Nota: para que estos datos aparezcan, GA4 debe estar conectado y la cuenta de servicio
          agregada como “Lector” en la propiedad GA4.
        </p>
      </div>
    </div>
  );
}
