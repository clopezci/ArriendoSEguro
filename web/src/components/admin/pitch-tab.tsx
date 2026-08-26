"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";

/** Snapshot en vivo (subset del summary del panel) para "cómo vamos hoy". */
type LiveLean = {
  northStar?: number | null;
  revenue?: { total?: number; count?: number };
  engines?: { ltvCac?: number | null };
} | null | undefined;

type PitchModel = {
  headline: string;
  subtitle: string;
  pillars: { title: string; desc: string }[];
  market: { k: string; v: number; note: string }[];
  marketNote: string;
  competitors: { who: string; does: string; gap: string }[];
  moat: string;
  platformCosts: { label: string; value: string }[];
  costsNote: string;
  finance: {
    price: number;
    variableCost: number;
    infraFixed: number;
    marketing: number;
    /** Umbral de utilidad anual a partir del cual se estima impuesto de renta. */
    incomeTaxThreshold: number;
    /** Tasa (fracción, ej. 0.35) aplicada a la utilidad anual por encima del umbral. */
    incomeTaxRate: number;
  };
  scenarios: { k: string; contracts: number; color: string; infra?: number }[];
  ask: string;
};

const DEFAULTS: PitchModel = {
  headline: "Digitalizamos TODO el ciclo del arriendo directo —contrato legal, firma, pagos, inventario, reputación y cierre— fácil, con IA y a un costo mínimo ($49.900).",
  subtitle: "7,2M hogares arriendan en Colombia y la mayoría lo hace informal, sin respaldo. Democratizamos lo que hoy solo tienen las inmobiliarias. La app ya está construida: no pedimos plata para desarrollar, sino para marketing y sostener las plataformas.",
  pillars: [
    { title: "1. Todo en uno (extremo a extremo)", desc: "Del contrato al cierre, sin saltar entre apps/abogados/inmobiliarias." },
    { title: "2. Fácil + flujo progresivo + IA", desc: "Una pregunta a la vez, guiado, con IA y voz; usable por adultos mayores." },
    { title: "3. Muy bajo costo — democratizar", desc: "$49.900 por contrato vs. ~1 mes de canon de una inmobiliaria." },
  ],
  market: [
    { k: "TAM — hogares en arriendo (Colombia)", v: 7_200_000, note: "DANE ECV 2023 (40,3% de 18M)" },
    { k: "SAM — arriendo informal/directo (nuestro foco)", v: 3_600_000, note: "≈ la mitad (probablemente más)" },
    { k: "SOM — meta aspiracional (~30% del SAM)", v: 1_080_000, note: "largo plazo; hitos cercanos menores" },
  ],
  marketNote: "Solo 1% del SAM (~36.000 contratos) × $49.900 ≈ $1.795 M COP. Fuente: DANE ECV 2023.",
  competitors: [
    { who: "Inmobiliarias tradicionales", does: "Administran cobrando comisión mensual", gap: "Caras; no sirven al arrendador directo; poco digitales" },
    { who: "Generadores de contratos", does: "Generan el documento", gap: "Solo el contrato; sin firma+pagos+reputación+cierre" },
    { who: "Marketplaces (Houm, etc.)", does: "Publican y conectan inmuebles", gap: "Buscan inquilino, no gestionan el ciclo" },
    { who: "Plantillas gratis / 'a mano'", does: "Documento genérico", gap: "Sin validez, sin evidencia, sin historial" },
  ],
  moat: "Reputación privada (datos propios) + motor legal Ley 820/527 + costo marginal casi cero.",
  platformCosts: [
    { label: "Marketing (inversión principal)", value: "$1.500.000" },
    { label: "Vercel — plan base", value: "~$80.000" },
    { label: "Firebase — base (el uso por contrato va en el costo variable)", value: "$0–100.000" },
    { label: "Resend — base (el uso por contrato va en el costo variable)", value: "$0–80.000" },
  ],
  costsNote: "Los costos que crecen con el uso (Firebase, Resend, Vercel, mensajería, IA) están dentro del costo variable por contrato, así que escalan solos con el volumen. Estas líneas son la base fija mensual, que sube por escalones al cambiar de plan.",
  finance: { price: 49_900, variableCost: 6_000, infraFixed: 300_000, marketing: 1_500_000, incomeTaxThreshold: 183_000_000, incomeTaxRate: 0.35 },
  scenarios: [
    { k: "Break-even", contracts: 7, color: "#94a3b8" },
    { k: "Conservador", contracts: 50, color: "#0ea5e9" },
    { k: "Base", contracts: 200, color: "#6366f1" },
    { k: "Optimista", contracts: 800, color: "#10b981" },
    { k: "Escalón de infra", contracts: 400, color: "#f59e0b", infra: 1_200_000 },
  ],
  ask: "Fondos para marketing (hoy incipiente) + colchón de costos de plataforma durante el crecimiento (opcional: alianzas legales/seguros). No para desarrollo ni nómina técnica. Con margen de contribución ~88% y equilibrio ~41 contratos/mes incluyendo marketing, cada peso de marketing eficiente se vuelve margen.",
};

