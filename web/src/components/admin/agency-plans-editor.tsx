"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";

type Plan = { code?: string; name: string; credits: number; priceCop: number; active: boolean };

export function AgencyPlansEditor() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/agency-plans", { headers: { ...(await buildAuthHeaders(user)) } });
      const json = (await res.json()) as { success?: boolean; plans?: Plan[] };
      if (json?.success) setPlans(json.plans ?? []);
    } catch {
      /* noop */
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  function upd(i: number, patch: Partial<Plan>) {
    setPlans((p) => p.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }

  async function save() {
    setMsg(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/agency-plans", {
        method: "PUT",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({ plans }),
      });
      const json = (await res.json()) as { success?: boolean; plans?: Plan[] };
      if (json?.success) {
        setPlans(json.plans ?? []);
        setMsg("✅ Planes guardados.");
      } else setMsg("No se pudo guardar.");
    } catch {
      setMsg("Error de red.");
    } finally {
      setLoading(false);
    }
  }

  const input = "rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between text-left">
        <span className="text-sm font-bold text-slate-800">💳 Planes de crédito ({plans.length})</span>
        <span className="text-xs text-slate-400">{open ? "Cerrar" : "Editar"}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          {plans.map((p, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/60 p-2">
              <input className={`${input} flex-1`} placeholder="Nombre" value={p.name} onChange={(e) => upd(i, { name: e.target.value })} />
              <input className={`${input} w-20`} type="number" placeholder="Créditos" value={p.credits} onChange={(e) => upd(i, { credits: Math.floor(Number(e.target.value)) })} />
              <input className={`${input} w-28`} type="number" placeholder="Precio COP" value={p.priceCop} onChange={(e) => upd(i, { priceCop: Math.floor(Number(e.target.value)) })} />
              <label className="flex items-center gap-1 text-xs text-slate-600">
                <input type="checkbox" checked={p.active} onChange={(e) => upd(i, { active: e.target.checked })} /> Activo
              </label>
              <button type="button" onClick={() => setPlans((pl) => pl.filter((_, idx) => idx !== i))} className="rounded-md border border-rose-300 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50">Quitar</button>
            </div>
          ))}
          <div className="flex gap-2">
            <button type="button" onClick={() => setPlans((p) => [...p, { name: "", credits: 10, priceCop: 500000, active: true }])} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">+ Agregar plan</button>
            <button type="button" onClick={() => void save()} disabled={loading} className="rounded-lg bg-[#5646E5] px-4 py-1.5 text-xs font-bold text-white disabled:opacity-40">{loading ? "…" : "Guardar planes"}</button>
          </div>
          {msg && <p className="text-xs font-semibold text-emerald-700">{msg}</p>}
        </div>
      )}
    </div>
  );
}
