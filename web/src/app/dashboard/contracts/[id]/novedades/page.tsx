"use client";

import { ExpedientePostWizardNav } from "@/components/contracts/expediente-post-wizard-nav";
import { BentoShell } from "@/components/layout/bento-shell";
import { WizardShell } from "@/components/contracts/wizard-shell";
import { RequiresSavedContract } from "@/components/contracts/requires-saved-contract";
import { NOVEDAD_TIPO_IDS, NOVEDAD_TIPO_LABELS, type NovedadTipoId } from "@/domain/contracts/novedades/types";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type NovedadRow = {
  id: string;
  tipo?: string;
  description?: string;
  createdAt?: string;
  authorEmail?: string;
  authorRole?: string;
  attachmentUrl?: string | null;
  attachmentStoragePath?: string | null;
};

function roleLabel(r: string | undefined): string {
  if (r === "landlord") return "Arrendador";
  if (r === "tenant") return "Arrendatario";
  if (r === "solidaryCoDebtor") return "Codeudor";
  return r ?? "—";
}

export default function NovedadesExpedientePage() {
  const id = String(useParams<{ id: string }>().id);
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<NovedadRow[]>([]);
  const [tipo, setTipo] = useState<NovedadTipoId>("INCUMPLIMIENTO_PAGO");
  const [description, setDescription] = useState("");
  const [formMsg, setFormMsg] = useState("");
  const [submitBusy, setSubmitBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      setRows([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/contracts/novedades/list?contractId=${encodeURIComponent(id)}`, {
        headers: { ...(await buildAuthHeaders(user)) },
      });
      const data = (await res.json()) as { success?: boolean; novedades?: NovedadRow[]; errors?: { message: string }[] };
      if (!res.ok || !data.success) {
        setError(data.errors?.[0]?.message ?? "No se pudieron cargar las novedades.");
        setRows([]);
        return;
      }
      setRows(Array.isArray(data.novedades) ? data.novedades : []);
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) {
      setFormMsg("Inicia sesión para registrar una novedad.");
      return;
    }
    setSubmitBusy(true);
    setFormMsg("");
    try {
      const fd = new FormData(e.currentTarget);
      fd.set("contractId", id);
      const res = await fetch("/api/contracts/novedades", {
        method: "POST",
        headers: { ...(await buildAuthHeaders(user)) },
        body: fd,
      });
      const data = (await res.json()) as { success?: boolean; errors?: { message: string }[] };
      if (!res.ok || !data.success) {
        setFormMsg(data.errors?.[0]?.message ?? "No se pudo registrar la novedad.");
        return;
      }
      setFormMsg("Novedad registrada. Las partes fueron notificadas por correo cuando aplica.");
      setDescription("");
      setTipo("INCUMPLIMIENTO_PAGO");
      const fi = e.currentTarget.querySelector('input[type="file"]') as HTMLInputElement | null;
      if (fi) fi.value = "";
      void load();
    } catch {
      setFormMsg("Error de red al enviar el formulario.");
    } finally {
      setSubmitBusy(false);
    }
  }

  return (
    <BentoShell>
      <WizardShell
        title="Registrar novedades y solicitudes del arrendamiento"
        currentStep={13}
        contractId={id}
        variant="extra"
        phase="posventa"
        lean
      >
        <p
          className="mb-4 text-sm text-slate-700"
          title="Ejemplos: mora en el canon, daños en el inmueble, solicitud de reparación, problemas de convivencia, acuerdos entre partes."
        >
          Registra incumplimientos, solicitudes de reparación, convivencia u otras situaciones durante el arriendo. Las
          partes del contrato pueden ver el historial. ArriendoSeguro no media cobranzas ni conflictos; este módulo es
          para trazabilidad y comunicación básica.
        </p>

        <ExpedientePostWizardNav contractId={id} />

        <RequiresSavedContract id={id}>
        {!user && (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Inicia sesión para ver y registrar novedades.
          </p>
        )}

        {error && (
          <p className="rounded-2xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800" role="alert">
            {error}
          </p>
        )}

        <section className="rounded-3xl border-2 border-slate-200 bg-white/90 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Registrar novedad</h2>
          <p className="mt-1 text-xs text-slate-600">
            Debes figurar como parte del contrato (mismo correo que en el expediente). Si eliges «Otra», describe la
            situación con al menos 10 caracteres. Archivo opcional: PDF, JPG o PNG (máx. 5 MB).
          </p>
          <form className="mt-4 space-y-3" onSubmit={(ev) => void onSubmit(ev)}>
            <div>
              <label htmlFor="nov-tipo" className="block text-xs font-medium text-slate-700">
                Tipo
              </label>
              <select
                id="nov-tipo"
                name="tipo"
                value={tipo}
                onChange={(e) => setTipo(e.target.value as NovedadTipoId)}
                className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-[#5646E5]"
              >
                {NOVEDAD_TIPO_IDS.map((k) => (
                  <option key={k} value={k}>
                    {NOVEDAD_TIPO_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="nov-desc" className="block text-xs font-medium text-slate-700">
                Descripción {tipo === "OTRA" ? "(obligatoria)" : "(opcional)"}
              </label>
              <textarea
                id="nov-desc"
                name="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                maxLength={2000}
                className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-[#5646E5]"
                placeholder="Explica con calma qué pasó o qué necesitas."
              />
            </div>
            <div>
              <label htmlFor="nov-file" className="block text-xs font-medium text-slate-700">
                Archivo opcional
              </label>
              <input
                id="nov-file"
                name="file"
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                className="mt-1 block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-violet-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-violet-900"
              />
            </div>
            <button
              type="submit"
              disabled={submitBusy || !user}
              className="rounded-2xl bg-[#5646E5] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition hover:brightness-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitBusy ? "Guardando…" : "Registrar y notificar"}
            </button>
          </form>
          {formMsg && <p className="mt-3 text-sm text-slate-700">{formMsg}</p>}
        </section>

        <section className="mt-6 rounded-3xl border-2 border-slate-200 bg-white/90 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Historial</h2>
          {loading && <p className="mt-2 text-sm text-slate-600">Cargando…</p>}
          {!loading && rows.length === 0 && (
            <p className="mt-2 text-sm text-slate-600">Aún no hay novedades registradas en este expediente.</p>
          )}
          {!loading && rows.length > 0 && (
            <ul className="mt-3 space-y-3">
              {rows.map((r) => {
                const tipoKey = (r.tipo ?? "OTRA") as NovedadTipoId;
                const label = NOVEDAD_TIPO_LABELS[tipoKey] ?? r.tipo ?? "—";
                const hrefAtt =
                  r.attachmentUrl ||
                  (r.id && r.attachmentStoragePath
                    ? `/api/contracts/novedades/attachment?contractId=${encodeURIComponent(id)}&novedadId=${encodeURIComponent(r.id)}`
                    : null);
                return (
                  <li key={r.id} className="rounded-2xl border border-slate-200 bg-white/80 p-4 text-sm">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-medium text-slate-900">{label}</span>
                      <span className="text-xs text-slate-500">
                        {r.createdAt ? new Date(r.createdAt).toLocaleString("es-CO") : "—"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">
                      {roleLabel(r.authorRole)} · {r.authorEmail ?? "—"}
                    </p>
                    {r.description ? <p className="mt-2 whitespace-pre-wrap text-slate-800">{r.description}</p> : null}
                    {hrefAtt && (
                      <p className="mt-2">
                        <a className="text-violet-700 underline" href={hrefAtt} target="_blank" rel="noreferrer">
                          Ver adjunto
                        </a>
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <p className="mt-6 text-xs text-slate-500">
          <Link href={`/dashboard/contracts/${id}/adicionales`} className="text-violet-700 underline">
            ← Volver a la posventa
          </Link>
          {" · "}
          <Link href={`/dashboard/contracts/${id}/preview`} className="text-violet-700 underline">
            Vista previa del contrato
          </Link>
        </p>
        </RequiresSavedContract>
      </WizardShell>
    </BentoShell>
  );
}
