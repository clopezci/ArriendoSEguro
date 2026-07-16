"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
import { ALERT_FREQUENCIES, ALERT_FREQUENCY_LABELS, ALERT_NAME_MAX, ALERT_MESSAGE_MAX, type AlertFrequency } from "@/domain/contracts/customAlerts";

type Alert = { id: string; name: string; message: string; frequency: AlertFrequency; startDate: string; nextFireAt: string | null; enabled: boolean };

/** Crear/ver/borrar alertas personalizadas del contrato (recordatorios propios). */
export function CustomAlertsCard({ contractId }: { contractId: string }) {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [frequency, setFrequency] = useState<AlertFrequency>("monthly");
  const [startDate, setStartDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/contracts/custom-alerts?contractId=${encodeURIComponent(contractId)}`, { headers: { ...(await buildAuthHeaders(user)) } });
      const j = (await res.json()) as { success?: boolean; alerts?: Alert[] };
      if (res.ok && j.success) setAlerts(j.alerts ?? []);
    } catch { /* noop */ }
  }, [user, contractId]);

  useEffect(() => { void load(); }, [load]);

  async function create() {
    if (!user) return;
    setBusy(true); setMsg("");
    try {
      const res = await fetch("/api/contracts/custom-alerts", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({ contractId, name, message, frequency, startDate }),
      });
      const j = (await res.json()) as { success?: boolean; errors?: { message?: string }[] };
      if (!res.ok || !j.success) { setMsg(j.errors?.[0]?.message ?? "No se pudo crear la alerta."); return; }
      setName(""); setMessage(""); setStartDate(""); setFrequency("monthly");
      setMsg("Alerta creada ✓");
      await load();
    } catch { setMsg("Error de red."); } finally { setBusy(false); }
  }

  async function remove(id: string) {
    if (!user) return;
    try {
      await fetch(`/api/contracts/custom-alerts?id=${encodeURIComponent(id)}`, { method: "DELETE", headers: { ...(await buildAuthHeaders(user)) } });
      await load();
    } catch { /* noop */ }
  }

  return (
    <section className="mt-4 rounded-3xl border-2 border-slate-200 bg-white/90 p-5 shadow-sm">
      <h2 className="text-lg font-bold text-slate-900">Crea tu propia alerta</h2>
      <p className="mt-1 text-sm text-slate-500">
        Además de las estándar, agrega tus recordatorios (ej.: pagar el predial, renovar el SOAT del garaje, revisar el inmueble).
        Te llegan por correo en la fecha y con la periodicidad que elijas.
      </p>

      <div className="mt-4 space-y-3">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Nombre de la alerta</span>
          <input value={name} maxLength={ALERT_NAME_MAX} onChange={(e) => setName(e.target.value)} placeholder="Ej. Pagar impuesto predial" className="w-full rounded-2xl border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#5646E5]" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Mensaje que quieres recordar</span>
          <textarea value={message} maxLength={ALERT_MESSAGE_MAX} onChange={(e) => setMessage(e.target.value)} rows={2} placeholder="Ej. Pagar el predial del inmueble antes del vencimiento." className="w-full rounded-2xl border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#5646E5]" />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Periodicidad</span>
            <select value={frequency} onChange={(e) => setFrequency(e.target.value as AlertFrequency)} className="w-full rounded-2xl border-2 border-slate-200 bg-white px-3 py-2 text-sm">
              {ALERT_FREQUENCIES.map((f) => <option key={f} value={f}>{ALERT_FREQUENCY_LABELS[f]}</option>)}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Fecha inicial</span>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full rounded-2xl border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#5646E5]" />
          </label>
        </div>
        <button type="button" onClick={() => void create()} disabled={busy} className="rounded-2xl bg-[#5646E5] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition hover:brightness-105 active:scale-95 disabled:opacity-50">
          {busy ? "Guardando…" : "Guardar alerta"}
        </button>
        {msg && <p className="text-sm font-medium text-emerald-700">{msg}</p>}
      </div>

      {alerts.length > 0 && (
        <ul className="mt-5 space-y-2">
          {alerts.map((a) => (
            <li key={a.id} className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800">🔔 {a.name}</p>
                <p className="mt-0.5 truncate text-xs text-slate-500">{a.message}</p>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  {ALERT_FREQUENCY_LABELS[a.frequency]} · desde {a.startDate}
                  {a.enabled ? "" : " · (finalizada)"}
                </p>
              </div>
              <button type="button" onClick={() => void remove(a.id)} className="flex-none rounded-lg bg-rose-100 px-3 py-1.5 text-xs font-bold text-rose-600" aria-label="Eliminar alerta">Eliminar</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
