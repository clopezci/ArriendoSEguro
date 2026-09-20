"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";

type Operator = ">=" | "<=" | "==" | "!=" | "in" | "exists";
type Rule = { id?: string; label: string; field: string; operator: Operator; value?: string | number | string[]; required: boolean };

const FIELDS: { key: string; label: string }[] = [
  { key: "incomeTimesCanon", label: "Ingresos ÷ canon" },
  { key: "income", label: "Ingresos (absoluto)" },
  { key: "contractType", label: "Tipo de contrato" },
  { key: "hasCodebtor", label: "Tiene codeudor" },
  { key: "score", label: "Score DataCrédito (externo)" },
];

const TEMPLATE: Rule[] = [
  { label: "Ingresos ≥ 3× el canon", field: "incomeTimesCanon", operator: ">=", value: 3, required: true },
  { label: "Contrato indefinido o fijo", field: "contractType", operator: "in", value: ["indefinido", "fijo"], required: false },
  { label: "Tiene codeudor", field: "hasCodebtor", operator: "==", value: "true", required: false },
];

export function StudyRulesManager({ agencyId }: { agencyId: string }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  // Estudio externo (DataCrédito / agregador / proxy propio).
  const [ext, setExt] = useState({ endpoint: "", scorePath: "score" });
  const [extApiKey, setExtApiKey] = useState("");
  const [extHasKey, setExtHasKey] = useState(false);
  const [extSecrets, setExtSecrets] = useState(true);
  const [extMsg, setExtMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [rRes, eRes] = await Promise.all([
        fetch(`/api/agency/${agencyId}/study-rules`, { headers: { ...(await buildAuthHeaders(user)) } }).then((r) => r.json()),
        fetch(`/api/agency/${agencyId}/external-study`, { headers: { ...(await buildAuthHeaders(user)) } }).then((r) => r.json()),
      ]);
      if (rRes?.success) setRules(rRes.rules ?? []);
      if (eRes?.success && eRes.config) {
        setExt({ endpoint: eRes.config.endpoint ?? "", scorePath: eRes.config.scorePath ?? "score" });
        setExtHasKey(Boolean(eRes.config.hasKey));
        setExtSecrets(eRes.config.secretsAvailable !== false);
      }
    } catch {
      /* noop */
    }
  }, [agencyId, user]);

  async function saveExt() {
    setExtMsg(null);
    try {
      const res = await fetch(`/api/agency/${agencyId}/external-study`, {
        method: "PUT",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({ endpoint: ext.endpoint.trim(), scorePath: ext.scorePath.trim() || "score", ...(extApiKey.trim() ? { apiKey: extApiKey.trim() } : {}) }),
      });
      const json = (await res.json()) as { success?: boolean; config?: { hasKey?: boolean }; errors?: { message?: string }[] };
      if (!res.ok || !json.success) setExtMsg(json.errors?.[0]?.message ?? "No se pudo guardar.");
      else {
        setExtMsg("✅ Estudio externo guardado.");
        setExtApiKey("");
        setExtHasKey(Boolean(json.config?.hasKey));
      }
    } catch {
      setExtMsg("Error de red.");
    }
  }

  useEffect(() => {
    void load();
  }, [load]);

  function upd(i: number, patch: Partial<Rule>) {
    setRules((r) => r.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }
  function valueToText(v: Rule["value"]): string {
    if (Array.isArray(v)) return v.join(", ");
    return v === undefined ? "" : String(v);
  }
  function textToValue(text: string, op: Operator): Rule["value"] {
    if (op === "in") return text.split(",").map((s) => s.trim()).filter(Boolean);
    const n = Number(text);
    return text.trim() !== "" && !Number.isNaN(n) ? n : text.trim();
  }

  async function save() {
    setMsg(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/agency/${agencyId}/study-rules`, {
        method: "PUT",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({ rules: rules.filter((r) => r.label.trim() && r.field) }),
      });
      const json = (await res.json()) as { success?: boolean; rules?: Rule[] };
      if (json?.success) {
        setRules(json.rules ?? []);
        setMsg("✅ Reglas guardadas. El formulario pedirá los datos necesarios.");
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
        <span className="text-sm font-bold text-slate-800">📋 Reglas de estudio ({rules.length})</span>
        <span className="text-xs text-slate-400">{open ? "Cerrar" : "Editar"}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-slate-500">Define cuándo un solicitante queda <strong>aprobado</strong>. Las obligatorias que fallen → rechazado; las opcionales → “revisar”. Lo que pidas aquí se pregunta en el formulario.</p>
          {rules.length === 0 && (
            <button type="button" onClick={() => setRules(TEMPLATE)} className="rounded-lg border border-violet-300 px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-50">
              Cargar plantilla estándar del mercado
            </button>
          )}
          {rules.map((r, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/60 p-2">
              <input className={`${input} flex-1`} placeholder="Nombre de la regla" value={r.label} onChange={(e) => upd(i, { label: e.target.value })} />
              <select className={input} value={r.field} onChange={(e) => upd(i, { field: e.target.value })}>
                {FIELDS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
              </select>
              <select className={input} value={r.operator} onChange={(e) => upd(i, { operator: e.target.value as Operator, value: textToValue(valueToText(r.value), e.target.value as Operator) })}>
                <option value=">=">≥</option>
                <option value="<=">≤</option>
                <option value="==">=</option>
                <option value="!=">≠</option>
                <option value="in">en lista</option>
                <option value="exists">existe</option>
              </select>
              {r.operator !== "exists" && (
                <input className={`${input} w-32`} placeholder={r.operator === "in" ? "a, b, c" : "valor"} value={valueToText(r.value)} onChange={(e) => upd(i, { value: textToValue(e.target.value, r.operator) })} />
              )}
              <label className="flex items-center gap-1 text-xs text-slate-600">
                <input type="checkbox" checked={r.required} onChange={(e) => upd(i, { required: e.target.checked })} /> Obligatoria
              </label>
              <button type="button" onClick={() => setRules((rl) => rl.filter((_, idx) => idx !== i))} className="rounded-md border border-rose-300 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50">Quitar</button>
            </div>
          ))}
          <div className="flex gap-2">
            <button type="button" onClick={() => setRules((r) => [...r, { label: "", field: "incomeTimesCanon", operator: ">=", value: 3, required: true }])} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">+ Agregar regla</button>
            <button type="button" onClick={() => void save()} disabled={loading} className="rounded-lg bg-[#5646E5] px-4 py-1.5 text-xs font-bold text-white disabled:opacity-40">{loading ? "…" : "Guardar reglas"}</button>
          </div>
          {msg && <p className="text-xs font-semibold text-emerald-700">{msg}</p>}

          <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <p className="text-xs font-bold text-slate-700">Estudio externo (DataCrédito / agregador / proxy propio)</p>
            <p className="mt-1 text-[11px] text-slate-500">
              Pon el endpoint de tu proveedor (o tu propio proxy) y tu API key. La llave se guarda <strong>cifrada</strong>, nunca se muestra ni se registra. Con el botón “Estudio” en cada solicitud se consulta y trae el score.
            </p>
            {!extSecrets && <p className="mt-1 text-[11px] text-amber-600">⚠ Falta configurar el cifrado del servidor (AGENCY_SECRETS_KEY) para poder guardar llaves.</p>}
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <input className={`${input} sm:col-span-2`} placeholder="Endpoint (https://…)" value={ext.endpoint} onChange={(e) => setExt((s) => ({ ...s, endpoint: e.target.value }))} />
              <input className={input} placeholder="Ruta del score en la respuesta (ej. score)" value={ext.scorePath} onChange={(e) => setExt((s) => ({ ...s, scorePath: e.target.value }))} />
              <input className={input} type="password" placeholder={extHasKey ? "API key (guardada — escribe para reemplazar)" : "API key"} value={extApiKey} onChange={(e) => setExtApiKey(e.target.value)} />
            </div>
            <button type="button" onClick={() => void saveExt()} className="mt-2 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">Guardar estudio externo</button>
            {extHasKey && <span className="ml-2 text-[11px] text-emerald-600">✓ llave configurada</span>}
            {extMsg && <p className="mt-1 text-xs font-semibold text-emerald-700">{extMsg}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
