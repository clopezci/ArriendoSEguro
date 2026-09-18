"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";

type Property = {
  id: string;
  agencyId: string;
  alias?: string;
  address: string;
  city: string;
  department: string;
  type: string;
  registryNumber?: string;
  commercialValue?: number;
  commercialValueUnknown?: boolean;
  defaultRent?: number;
};

type FormState = {
  alias: string;
  address: string;
  city: string;
  department: string;
  type: string;
  registryNumber: string;
  commercialValue: string;
  defaultRent: string;
};

const EMPTY: FormState = { alias: "", address: "", city: "", department: "", type: "Apartamento", registryNumber: "", commercialValue: "", defaultRent: "" };

export function PropertiesManager({ agencyId }: { agencyId: string }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<Property[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const base = `/api/agency/${agencyId}/properties`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(base, { headers: { ...(await buildAuthHeaders(user)) } });
      const json = (await res.json()) as { success?: boolean; properties?: Property[] };
      if (json?.success) setRows(json.properties ?? []);
    } finally {
      setLoading(false);
    }
  }, [base, user]);

  useEffect(() => {
    void load();
  }, [load]);

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save() {
    setMsg(null);
    setErr(null);
    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        alias: form.alias.trim() || undefined,
        address: form.address.trim(),
        city: form.city.trim(),
        department: form.department.trim(),
        type: form.type.trim(),
        registryNumber: form.registryNumber.trim() || undefined,
        commercialValue: form.commercialValue ? Math.floor(Number(form.commercialValue)) : undefined,
        defaultRent: form.defaultRent ? Math.floor(Number(form.defaultRent)) : undefined,
      };
      if (editingId) payload.id = editingId;
      const res = await fetch(base, {
        method: editingId ? "PATCH" : "POST",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as { success?: boolean; errors?: { message?: string }[] };
      if (!res.ok || !json.success) setErr(json.errors?.[0]?.message ?? "No se pudo guardar.");
      else {
        setMsg(editingId ? "✅ Inmueble actualizado." : "✅ Inmueble guardado.");
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
        <span className="text-xs font-semibold text-slate-500">{editingId ? "Editar inmueble" : "Nuevo inmueble"}</span>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <input className={input} placeholder="Alias interno (ej. Apto 302 Laureles)" value={form.alias} onChange={(e) => set("alias", e.target.value)} />
          <input className={input} placeholder="Tipo (Apartamento, Casa…)" value={form.type} onChange={(e) => set("type", e.target.value)} />
          <input className={input} placeholder="Dirección" value={form.address} onChange={(e) => set("address", e.target.value)} />
          <input className={input} placeholder="Ciudad" value={form.city} onChange={(e) => set("city", e.target.value)} />
          <input className={input} placeholder="Departamento" value={form.department} onChange={(e) => set("department", e.target.value)} />
          <input className={input} placeholder="Matrícula inmobiliaria (opcional)" value={form.registryNumber} onChange={(e) => set("registryNumber", e.target.value)} />
          <input className={input} type="number" placeholder="Valor comercial (opcional)" value={form.commercialValue} onChange={(e) => set("commercialValue", e.target.value)} />
          <input className={input} type="number" placeholder="Canon sugerido (opcional)" value={form.defaultRent} onChange={(e) => set("defaultRent", e.target.value)} />
        </div>
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={() => void save()} disabled={loading} className="rounded-lg bg-[#5646E5] px-4 py-2 text-sm font-bold text-white disabled:opacity-40">
            {loading ? "…" : editingId ? "Guardar cambios" : "Agregar inmueble"}
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
        <h4 className="text-xs font-bold uppercase text-slate-500">Inmuebles ({rows.length})</h4>
        {rows.length === 0 && <p className="text-xs text-slate-400">Aún no hay inmuebles. Cárgalos una vez y reúsalos en los contratos.</p>}
        {rows.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
            <div>
              <span className="font-semibold text-slate-800">{p.alias || p.address}</span>
              <span className="ml-2 text-xs text-slate-400">{p.type} · {p.address}, {p.city}</span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditingId(p.id);
                  setForm({
                    alias: p.alias ?? "",
                    address: p.address,
                    city: p.city,
                    department: p.department,
                    type: p.type,
                    registryNumber: p.registryNumber ?? "",
                    commercialValue: p.commercialValue != null ? String(p.commercialValue) : "",
                    defaultRent: p.defaultRent != null ? String(p.defaultRent) : "",
                  });
                }}
                className="rounded-md border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
              >
                Editar
              </button>
              <button type="button" onClick={() => void remove(p.id)} className="rounded-md border border-rose-300 px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50">Eliminar</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
