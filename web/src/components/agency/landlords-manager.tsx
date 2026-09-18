"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";

type Party = {
  fullName: string;
  documentType: string;
  documentNumber: string;
  city: string;
  email: string;
  phone: string;
  notificationAddress: string;
};

type Landlord = { id: string; agencyId: string; party: Party };

const EMPTY: Party = { fullName: "", documentType: "CC", documentNumber: "", city: "", email: "", phone: "", notificationAddress: "" };

export function LandlordsManager({ agencyId }: { agencyId: string }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<Landlord[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<Party>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const base = `/api/agency/${agencyId}/landlords`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(base, { headers: { ...(await buildAuthHeaders(user)) } });
      const json = (await res.json()) as { success?: boolean; landlords?: Landlord[] };
      if (json?.success) setRows(json.landlords ?? []);
    } finally {
      setLoading(false);
    }
  }, [base, user]);

  useEffect(() => {
    void load();
  }, [load]);

  function set<K extends keyof Party>(k: K, v: Party[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save() {
    setMsg(null);
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch(base, {
        method: editingId ? "PATCH" : "POST",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify(editingId ? { id: editingId, ...form } : form),
      });
      const json = (await res.json()) as { success?: boolean; errors?: { message?: string }[] };
      if (!res.ok || !json.success) setErr(json.errors?.[0]?.message ?? "No se pudo guardar.");
      else {
        setMsg(editingId ? "✅ Arrendador actualizado." : "✅ Arrendador guardado.");
        setForm(EMPTY);
        setEditingId(null);
        await load();
      }
    } catch {
      setErr("Error de red.");
    } finally {
      setLoading(false);
    }
  }

  async function remove(id: string) {
    setLoading(true);
    try {
      await fetch(`${base}?id=${encodeURIComponent(id)}`, { method: "DELETE", headers: { ...(await buildAuthHeaders(user)) } });
      await load();
    } finally {
      setLoading(false);
    }
  }

  const input = "rounded-lg border border-slate-300 px-3 py-2 text-sm";

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <span className="text-xs font-semibold text-slate-500">{editingId ? "Editar arrendador" : "Nuevo arrendador"}</span>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <input className={input} placeholder="Nombre completo" value={form.fullName} onChange={(e) => set("fullName", e.target.value)} />
          <div className="flex gap-2">
            <select className={`${input} w-24`} value={form.documentType} onChange={(e) => set("documentType", e.target.value)}>
              <option value="CC">CC</option>
              <option value="CE">CE</option>
              <option value="PA">PA</option>
              <option value="NIT">NIT</option>
            </select>
            <input className={`${input} flex-1`} placeholder="Número de documento" value={form.documentNumber} onChange={(e) => set("documentNumber", e.target.value)} />
          </div>
          <input className={input} placeholder="Ciudad" value={form.city} onChange={(e) => set("city", e.target.value)} />
          <input className={input} placeholder="Correo" value={form.email} onChange={(e) => set("email", e.target.value)} />
          <input className={input} placeholder="Teléfono" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          <input className={input} placeholder="Dirección de notificación (opcional)" value={form.notificationAddress} onChange={(e) => set("notificationAddress", e.target.value)} />
        </div>
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={() => void save()} disabled={loading} className="rounded-lg bg-[#5646E5] px-4 py-2 text-sm font-bold text-white disabled:opacity-40">
            {loading ? "…" : editingId ? "Guardar cambios" : "Agregar arrendador"}
          </button>
          {editingId && (
            <button type="button" onClick={() => { setEditingId(null); setForm(EMPTY); }} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600">
              Cancelar
            </button>
          )}
        </div>
        {msg && <p className="mt-2 text-xs font-semibold text-emerald-700">{msg}</p>}
        {err && <p className="mt-2 text-xs text-rose-600">{err}</p>}
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-bold uppercase text-slate-500">Arrendadores ({rows.length})</h4>
        {rows.length === 0 && <p className="text-xs text-slate-400">Aún no hay arrendadores. Agrégalos una vez y reúsalos en todos los contratos.</p>}
        {rows.map((l) => (
          <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
            <div>
              <span className="font-semibold text-slate-800">{l.party.fullName}</span>
              <span className="ml-2 text-xs text-slate-400">{l.party.documentType} {l.party.documentNumber} · {l.party.city}</span>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => { setEditingId(l.id); setForm({ ...EMPTY, ...l.party }); }} className="rounded-md border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50">Editar</button>
              <button type="button" onClick={() => void remove(l.id)} className="rounded-md border border-rose-300 px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50">Eliminar</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