function mergeModel(saved: Partial<PitchModel> | null): PitchModel {
  if (!saved) return DEFAULTS;
  // Migración: garantiza que exista la fila de Marketing (inversión principal).
  let platformCosts = saved.platformCosts ?? DEFAULTS.platformCosts;
  if (!platformCosts.some((c) => /marketing/i.test(c.label))) {
    platformCosts = [{ label: "Marketing (inversión principal)", value: "$1.500.000" }, ...platformCosts];
  }
  // Migración de finanzas: del modelo viejo {margin, fixed} al nuevo
  // {variableCost, infraFixed, marketing}. Si venía margen, derivamos el costo
  // variable como precio × (1 − margen).
  const sf = saved.finance as
    | (Partial<PitchModel["finance"]> & { margin?: number; fixed?: number })
    | undefined;
  const price = sf?.price ?? DEFAULTS.finance.price;
  const finance: PitchModel["finance"] = {
    price,
    variableCost:
      sf?.variableCost ??
      (typeof sf?.margin === "number" ? Math.round(price * (1 - sf.margin)) : DEFAULTS.finance.variableCost),
    infraFixed: sf?.infraFixed ?? sf?.fixed ?? DEFAULTS.finance.infraFixed,
    marketing: sf?.marketing ?? DEFAULTS.finance.marketing,
    incomeTaxThreshold: sf?.incomeTaxThreshold ?? DEFAULTS.finance.incomeTaxThreshold,
    incomeTaxRate: sf?.incomeTaxRate ?? DEFAULTS.finance.incomeTaxRate,
  };
  // Migración: asegura el escenario "Escalón de infra" (con infra propia).
  let scenarios = saved.scenarios ?? DEFAULTS.scenarios;
  if (!scenarios.some((sc) => typeof sc.infra === "number")) {
    scenarios = [...scenarios, { k: "Escalón de infra", contracts: 400, color: "#f59e0b", infra: 1_200_000 }];
  }
  return {
    headline: saved.headline ?? DEFAULTS.headline,
    subtitle: saved.subtitle ?? DEFAULTS.subtitle,
    pillars: saved.pillars ?? DEFAULTS.pillars,
    market: saved.market ?? DEFAULTS.market,
    marketNote: saved.marketNote ?? DEFAULTS.marketNote,
    competitors: saved.competitors ?? DEFAULTS.competitors,
    moat: saved.moat ?? DEFAULTS.moat,
    platformCosts,
    costsNote: saved.costsNote ?? DEFAULTS.costsNote,
    finance,
    scenarios,
    ask: saved.ask ?? DEFAULTS.ask,
  };
}

