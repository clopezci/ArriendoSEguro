"use client";

import { ExpedienteNav } from "@/components/contracts/expediente-nav";
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
      const data = (await res.json()) as
        | { success: true; emailsAttempted: number }
        | { success: false; errors: { field: string; message: string }[] };
      if (!res.ok || !data.success) {
        const msg = !data.success ? data.errors.map((x) => x.message).join(" ") : "No se pudo guardar.";
        setFormMsg(msg);
        return;
      }
      setFormMsg(
        data.emailsAttempted > 0
          ? "Novedad registrada. Enviamos un correo a la contraparte (y al codeudor si aplica)."
          : "Novedad registrada. No encontramos otra parte con correo distinto al tuyo; nadie recibió aviso por correo.",
      );
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
    <main className="mx-auto max-w-3xl space-y-6 p-6 text-slate-900">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-violet-700">Expediente</p>
        <h1 className="text-2xl font-bold">Novedades y solicitudes</h1>
        <p className="text-sm text-slate-600">
          Registra incumplimientos, solicitudes de reparación, convivencia u otras situaciones. Las partes del contrato
          pueden ver el historial aquí. ArriendoSeguro no media cobranzas ni conflictos; este módulo es para trazabilidad
          y comunicación básica.
        </p>
      </header>

      <ExpedienteNav contractId={id} />

      {!user && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Inicia sesión para ver y registrar novedades.
        </p>
      )}

      {error && (
        <p className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800" role="alert">
          {error}
        </p>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
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
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
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
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
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
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitBusy ? "Guardando…" : "Registrar y notificar"}
          </button>
        </form>
        {formMsg && <p className="mt-3 text-sm text-slate-700">{formMsg}</p>}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
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
                <li key={r.id} className="rounded-lg border border-slate-100 bg-slate-50/80 p-3 text-sm">
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

      <p className="text-xs text-slate-500">
        <Link href={`/dashboard/contracts/${id}/evidencia`} className="text-violet-700 underline">
          Volver a evidencia
        </Link>
      </p>
    </main>
  );
}
