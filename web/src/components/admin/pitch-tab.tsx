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
  unitEconomics: { label: string; value: string }[];
  platformCosts: { label: string; value: string }[];
  costsNote: string;
  finance: { price: number; margin: number; fixed: number };
  scenarios: { k: string; contracts: number; color: string }[];
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
  unitEconomics: [
    { label: "Precio por contrato", value: "$49.900" },
    { label: "Costo variable / contrato (est.)", value: "~$3.000–6.000" },
    { label: "Margen bruto", value: "~88%" },
    { label: "Desarrollo y mantenimiento", value: "$0 (fundador)" },
  ],
  platformCosts: [
    { label: "Marketing (inversión principal)", value: "~$1.500.000" },
    { label: "Vercel (hosting)", value: "~$80.000" },
    { label: "Firebase (DB/Storage/Auth)", value: "$0–100.000" },
    { label: "Resend (correo)", value: "$0–80.000" },
    { label: "WhatsApp/Meta + IA", value: "variable" },
    { label: "Total mensual (con marketing)", value: "~$1,7M–$2,2M" },
  ],
  costsNote: "Estimado — ajustar con cifras reales.",
  finance: { price: 49_900, margin: 0.88, fixed: 300_000 },
  scenarios: [
    { k: "Break-even", contracts: 7, color: "#94a3b8" },
    { k: "Conservador", contracts: 50, color: "#0ea5e9" },
    { k: "Base", contracts: 200, color: "#6366f1" },
    { k: "Optimista", contracts: 800, color: "#10b981" },
  ],
  ask: "Fondos para marketing (hoy incipiente) + colchón de costos de plataforma durante el crecimiento (opcional: alianzas legales/seguros). No para desarrollo ni nómina técnica. Con margen ~88% y break-even ~7 contratos/mes, cada peso de marketing eficiente se vuelve margen; el LTV/CAC del tablero guía la reinversión.",
};

function mergeModel(saved: Partial<PitchModel> | null): PitchModel {
  if (!saved) return DEFAULTS;
  // Migración: garantiza que exista la fila de Marketing (inversión principal).
  let platformCosts = saved.platformCosts ?? DEFAULTS.platformCosts;
  if (!platformCosts.some((c) => /marketing/i.test(c.label))) {
    platformCosts = [{ label: "Marketing (inversión principal)", value: "~$1.500.000" }, ...platformCosts];
  }
  return {
    headline: saved.headline ?? DEFAULTS.headline,
    subtitle: saved.subtitle ?? DEFAULTS.subtitle,
    pillars: saved.pillars ?? DEFAULTS.pillars,
    market: saved.market ?? DEFAULTS.market,
    marketNote: saved.marketNote ?? DEFAULTS.marketNote,
    competitors: saved.competitors ?? DEFAULTS.competitors,
    moat: saved.moat ?? DEFAULTS.moat,
    unitEconomics: saved.unitEconomics ?? DEFAULTS.unitEconomics,
    platformCosts,
    costsNote: saved.costsNote ?? DEFAULTS.costsNote,
    finance: saved.finance ?? DEFAULTS.finance,
    scenarios: saved.scenarios ?? DEFAULTS.scenarios,
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

export function PitchTab({ s }: { s?: { lean?: LiveLean } }) {
  const { user } = useAuth();
  const [model, setModel] = useState<PitchModel>(DEFAULTS);
  const [status, setStatus] = useState<"" | "saving" | "saved" | "error">("");
  const saveTimer = useRef<number | null>(null);
  const lean = s?.lean;
  const cop = (v: number | null | undefined) => (v == null ? "—" : `$${Number(v).toLocaleString("es-CO")}`);

  useEffect(() => {
    if (!user) return;
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
  const rows = model.scenarios.map((sc) => {
    const ingreso = sc.contracts * model.finance.price;
    const bruto = Math.round(ingreso * model.finance.margin);
    return { ...sc, ingreso, bruto, utilidad: bruto - model.finance.fixed };
  });
  const maxUtil = Math.max(1, ...rows.map((r) => r.utilidad));
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
        <p className="mt-2 text-[11px] text-slate-500"><Editable multiline value={model.marketNote} onCommit={(v) => edit((m) => { m.marketNote = v; })} /></p>
      </div>

      {/* KPIs en vivo */}
      {lean && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50/40 p-4">
          <p className="text-sm font-semibold text-emerald-900">Cómo vamos hoy (en vivo, del tablero)</p>
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

      {/* Unit economics + costos */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-300 bg-white/95 p-4">
          <p className="text-sm font-semibold text-slate-900">Unit economics</p>
          <ul className="mt-2 space-y-1 text-xs text-slate-700">
            {model.unitEconomics.map((u, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span><Editable value={u.label} onCommit={(v) => edit((m) => { m.unitEconomics[i].label = v; })} /></span>
                <b><Editable value={u.value} onCommit={(v) => edit((m) => { m.unitEconomics[i].value = v; })} /></b>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-slate-300 bg-white/95 p-4">
          <p className="text-sm font-semibold text-slate-900">Costos de plataforma (est. / mes)</p>
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
      </div>

      {/* Proyección */}
      <div className="rounded-xl border border-slate-300 bg-white/95 p-4">
        <p className="text-sm font-semibold text-slate-900">Proyección (escenarios ilustrativos)</p>
        <p className="text-[11px] text-slate-500">
          Precio $<EditableNum value={model.finance.price} onCommit={(n) => edit((m) => { m.finance.price = n; })} /> ·
          margen <EditableNum value={Math.round(model.finance.margin * 100)} onCommit={(n) => edit((m) => { m.finance.margin = Math.min(1, Math.max(0, n / 100)); })} />% ·
          costos fijos $<EditableNum value={model.finance.fixed} onCommit={(n) => edit((m) => { m.finance.fixed = n; })} />/mes.
        </p>
        <div className="mt-3 space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 text-xs">
              <span className="w-24 shrink-0 font-semibold text-slate-700"><Editable value={r.k} onCommit={(v) => edit((m) => { m.scenarios[i].k = v; })} /></span>
              <span className="w-24 shrink-0 tabular-nums text-slate-500"><EditableNum value={r.contracts} onCommit={(n) => edit((m) => { m.scenarios[i].contracts = n; })} />/mes</span>
              {bar(Math.max(0, r.utilidad), maxUtil, r.color)}
              <span className="w-28 shrink-0 text-right font-bold tabular-nums">{cop(r.utilidad)}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-slate-500">Utilidad = ingreso × margen − costos fijos. Cifras ilustrativas; validar con el tablero.</p>
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
