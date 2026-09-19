"use client";

import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
import { IntakeFieldsManager } from "@/components/agency/intake-fields-manager";
import { StudyRulesManager } from "@/components/agency/study-rules-manager";
import { evaluateStudy, type StudyRule } from "@/domain/agencies/studyRules";

type Submission = {
  id: string;
  tenant: { fullName: string; documentType: string; documentNumber: string; city: string; email: string; phone: string };
  propertyHint?: string;
  note?: string;
  custom?: Record<string, string>;
  study?: { income?: number; contractType?: string; hasCodebtor?: boolean; canonReference?: number };
  identity?: { approved: boolean; confianza: number | null; nombreRegistrado: string | null };
  createdAtIso: string;
};

type Landlord = { id: string; party: { fullName: string } };
type Property = { id: string; alias?: string; address: string; city?: string; externalId?: string; defaultRent?: number; landlordId?: string };

export function SubmissionsManager({ agencyId, onGenerated }: { agencyId: string; onGenerated?: () => void }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<Submission[]>([]);
  const [landlords, setLandlords] = useState<Landlord[]>([]);
  const [studyRules, setStudyRules] = useState<StudyRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [diagId, setDiagId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState<string | null>(null);

  const intakeUrl = typeof window !== "undefined" ? `${window.location.origin}/intake/${agencyId}` : `/intake/${agencyId}`;

  useEffect(() => {
    QRCode.toDataURL(intakeUrl, { width: 220, margin: 1 }).then(setQr).catch(() => setQr(null));
  }, [intakeUrl]);

  function downloadQr() {
    if (!qr) return;
    const a = document.createElement("a");
    a.href = qr;
    a.download = "qr-arriendoseguro.png";
    a.click();
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, l, sr] = await Promise.all([
        fetch(`/api/agency/${agencyId}/submissions?status=pending`, { headers: { ...(await buildAuthHeaders(user)) } }).then((r) => r.json()),
        fetch(`/api/agency/${agencyId}/landlords`, { headers: { ...(await buildAuthHeaders(user)) } }).then((r) => r.json()),
        fetch(`/api/agency/${agencyId}/study-rules`, { headers: { ...(await buildAuthHeaders(user)) } }).then((r) => r.json()),
      ]);
      if (s?.success) setRows(s.submissions ?? []);
      if (l?.success) setLandlords(l.landlords ?? []);
      if (sr?.success) setStudyRules(sr.rules ?? []);
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
        {qr && (
          <div className="mt-3 flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="Código QR del formulario" className="h-28 w-28 rounded-lg border border-slate-200 bg-white p-1" />
            <div className="text-xs text-slate-500">
              <p className="font-semibold text-slate-700">Código QR</p>
              <p className="mt-0.5">Imprímelo o pégalo en tus avisos y en la puerta del inmueble. Quien lo escanee llega a tu formulario.</p>
              <button type="button" onClick={downloadQr} className="mt-1 rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50">Descargar QR</button>
            </div>
          </div>
        )}
      </div>

      <IntakeFieldsManager agencyId={agencyId} />
      <StudyRulesManager agencyId={agencyId} />


      {msg && <p className="text-xs font-semibold text-emerald-700">{msg}</p>}
      {err && <p className="text-xs text-rose-600">{err}</p>}

      <h4 className="text-xs font-bold uppercase text-slate-500">Solicitudes pendientes ({rows.length})</h4>
      {loading && <p className="text-sm text-slate-500">Cargando…</p>}
      {!loading && rows.length === 0 && <p className="text-xs text-slate-400">Aún no hay solicitudes. Comparte tu enlace para empezar a recibirlas.</p>}

      {rows.map((s) => {
        const diag = studyRules.length
          ? evaluateStudy(studyRules, {
              income: s.study?.income,
              contractType: s.study?.contractType,
              hasCodebtor: s.study?.hasCodebtor,
              canonReference: s.study?.canonReference,
              custom: s.custom,
            })
          : null;
        const badge =
          diag?.status === "approved"
            ? { t: "Aprobado", c: "bg-emerald-100 text-emerald-700" }
            : diag?.status === "rejected"
              ? { t: "Rechazado", c: "bg-rose-100 text-rose-700" }
              : diag?.status === "review"
                ? { t: "Revisar", c: "bg-amber-100 text-amber-700" }
                : null;
        return (
        <div key={s.id} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="font-semibold text-slate-800">{s.tenant.fullName}</span>
              <span className="ml-2 text-xs text-slate-400">{s.tenant.documentType} {s.tenant.documentNumber} · {s.tenant.city}</span>
              {s.identity?.approved === true && <span className="ml-2 text-[11px] font-semibold text-emerald-600">✓ ID</span>}
              {s.identity?.approved === false && <span className="ml-2 text-[11px] font-semibold text-rose-600">⛔ ID</span>}
              {badge && (
                <button type="button" onClick={() => setDiagId(diagId === s.id ? null : s.id)} className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge.c}`}>
                  {badge.t} ⓘ
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setOpenId(openId === s.id ? null : s.id)} className="rounded-md border border-violet-300 px-3 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-50">
                {openId === s.id ? "Cerrar" : "Generar contrato"}
              </button>
              <button type="button" onClick={() => void discard(s.id)} className="rounded-md border border-rose-300 px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50">Descartar</button>
            </div>
          </div>
          <p className="mt-1 text-xs text-slate-500">{s.tenant.email} · {s.tenant.phone}{s.propertyHint ? ` · Interés: ${s.propertyHint}` : ""}</p>
          {diag && diagId === s.id && (
            <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50/60 p-2 text-xs">
              <p className="font-semibold text-slate-600">Diagnóstico del estudio:</p>
              <ul className="mt-1 space-y-0.5">
                {diag.results.map((r) => (
                  <li key={r.id} className={r.ok ? "text-emerald-700" : r.required ? "text-rose-600" : "text-amber-600"}>
                    {r.ok ? "✓" : "✕"} {r.label}{!r.ok ? ` (${r.detail})` : ""}{r.required ? "" : " · opcional"}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {s.note && <p className="mt-1 text-xs italic text-slate-400">“{s.note}”</p>}
          {s.custom && Object.keys(s.custom).length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {Object.entries(s.custom).map(([k, v]) => (
                <span key={k} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{k}: {v}</span>
              ))}
            </div>
          )}

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
        );
      })}
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
  const [props, setProps] = useState<Property[]>([]);
  const [manual, setManual] = useState(false);
  const [f, setF] = useState({
    propertyId: "",
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

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/agency/${agencyId}/properties`, { headers: { ...(await buildAuthHeaders(user)) } });
        const json = (await res.json()) as { success?: boolean; properties?: Property[] };
        if (json?.success) setProps(json.properties ?? []);
      } catch {
        /* noop */
      }
    })();
  }, [agencyId, user]);

  function set<K extends keyof typeof f>(k: K, v: string) {
    setF((p) => ({ ...p, [k]: v }));
  }

  function pickProperty(id: string) {
    const p = props.find((x) => x.id === id);
    setF((s) => ({ ...s, propertyId: id, monthlyRent: p?.defaultRent != null ? String(p.defaultRent) : s.monthlyRent }));
  }

  async function generate() {
    onError("");
    if (!f.startDate) {
      onError("Falta la fecha de inicio.");
      return;
    }
    const usingProperty = !manual && f.propertyId;
    if (!usingProperty && (!f.landlordId || !f.address.trim() || !f.city.trim() || !f.department.trim() || !f.monthlyRent)) {
      onError("Elige un inmueble, o completa arrendador, inmueble y canon.");
      return;
    }
    setBusy(true);
    try {
      const lease = {
        monthlyRent: f.monthlyRent ? Math.floor(Number(f.monthlyRent)) : undefined,
        paymentDueDay: Math.floor(Number(f.paymentDueDay)) || 1,
        startDate: f.startDate,
        termMonths: Math.floor(Number(f.termMonths)) || 12,
      };
      const body = usingProperty
        ? { propertyId: f.propertyId, lease }
        : {
            landlordId: f.landlordId,
            property: {
              address: f.address.trim(),
              city: f.city.trim(),
              department: f.department.trim(),
              type: f.type.trim(),
              registryNumber: f.registryNumber.trim() || undefined,
              commercialValue: f.commercialValue ? Math.floor(Number(f.commercialValue)) : undefined,
            },
            lease,
          };
      const res = await fetch(`/api/agency/${agencyId}/submissions/${submission.id}/generate`, {
        method: "POST",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify(body),
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
  const useProperty = !manual && props.length > 0;

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <p className="text-xs font-semibold text-slate-500">Completa lo que falta para generar el contrato</p>

      {props.length > 0 && (
        <label className="mt-2 block text-xs text-slate-500">
          Inmueble (trae el dueño y el canon)
          <div className="mt-1 flex items-center gap-2">
            <select className={`${input} flex-1`} value={f.propertyId} onChange={(e) => pickProperty(e.target.value)} disabled={manual}>
              <option value="">— Elige un inmueble —</option>
              {props.map((p) => <option key={p.id} value={p.id}>{p.alias || p.address}{p.externalId ? ` (${p.externalId})` : ""}</option>)}
            </select>
            <label className="flex items-center gap-1 text-[11px] text-slate-500">
              <input type="checkbox" checked={manual} onChange={(e) => setManual(e.target.checked)} /> Manual
            </label>
          </div>
        </label>
      )}

      {(manual || props.length === 0) && (
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
        </div>
      )}

      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <input className={input} type="number" placeholder="Canon mensual" value={f.monthlyRent} onChange={(e) => set("monthlyRent", e.target.value)} />
        <input className={input} type="number" placeholder="Día de pago (1-31)" value={f.paymentDueDay} onChange={(e) => set("paymentDueDay", e.target.value)} />
        <input className={input} type="date" value={f.startDate} onChange={(e) => set("startDate", e.target.value)} />
        <input className={input} type="number" placeholder="Meses" value={f.termMonths} onChange={(e) => set("termMonths", e.target.value)} />
      </div>

      <button type="button" onClick={() => void generate()} disabled={busy} className="mt-3 rounded-lg bg-[#5646E5] px-4 py-2 text-sm font-bold text-white disabled:opacity-40">
        {busy ? "Generando…" : useProperty && f.propertyId ? "Generar contrato (inmueble elegido)" : "Generar contrato"}
      </button>
    </div>
  );
}