/** Texto editable con DOBLE CLIC. Al salir (blur) confirma el cambio. */
function Editable({ value, onCommit, multiline = false, className = "" }: {
  value: string;
  onCommit: (v: string) => void;
  multiline?: boolean;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(() => { if (!editing) setDraft(value); }, [value, editing]);
  if (editing) {
    const commit = () => { onCommit(draft); setEditing(false); };
    return multiline ? (
      <textarea autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit} rows={3}
        className="w-full rounded-lg border-2 border-[#5646E5] p-1.5 text-sm outline-none" />
    ) : (
      <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); }}
        className="w-full rounded-lg border-2 border-[#5646E5] px-1.5 py-0.5 text-sm outline-none" />
    );
  }
  return (
    <span onDoubleClick={() => setEditing(true)} title="Doble clic para editar"
      className={`cursor-text rounded px-0.5 underline decoration-dotted decoration-slate-300 underline-offset-2 hover:bg-violet-50 ${className}`}>
      {value || <span className="italic text-slate-400">(vacío)</span>}
    </span>
  );
}

/** Número editable con doble clic. */
function EditableNum({ value, onCommit, className = "" }: { value: number; onCommit: (n: number) => void; className?: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  useEffect(() => { if (!editing) setDraft(String(value)); }, [value, editing]);
  if (editing) {
    const commit = () => { const n = Number(draft.replace(/[^\d.]/g, "")); onCommit(Number.isFinite(n) ? n : value); setEditing(false); };
    return (
      <input autoFocus inputMode="decimal" value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); }}
        className="w-24 rounded-lg border-2 border-[#5646E5] px-1.5 py-0.5 text-sm outline-none" />
    );
  }
  return (
    <span onDoubleClick={() => setEditing(true)} title="Doble clic para editar"
      className={`cursor-text rounded px-0.5 underline decoration-dotted decoration-slate-300 underline-offset-2 hover:bg-violet-50 ${className}`}>
      {value.toLocaleString("es-CO")}
    </span>
  );
}

/**
 * Campo numérico SIEMPRE visible que recalcula en vivo con cada tecla (sin doble
 * clic). Mantiene un buffer local para poder borrar/escribir con fluidez y
 * confirma el número al modelo en cada cambio, así todos los resultados
 * (contribución, equilibrio, utilidad) se actualizan al instante.
 */
function NumInput({ value, onChange, width = "w-28", prefix }: {
  value: number;
  onChange: (n: number) => void;
  width?: string;
  prefix?: string;
}) {
  const [buf, setBuf] = useState(String(value));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setBuf(String(value)); }, [value]);
  return (
    <span className="inline-flex items-center rounded border border-slate-300 bg-white focus-within:border-[#5646E5]">
      {prefix && <span className="pl-2 text-xs text-slate-400">{prefix}</span>}
      <input
        type="text"
        inputMode="numeric"
        value={buf}
        onFocus={() => { focused.current = true; }}
        onBlur={() => { focused.current = false; setBuf(String(value)); }}
        onChange={(e) => {
          const raw = e.target.value;
          setBuf(raw);
          const n = Number(raw.replace(/[^\d.-]/g, ""));
          if (Number.isFinite(n)) onChange(n);
        }}
        className={`${width} bg-transparent px-2 py-1 text-sm tabular-nums outline-none`}
      />
    </span>
  );
}

