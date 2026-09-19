"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";

type Submission = {
  id: string;
  tenant: { fullName: string; documentType: string; documentNumber: string; city: string; email: string; phone: string };
  propertyHint?: string;
  note?: string;
  identity?: { approved: boolean; confianza: number | null; nombreRegistrado: string | null };
  createdAtIso: string;
};

type Landlord = { id: string; party: { fullName: string } };

export function SubmissionsManager({ agencyId, onGenerated }: { agencyId: string; onGenerated?: () => void }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<Submission[]>([]);
  const [landlords, setLandlords] = useState<Landlord[]>([]);
  const [loading, setLoading] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const intakeUrl = typeof window !== "undefined" ? `${window.location.origin}/intake/${agencyId}` : `/intake/${agencyId}`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, l] = await Promise.all([
        fetch(`/api/agency/${agencyId}/submissions?status=pending`, { headers: { ...(await buildAuthHeaders(user)) } }).then((r) => r.json()),
        fetch(`/api/agency/${agencyId}/landlords`, { headers: { ...(await buildAuthHeaders(user)) } }).then((r) => r.json()),
      ]);
      if (s?.success) setRows(s.submissions ?? []);
      if (l?.success) setLandlords(l.landlords ?? []);
    } finally {
      setLoading(false);
    }
  }, [agencyId, user]);

  useEffect(() => {
    void load();
  }, [load]);

  async function discard(id: string) {
    await fetch(`/api/agency/${agencyId}/submissions`, {
      method: "PATCH",
      headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
      body: JSON.stringify({ id, action: "discard" }),
    });
    await load();
  }

  function copyLink() {
    try {
      void navigator.clipboard.writeText(intakeUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-violet-200 bg-violet-50/40 p-4">
        <p className="text-sm font-bold text-violet-900">Tu enlace de captura</p>
        <p className="mt-1 text-xs text-slate-600">Compártelo por WhatsApp, redes o pégalo donde publicas tus inmuebles. Cada interesado llena sus datos solo y llega aquí — no tecleas nada.</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <code className="flex-1 truncate rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs">{intakeUrl}</code>
          <button type="button" onClick={copyLink} className="rounded-lg bg-[#5646E5] px-3 py-2 text-xs font-bold text-white">{copied ? "¡Copiado!" : "Copiar"}</button>
          <a href={`https://wa.me/?text=${encodeURIComponent("Llena tus datos para tu arriendo aquí: " + intakeUrl)}`} target="_blank" rel="noreferrer" className="rounded-lg border border-emerald-300 px-3 py-2 text-xs font-semibold text-emerald-700">Compartir por WhatsApp</a>
        </div>
      </div>

      {msg && <p className="text-xs font-semibold text-emerald-700">{msg}</p>}
      {err && <p className="text-xs text-rose-600">{err}</p>}

      <h4 className="text-xs font-bold uppercase text-slate-500">Solicitudes pendientes ({rows.length})</h4>
      {loading && <p className="text-sm text-slate-500">Cargando…</p>}
      {!loading && rows.length === 0 && <p className="text-xs text-slate-400">Aún no hay solicitudes. Comparte tu enlace para empezar a recibirlas.</p>}

      {rows.map((s) => (
        <div key={s.id} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="font-semibold text-slate-800">{s.tenant.fullName}</span>
              <span className="ml-2 text-xs text-slate-400">{s.tenant.documentType} {s.tenant.documentNumber} · {s.tenant.city}</span>
              {s.identity?.approved === true && <span className="ml-2 text-[11px] font-semibold text-emerald-600">✓ ID</span>}
              {s.identity?.approved === false && <span className="ml-2 text-[11px] font-semibold text-rose-600">⛔ ID</span>}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setOpenId(openId === s.id ? null : s.id)} className="rounded-md border border-violet-300 px-3 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-50">
                {openId === s.id ? "Cerrar" : "Generar contrato"}
              </button>
              <button type="button" onClick={() => void discard(s.id)} className="rounded-md border border-rose-300 px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50">Descartar</button>
            </div>
          </div>
          <p className="mt-1 text-xs text-slate-500">{s.tenant.email} · {s.tenant.phone}{s.propertyHint ? ` · Interés: ${s.propertyHint}` : ""}</p>
          {s.note && <p className="mt-1 text-xs italic text-slate-400">“{s.note}”</p>}

          {openId === s.id && (
            <GenerateForm
              agencyId={agencyId}
              submission={s}
              landlords={landlords}
              onDone={async () => {
                setOpenId(null);
                setMsg(`✅ Contrato generado para ${s.tenant.fullName}. Está en la Cartera como borrador.`);
                await load();
                onGenerated?.();
              }}
              onError={(m) => setErr(m)}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function GenerateForm({
  agencyId,
  submission,
  landlords,
  onDone,
  onError,
}: {
  agencyId: string;
  submission: Submission;
  landlords: Landlord[];
  onDone: () => void | Promise<void>;
  onError: (m: string) => void;
}) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    landlordId: "",
    address: submission.propertyHint ?? "",
    city: submission.tenant.city ?? "",
    department: "",
    type: "Apartamento",
    registryNumber: "",
    commercialValue: "",
    monthlyRent: "",
    paymentDueDay: "1",
    startDate: "",
    termMonths: "12",
  });

  function set<K extends keyof typeof f>(k: K, v: string) {
    setF((p) => ({ ...p, [k]: v }));
  }

  async function generate() {
    onError("");
    if (!f.landlordId || !f.address.trim() || !f.city.trim() || !f.department.trim() || !f.monthlyRent || !f.startDate) {
      onError("Completa arrendador, inmueble (dirección/ciudad/departamento), canon y fecha de inicio.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/agency/${agencyId}/submissions/${submission.id}/generate`, {
        method: "POST",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({
          landlordId: f.landlordId,
          property: {
            address: f.address.trim(),
            city: f.city.trim(),
            department: f.department.trim(),
            type: f.type.trim(),
            registryNumber: f.registryNumber.trim() || undefined,
            commercialValue: f.commercialValue ? Math.floor(Number(f.commercialValue)) : undefined,
          },
          lease: {
            monthlyRent: Math.floor(Number(f.monthlyRent)),
            paymentDueDay: Math.floor(Number(f.paymentDueDay)) || 1,
            startDate: f.startDate,
            termMonths: Math.floor(Number(f.termMonths)) || 12,
          },
        }),
      });
      const json = (await res.json()) as { success?: boolean; errors?: { message?: string }[] };
      if (!res.ok || !json.success) onError(json.errors?.[0]?.message ?? "No se pudo generar.");
      else await onDone();
    } catch {
      onError("Error de red al generar.");
    } finally {
      setBusy(false);
    }
  }

  const input = "rounded-lg border border-slate-300 px-3 py-2 text-sm";

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <p className="text-xs font-semibold text-slate-500">Completa lo que falta para generar el contrato</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <select className={input} value={f.landlordId} onChange={(e) => set("landlordId", e.target.value)}>
          <option value="">— Arrendador —</option>
          {landlords.map((l) => <option key={l.id} value={l.id}>{l.party.fullName}</option>)}
        </select>
        <input className={input} placeholder="Tipo (Apartamento…)" value={f.type} onChange={(e) => set("type", e.target.value)} />
        <input className={input} placeholder="Dirección del inmueble" value={f.address} onChange={(e) => set("address", e.target.value)} />
        <input className={input} placeholder="Ciudad" value={f.city} onChange={(e) => set("city", e.target.value)} />
        <input className={input} placeholder="Departamento" value={f.department} onChange={(e) => set("department", e.target.value)} />
        <input className={input} placeholder="Matrícula (opcional)" value={f.registryNumber} onChange={(e) => set("registryNumber", e.target.value)} />
        <input className={input} type="number" placeholder="Valor comercial (opcional)" value={f.commercialValue} onChange={(e) => set("commercialValue", e.target.value)} />
        <input className={input} type="number" placeholder="Canon mensual" value={f.monthlyRent} onChange={(e) => set("monthlyRent", e.target.value)} />
        <input className={input} type="number" placeholder="Día de pago (1-31)" value={f.paymentDueDay} onChange={(e) => set("paymentDueDay", e.target.value)} />
        <input className={input} type="date" value={f.startDate} onChange={(e) => set("startDate", e.target.value)} />
        <input className={input} type="number" placeholder="Meses" value={f.termMonths} onChange={(e) => set("termMonths", e.target.value)} />
      </div>
      <button type="button" onClick={() => void generate()} disabled={busy} className="mt-3 rounded-lg bg-[#5646E5] px-4 py-2 text-sm font-bold text-white disabled:opacity-40">
        {busy ? "Generando…" : "Generar contrato"}
      </button>
    </div>
  );
}
