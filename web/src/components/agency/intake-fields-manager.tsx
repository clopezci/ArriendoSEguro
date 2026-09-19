"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";

type FieldType = "text" | "number" | "bool" | "select";
type Field = { key?: string; label: string; type: FieldType; options?: string[]; required?: boolean };

const TYPE_LABEL: Record<FieldType, string> = { text: "Texto", number: "Número", bool: "Sí/No", select: "Lista" };

export function IntakeFieldsManager({ agencyId }: { agencyId: string }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/agency/${agencyId}/intake-fields`, { headers: { ...(await buildAuthHeaders(user)) } });
      const json = (await res.json()) as { success?: boolean; fields?: Field[] };
      if (json?.success) setFields(json.fields ?? []);
    } catch {
      /* noop */
    }
  }, [agencyId, user]);

  useEffect(() => {
    void load();
  }, [load]);

  function update(i: number, patch: Partial<Field>) {
    setFields((f) => f.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }
  function add() {
    if (fields.length >= 12) return;
    setFields((f) => [...f, { label: "", type: "text", required: false }]);
  }
  function remove(i: number) {
    setFields((f) => f.filter((_, idx) => idx !== i));
  }

  async function save() {
    setMsg(null);
    setErr(null);
    const clean = fields.filter((f) => f.label.trim());
    setLoading(true);
    try {
      const res = await fetch(`/api/agency/${agencyId}/intake-fields`, {
        method: "PUT",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({
          fields: clean.map((f) => ({
            key: f.key,
            label: f.label.trim(),
            type: f.type,
            required: !!f.required,
            options: f.type === "select" ? (f.options ?? []) : undefined,
          })),
        }),
      });
      const json = (await res.json()) as { success?: boolean; fields?: Field[]; errors?: { message?: string }[] };
      if (!res.ok || !json.success) setErr(json.errors?.[0]?.message ?? "No se pudo guardar.");
      else {
        setFields(json.fields ?? []);
        setMsg("✅ Campos guardados. Ya aparecen en tu formulario.");
      }
    } catch {
      setErr("Error de red.");
    } finally {
      setLoading(false);
    }
  }

  const input = "rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between text-left">
        <span className="text-sm font-bold text-slate-800">🧩 Personalizar formulario ({fields.length})</span>
        <span className="text-xs text-slate-400">{open ? "Cerrar" : "Abrir"}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-slate-500">Agrega preguntas propias (ej. “Ingresos mensuales”, “Ocupación”, “¿Tiene codeudor?”). Aparecen en tu formulario público y en cada solicitud.</p>
          {fields.map((f, i) => (
            <div key={i} className="rounded-xl border border-slate-100 bg-slate-50/60 p-2">
              <div className="flex flex-wrap items-center gap-2">
                <input className={`${input} flex-1`} placeholder="Pregunta (ej. Ingresos mensuales)" value={f.label} onChange={(e) => update(i, { label: e.target.value })} />
                <select className={input} value={f.type} onChange={(e) => update(i, { type: e.target.value as FieldType })}>
                  {(Object.keys(TYPE_LABEL) as FieldType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                </select>
                <label className="flex items-center gap-1 text-xs text-slate-600">
                  <input type="checkbox" checked={!!f.required} onChange={(e) => update(i, { required: e.target.checked })} /> Obligatorio
                </label>
                <button type="button" onClick={() => remove(i)} className="rounded-md border border-rose-300 px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50">Quitar</button>
              </div>
              {f.type === "select" && (
                <input
                  className={`${input} mt-2 w-full`}
                  placeholder="Opciones separadas por coma (ej. Sí, No, Tal vez)"
                  value={(f.options ?? []).join(", ")}
                  onChange={(e) => update(i, { options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                />
              )}
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={add} disabled={fields.length >= 12} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40">+ Agregar campo</button>
            <button type="button" onClick={() => void save()} disabled={loading} className="rounded-lg bg-[#5646E5] px-4 py-1.5 text-xs font-bold text-white disabled:opacity-40">{loading ? "Guardando…" : "Guardar campos"}</button>
          </div>
          {msg && <p className="text-xs font-semibold text-emerald-700">{msg}</p>}
          {err && <p className="text-xs text-rose-600">{err}</p>}
        </div>
      )}
    </div>
  );
}