export function PitchTab({ s }: { s?: { lean?: LiveLean } }) {
  const { user } = useAuth();
  const [model, setModel] = useState<PitchModel>(DEFAULTS);
  const [status, setStatus] = useState<"" | "saving" | "saved" | "error">("");
  const [period, setPeriod] = useState<"mes" | "año">("mes");
  const [annualContracts, setAnnualContracts] = useState(200); // "contratos/mes" objetivo para el resumen anual
  const saveTimer = useRef<number | null>(null);
  const loadedRef = useRef(false);
  const lean = s?.lean;
  const cop = (v: number | null | undefined) => (v == null ? "—" : `$${Number(v).toLocaleString("es-CO")}`);

  // Carga UNA sola vez (cuando el usuario está disponible). Si `user` cambia de
  // referencia después (refresco de token, etc.), NO se vuelve a cargar, para no
  // pisar lo que estás editando en pantalla.
  useEffect(() => {
    if (!user || loadedRef.current) return;
    loadedRef.current = true;
    void (async () => {
      try {
        const res = await fetch("/api/admin/pitch-config", { headers: { ...(await buildAuthHeaders(user)) } });
        const j = (await res.json()) as { success?: boolean; model?: Partial<PitchModel> | null };
        if (res.ok && j.success) setModel(mergeModel(j.model ?? null));
      } catch { /* usa defaults */ }
    })();
  }, [user]);

  const persist = useCallback((next: PitchModel) => {
    setStatus("saving");
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      if (!user) return;
      try {
        const res = await fetch("/api/admin/pitch-config", {
          method: "PUT",
          headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
          body: JSON.stringify({ model: next }),
        });
        setStatus(res.ok ? "saved" : "error");
      } catch { setStatus("error"); }
    }, 800);
  }, [user]);

  /** Aplica un cambio al modelo (clon) y guarda. */
  const edit = useCallback((mut: (m: PitchModel) => void) => {
    setModel((prev) => {
      const next = structuredClone(prev);
      mut(next);
      persist(next);
      return next;
    });
  }, [persist]);

  const resetAll = () => { if (confirm("¿Restaurar el pitch a los valores por defecto?")) { setModel(DEFAULTS); persist(DEFAULTS); } };

  const maxMarket = Math.max(1, ...model.market.map((m) => m.v));
  const { price, variableCost, infraFixed, marketing } = model.finance;
  const contribution = Math.max(0, price - variableCost);
  const marginPct = price > 0 ? Math.round((contribution / price) * 100) : 0;
  const beWithout = contribution > 0 ? Math.ceil(infraFixed / contribution) : 0;
  const beWith = contribution > 0 ? Math.ceil((infraFixed + marketing) / contribution) : 0;
  // Vista por período: en "año" multiplicamos los flujos mensuales por 12.
  const factor = period === "año" ? 12 : 1;
  const perLabel = period === "año" ? "año" : "mes";
  // Resumen anual (P&L de 12 meses) para el nº de contratos/mes objetivo.
  const annIngreso = annualContracts * price * 12;
  const annVariable = annualContracts * variableCost * 12;
  const annInfra = infraFixed * 12;
  const annMkt = marketing * 12;
  const annUtil = annIngreso - annVariable - annInfra - annMkt;
  // Impuesto de renta estimado: solo sobre la utilidad ANUAL por encima del umbral.
  const taxThreshold = model.finance.incomeTaxThreshold;
  const taxRate = model.finance.incomeTaxRate;
  const annTax = Math.max(0, annUtil - taxThreshold) * taxRate;
  const annUtilAfterTax = annUtil - annTax;
  const rows = model.scenarios.map((sc) => {
    const infraUsed = typeof sc.infra === "number" ? sc.infra : infraFixed;
    const utilBefore = sc.contracts * contribution - infraUsed;
    const utilAfter = utilBefore - marketing;
    const loaded = sc.contracts > 0 ? Math.round(variableCost + (infraUsed + marketing) / sc.contracts) : 0;
    return { ...sc, infraUsed, utilBefore, utilAfter, loaded };
  });
  const maxUtil = Math.max(1, ...rows.map((r) => Math.max(r.utilBefore, r.utilAfter)));
  const bar = (v: number, max: number, color: string) => (
    <div className="h-4 flex-1 overflow-hidden rounded bg-slate-100">
      <div className="h-full rounded" style={{ width: `${Math.max(3, Math.round((v / max) * 100))}%`, background: color }} />
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        <span>✏️ <b>Doble clic</b> en cualquier texto o número para editarlo. Se guarda solo.</span>
        <span className="flex items-center gap-3">
          <span className="text-slate-500">{status === "saving" ? "Guardando…" : status === "saved" ? "Guardado ✓" : status === "error" ? "⚠️ no se pudo guardar" : ""}</span>
          <button type="button" onClick={resetAll} className="rounded-lg border border-slate-300 px-2 py-1 font-semibold text-slate-600 hover:bg-white">Restaurar por defecto</button>
        </span>
      </div>

      {/* Titular + subtítulo */}
      <div className="rounded-2xl border-2 border-violet-400 bg-gradient-to-r from-violet-50 to-white p-5">
        <p className="text-[11px] font-bold uppercase tracking-wide text-violet-700">Elevator pitch — ArriendoSeguro (LOTIC)</p>
        <p className="mt-1 text-lg font-extrabold text-slate-900"><Editable multiline value={model.headline} onCommit={(v) => edit((m) => { m.headline = v; })} /></p>
        <p className="mt-1 text-sm text-slate-600"><Editable multiline value={model.subtitle} onCommit={(v) => edit((m) => { m.subtitle = v; })} /></p>
      </div>

      {/* 3 pilares */}
      <div>
        <p className="mb-2 text-sm font-semibold text-slate-900">Nuestros pilares</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {model.pillars.map((p, i) => (
            <div key={i} className="rounded-xl border border-slate-300 bg-white/95 p-3">
              <p className="text-sm font-bold text-slate-900"><Editable value={p.title} onCommit={(v) => edit((m) => { m.pillars[i].title = v; })} /></p>
              <p className="mt-1 text-xs text-slate-600"><Editable multiline value={p.desc} onCommit={(v) => edit((m) => { m.pillars[i].desc = v; })} /></p>
            </div>
          ))}
        </div>
      </div>

      {/* Mercado */}
      <div className="rounded-xl border border-slate-300 bg-white/95 p-4">
        <p className="text-sm font-semibold text-slate-900">Tamaño de mercado (Colombia)</p>
        <div className="mt-3 space-y-2">
          {model.market.map((m, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 text-xs">
              <span className="w-56 shrink-0 text-slate-700"><Editable value={m.k} onCommit={(v) => edit((mm) => { mm.market[i].k = v; })} /></span>
              {bar(m.v, maxMarket, ["#6366f1", "#0ea5e9", "#10b981"][i] ?? "#8b5cf6")}
              <span className="w-24 shrink-0 text-right font-bold tabular-nums"><EditableNum value={m.v} onCommit={(n) => edit((mm) => { mm.market[i].v = n; })} /></span>
            </div>
          ))}
        </div>
        <p className="mt-3 rounded-xl border-2 border-emerald-300 bg-emerald-50 p-3 text-center text-base font-bold text-emerald-700 sm:text-lg">
          <Editable multiline value={model.marketNote} onCommit={(v) => edit((m) => { m.marketNote = v; })} />
        </p>
      </div>

      {/* KPIs en vivo */}
      {lean && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50/40 p-4">
          <p className="text-sm font-semibold text-emerald-900">Cómo vamos hoy (en vivo)</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-4">
            {[
              ["North Star (firmados)", String(lean.northStar ?? "—")],
              ["Ingresos", cop(lean.revenue?.total)],
              ["LTV / CAC", lean.engines?.ltvCac == null ? "—" : `${lean.engines.ltvCac}×`],
              ["Compras", String(lean.revenue?.count ?? 0)],
            ].map(([l, v]) => (
              <div key={l} className="rounded-lg border border-emerald-200 bg-white/80 p-3 text-center">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">{l}</p>
                <p className="mt-1 text-lg font-bold text-emerald-800">{v}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Competencia */}
      <div className="rounded-xl border border-slate-300 bg-white/95 p-4">
        <p className="text-sm font-semibold text-slate-900">Competencia y nuestra ventaja</p>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-left text-slate-500"><th className="py-1 pr-3 font-medium">Competidor</th><th className="py-1 pr-3 font-medium">Qué hace</th><th className="py-1 font-medium">Dónde no llega</th></tr></thead>
            <tbody>
              {model.competitors.map((c, i) => (
                <tr key={i} className="border-t border-slate-100 align-top">
                  <td className="py-1 pr-3 font-semibold"><Editable value={c.who} onCommit={(v) => edit((m) => { m.competitors[i].who = v; })} /></td>
                  <td className="py-1 pr-3 text-slate-600"><Editable value={c.does} onCommit={(v) => edit((m) => { m.competitors[i].does = v; })} /></td>
                  <td className="py-1 text-slate-800"><Editable value={c.gap} onCommit={(v) => edit((m) => { m.competitors[i].gap = v; })} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-slate-500"><b>Moat:</b> <Editable multiline value={model.moat} onCommit={(v) => edit((m) => { m.moat = v; })} /></p>
      </div>

      {/* Calculadora de rentabilidad (campos visibles, recalcula en vivo) */}
      <div className="rounded-xl border-2 border-violet-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-900">🧮 Calculadora de rentabilidad</p>
          <div className="inline-flex overflow-hidden rounded-lg border border-slate-300 text-xs font-semibold">
            <button type="button" onClick={() => setPeriod("mes")} className={`px-3 py-1 ${period === "mes" ? "bg-[#5646E5] text-white" : "bg-white text-slate-600"}`}>Por mes</button>
            <button type="button" onClick={() => setPeriod("año")} className={`px-3 py-1 ${period === "año" ? "bg-[#5646E5] text-white" : "bg-white text-slate-600"}`}>Por año</button>
          </div>
        </div>
        <p className="mt-0.5 text-[11px] text-slate-400">
          Cada contrato es una venta única de {cop(price)} (arriendo de ~1 año). Los ingresos y utilidades se muestran{" "}
          <b>por {perLabel}</b>; los costos fijos son mensuales{period === "año" ? " (aquí ×12)" : ""}. Cambia cualquier
          valor y todo se recalcula al instante.
        </p>

        {/* Entradas */}
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs font-medium text-slate-600">
            <span className="mb-1 block">Precio por contrato</span>
            <NumInput value={price} onChange={(n) => edit((m) => { m.finance.price = n; })} prefix="$" width="w-full" />
          </label>
          <label className="text-xs font-medium text-slate-600">
            <span className="mb-1 block">Costo variable / contrato</span>
            <NumInput value={variableCost} onChange={(n) => edit((m) => { m.finance.variableCost = n; })} prefix="$" width="w-full" />
          </label>
          <label className="text-xs font-medium text-slate-600">
            <span className="mb-1 block">Infra base / mes</span>
            <NumInput value={infraFixed} onChange={(n) => edit((m) => { m.finance.infraFixed = n; })} prefix="$" width="w-full" />
          </label>
          <label className="text-xs font-medium text-slate-600">
            <span className="mb-1 block">Marketing / mes</span>
            <NumInput value={marketing} onChange={(n) => edit((m) => { m.finance.marketing = n; })} prefix="$" width="w-full" />
          </label>
        </div>

        {/* Resultados derivados (en vivo) */}
        <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg bg-emerald-50 p-2.5">
            <p className="text-slate-500">Contribución / contrato</p>
            <p className="text-base font-bold text-emerald-700">{cop(contribution)}</p>
            <p className="text-[11px] text-slate-500">= precio − costo variable</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-2.5">
            <p className="text-slate-500">Margen de contribución</p>
            <p className="text-base font-bold text-slate-800">{marginPct}%</p>
            <p className="text-[11px] text-slate-500">= contribución ÷ precio</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-2.5">
            <p className="text-slate-500">Equilibrio sin marketing</p>
            <p className="text-base font-bold text-slate-800">{beWithout} <span className="text-xs font-normal">/mes</span></p>
            <p className="text-[11px] text-slate-500">= infra ÷ contribución</p>
          </div>
          <div className="rounded-lg bg-amber-50 p-2.5">
            <p className="text-slate-500">Equilibrio con marketing</p>
            <p className="text-base font-bold text-amber-800">{beWith} <span className="text-xs font-normal">/mes</span></p>
            <p className="text-[11px] text-slate-500">= (infra + mkt) ÷ contribución</p>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-slate-400">
          El costo variable incluye WhatsApp, SMS, IA y el uso por contrato de Firebase, Resend y Vercel; por eso crece
          con el volumen y el margen no se infla al escalar. Desarrollo y mantenimiento: $0 (fundador).
        </p>
      </div>

      {/* Escenarios (recalculan con los valores de arriba y con cada nº de contratos) */}
      <div className="rounded-xl border border-slate-300 bg-white/95 p-4">
        <p className="text-sm font-semibold text-slate-900">Utilidad por escenario <span className="font-normal text-slate-400">(por {perLabel})</span></p>
        <div className="mt-3 space-y-2.5">
          {rows.map((r, i) => {
            const stepped = r.infraUsed !== infraFixed;
            return (
              <div key={i} className={`rounded-lg border p-2.5 ${stepped ? "border-amber-200 bg-amber-50/40" : "border-slate-100"}`}>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="w-24 shrink-0 font-semibold text-slate-700"><Editable value={r.k} onCommit={(v) => edit((m) => { m.scenarios[i].k = v; })} /></span>
                  <span className="flex shrink-0 items-center gap-1 text-slate-500">
                    <NumInput value={r.contracts} onChange={(n) => edit((m) => { m.scenarios[i].contracts = n; })} width="w-16" />
                    <span>/mes{period === "año" ? ` (${(r.contracts * 12).toLocaleString("es-CO")}/año)` : ""}</span>
                  </span>
                  {bar(Math.max(0, r.utilAfter), maxUtil, r.color)}
                  <span className={`w-32 shrink-0 text-right font-bold tabular-nums ${r.utilAfter < 0 ? "text-rose-600" : "text-emerald-700"}`}>{cop(r.utilAfter * factor)}<span className="ml-0.5 text-[10px] font-normal text-slate-400">/{perLabel}</span></span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 pl-2 text-[11px] text-slate-500">
                  <span>Ingreso: {cop(r.contracts * price * factor)}/{perLabel}</span>
                  <span>· Antes de marketing: <b className="text-slate-700">{cop(r.utilBefore * factor)}</b></span>
                  <span>· Costo cargado/contrato: {cop(r.loaded)}</span>
                  <span className="flex items-center gap-1">
                    · Infra: <NumInput value={r.infraUsed} onChange={(n) => edit((m) => { m.scenarios[i].infra = n; })} width="w-20" prefix="$" />/mes
                    {stepped && <span className="rounded bg-amber-200 px-1 font-semibold text-amber-900">escalón</span>}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          Utilidad después de marketing por {perLabel} (rojo si es negativa) = (contribución × contratos − infra − marketing)
          {period === "año" ? " × 12" : ""}. El costo cargado por contrato es el mismo por mes o por año. La <b>infra</b> es
          editable por escenario: súbela para simular el <b>próximo escalón</b> de plan y ver si la utilidad sigue sana.
        </p>
      </div>

      {/* Resumen anual (P&L de 12 meses) */}
      <div className="rounded-xl border-2 border-violet-300 bg-gradient-to-br from-violet-50 to-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-900">📅 Resumen anual</p>
          <span className="flex items-center gap-1 text-xs text-slate-600">
            Objetivo:
            <NumInput value={annualContracts} onChange={(n) => setAnnualContracts(n)} width="w-16" />
            contratos/mes <span className="text-slate-400">({(annualContracts * 12).toLocaleString("es-CO")}/año)</span>
          </span>
        </div>
        <div className="mt-3 space-y-1.5 text-sm">
          <div className="flex justify-between gap-2"><span className="text-slate-600">Ingreso anual</span><b className="tabular-nums text-slate-900">{cop(annIngreso)}</b></div>
          <div className="flex justify-between gap-2"><span className="text-slate-600">− Costo variable ({annualContracts * 12} contratos)</span><span className="tabular-nums text-slate-500">−{cop(annVariable)}</span></div>
          <div className="flex justify-between gap-2"><span className="text-slate-600">− Infra base (×12)</span><span className="tabular-nums text-slate-500">−{cop(annInfra)}</span></div>
          <div className="flex justify-between gap-2"><span className="text-slate-600">− Marketing (×12)</span><span className="tabular-nums text-slate-500">−{cop(annMkt)}</span></div>
          <div className="flex items-center justify-between gap-2 border-t border-slate-200 pt-1.5">
            <span className="font-medium text-slate-700">= Utilidad antes de impuestos</span>
            <b className={`tabular-nums ${annUtil < 0 ? "text-rose-600" : "text-slate-800"}`}>{cop(annUtil)}</b>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-slate-600">
            <span className="flex flex-wrap items-center gap-1">
              − Impuesto de renta (est.): <NumInput value={Math.round(taxRate * 100)} onChange={(n) => edit((m) => { m.finance.incomeTaxRate = Math.min(1, Math.max(0, n / 100)); })} width="w-12" />%
              sobre lo que exceda
              <NumInput value={taxThreshold} onChange={(n) => edit((m) => { m.finance.incomeTaxThreshold = n; })} width="w-28" prefix="$" />/año
            </span>
            <span className="tabular-nums text-slate-500">−{cop(annTax)}</span>
          </div>
          <div className="mt-1 flex items-center justify-between gap-2 border-t-2 border-slate-200 pt-2">
            <span className="font-semibold text-slate-800">= Utilidad anual DESPUÉS de impuestos</span>
            <b className={`text-2xl tabular-nums ${annUtilAfterTax < 0 ? "text-rose-600" : "text-emerald-700"}`}>{cop(annUtilAfterTax)}</b>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          Supone {annualContracts} contratos nuevos cada mes durante 12 meses.
          {annTax === 0 && annUtil > 0 && " Aún sin impuesto: la utilidad no supera el umbral."}
          {annTax > 0 && " Ya paga impuesto: la utilidad supera el umbral."}
        </p>
        <p className="mt-1 rounded-lg bg-amber-50 p-2 text-[11px] text-amber-900">
          ⚠️ El impuesto es un <b>estimado configurable</b>, no asesoría tributaria. Como <b>persona natural</b> la renta
          es <b>progresiva por tramos</b> (marginal hasta ~39%), así que la tarifa efectiva suele ser menor al 35% (que
          es la de una empresa/SAS). <b>Confirma el umbral y la tarifa con tu contador.</b>
        </p>
      </div>

      {/* Costos de plataforma (referencia editable) */}
      <div className="rounded-xl border border-slate-300 bg-white/95 p-4">
        <p className="text-sm font-semibold text-slate-900">Costos fijos por mes (referencia)</p>
        <ul className="mt-2 space-y-1 text-xs text-slate-700">
          {model.platformCosts.map((c, i) => (
            <li key={i} className="flex justify-between gap-2">
              <span><Editable value={c.label} onCommit={(v) => edit((m) => { m.platformCosts[i].label = v; })} /></span>
              <b><Editable value={c.value} onCommit={(v) => edit((m) => { m.platformCosts[i].value = v; })} /></b>
            </li>
          ))}
        </ul>
        <p className="mt-1 text-[11px] text-slate-400"><Editable value={model.costsNote} onCommit={(v) => edit((m) => { m.costsNote = v; })} /></p>
      </div>

      {/* El ask */}
      <div className="rounded-xl border-2 border-violet-300 bg-violet-50/50 p-4">
        <p className="text-sm font-semibold text-violet-900">La inversión que buscamos</p>
        <p className="mt-1 text-xs text-slate-700"><Editable multiline value={model.ask} onCommit={(v) => edit((m) => { m.ask = v; })} /></p>
      </div>

      <p className="text-[11px] text-slate-400">
        Cambios guardados en <code>admin_config/pitch</code>. Documento completo y reutilizable en <code>docs/MODULO-INDICADORES-LEAN.md</code> (Bloque 2).
      </p>
    </div>
  );
}
