"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ExpedientePostWizardNav } from "@/components/contracts/expediente-post-wizard-nav";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";

type Choice = "download" | "cloud" | "undecided";

export default function CerrarContratoPage() {
  const id = String(useParams<{ id: string }>().id);
  const router = useRouter();
  const { user } = useAuth();
  const [versionId, setVersionId] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [choice, setChoice] = useState<Choice | "">("");
  const [consent, setConsent] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [dlBusy, setDlBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/contracts/latest-version?contractId=${encodeURIComponent(id)}`);
      const j = await r.json();
      setVersionId(j?.version?.id ?? j?.contract?.currentVersionId ?? "");
      setStatus(j?.contract?.status ?? "");
    } catch { /* noop */ } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  async function downloadZip() {
    if (!user || !versionId) { setMsg("Inicia sesión y asegúrate de tener una versión guardada."); return; }
    setDlBusy(true);
    setMsg("");
    try {
      const res = await fetch(`/api/contracts/evidence-bundle?contractId=${encodeURIComponent(id)}&contractVersionId=${encodeURIComponent(versionId)}&context=closure`, {
        headers: { ...(await buildAuthHeaders(user)) },
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { errors?: { message?: string }[] };
        setMsg(j.errors?.[0]?.message ?? "No se pudo generar el ZIP.");
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get("content-disposition");
      const name = cd?.match(/filename="([^"]+)"/)?.[1] ?? `expediente-${id}.zip`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      setDownloaded(true);
      setMsg("Descarga iniciada. Guarda el ZIP en un lugar seguro.");
    } catch {
      setMsg("Error de red al generar el ZIP.");
    } finally {
      setDlBusy(false);
    }
  }

  async function closeContract() {
    if (!user) return;
    if (!choice) { setMsg("Es obligatorio elegir una opción para cerrar el contrato."); return; }
    if (!consent) { setMsg("Debes aceptar las condiciones de cierre."); return; }
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/contracts/close", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({ contractId: id, choice, consentAccepted: true }),
      });
      const j = (await res.json()) as { success?: boolean; errors?: { message?: string }[] };
      if (!res.ok || !j.success) { setMsg(j.errors?.[0]?.message ?? "No se pudo cerrar el contrato."); return; }
      await load();
    } catch {
      setMsg("Error de red al cerrar el contrato.");
    } finally {
      setBusy(false);
    }
  }

  const isClosed = status === "closed";

  return (
    <main className="mx-auto max-w-2xl space-y-5">
      <ExpedientePostWizardNav contractId={id} />

      <header className="space-y-2">
        <h1 className="text-balance text-3xl font-extrabold tracking-tight text-[#17151F]">Cerrar contrato</h1>
        <p className="mt-2 text-slate-500">
          Cuando todo quede <b>conciliado y cerrado</b>, cierra el contrato definitivamente. Antes, <b>descarga todo tu
          expediente</b> (contrato, actas, soportes y fotos) para conservarlo.
        </p>
      </header>

      {loading && <p className="text-sm text-slate-600">Cargando…</p>}

      {!loading && isClosed && (
        <section className="rounded-3xl border-2 border-emerald-400 bg-emerald-50 p-5 text-emerald-900">
          <p className="text-lg font-bold">✓ Contrato cerrado</p>
          <p className="mt-1 text-sm">Quedó registrado como conciliado y cerrado. Puedes descargar tu expediente cuando lo necesites.</p>
          <button onClick={() => void downloadZip()} disabled={dlBusy} className="mt-3 rounded-xl border-2 border-emerald-500 bg-white px-4 py-2 text-sm font-bold text-emerald-700 disabled:opacity-60">
            {dlBusy ? "Generando…" : "⬇️ Descargar expediente (ZIP)"}
          </button>
          {msg && <p className="mt-2 text-xs">{msg}</p>}
        </section>
      )}

      {!loading && !isClosed && (
        <>
          {/* Paso 1: descargar todo */}
          <section className="rounded-3xl border-2 border-slate-200 bg-white/90 p-5 shadow-sm">
            <p className="text-sm font-bold text-slate-900">1) Descarga todo tu expediente</p>
            <p className="mt-1 text-xs text-slate-600">Un solo archivo ZIP con el contrato, las actas, los soportes y las fotos. Puedes hacerlo desde <b>PC o celular</b> (se descarga directo, sin descomprimir nada especial).</p>
            <button onClick={() => void downloadZip()} disabled={dlBusy} className="mt-3 rounded-xl bg-[#5646E5] px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
              {dlBusy ? "Generando…" : "⬇️ Descargar expediente (ZIP)"}
            </button>
            {downloaded && <p className="mt-2 text-xs font-semibold text-emerald-700">✓ Descargado</p>}
          </section>

          {/* Paso 2: elegir qué pasa con las fotos y soportes */}
          <section className="rounded-3xl border-2 border-slate-200 bg-white/90 p-5 shadow-sm">
            <p className="text-sm font-bold text-slate-900">2) Elige qué hacemos con tus fotos y soportes</p>
            <p className="mt-1 text-xs text-slate-600">El <b>contrato, la recomendación, el historial y la calificación se conservan siempre</b>. Lo que se libera para reducir costos son las <b>fotos y soportes</b>.</p>
            <div className="mt-3 space-y-2">
              <label className={`flex cursor-pointer items-start gap-2 rounded-2xl border-2 p-3 text-sm ${choice === "download" ? "border-[#5646E5] bg-[#ECE9FB]/50" : "border-slate-200"}`}>
                <input type="radio" name="choice" checked={choice === "download"} onChange={() => setChoice("download")} className="mt-0.5 h-4 w-4" />
                <span><b>📥 Ya descargué y lo conservo yo.</b> En 7 días eliminamos las fotos y soportes de la nube. Es mi responsabilidad haberlos descargado.</span>
              </label>
              <label className={`flex cursor-pointer items-start gap-2 rounded-2xl border-2 p-3 text-sm ${choice === "cloud" ? "border-[#5646E5] bg-[#ECE9FB]/50" : "border-slate-200"}`}>
                <input type="radio" name="choice" checked={choice === "cloud"} onChange={() => setChoice("cloud")} className="mt-0.5 h-4 w-4" />
                <span><b>☁️ Guárdalo en la nube de ArriendoSeguro (5 años · $20.000).</b> Conservamos también las fotos y soportes; no se borran. Activamos tu custodia y coordinamos el pago simbólico.</span>
              </label>
              <label className={`flex cursor-pointer items-start gap-2 rounded-2xl border-2 p-3 text-sm ${choice === "undecided" ? "border-amber-400 bg-amber-50" : "border-slate-200"}`}>
                <input type="radio" name="choice" checked={choice === "undecided"} onChange={() => setChoice("undecided")} className="mt-0.5 h-4 w-4" />
                <span><b>Decidir después.</b> Tengo <b>7 días</b> para descargar o elegir la nube; si no, las fotos y soportes <b>se eliminarán</b> automáticamente.</span>
              </label>
            </div>

            <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-2xl border-2 border-slate-200 bg-white p-3 text-xs text-slate-700">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#12B886]" />
              <span>Entiendo y acepto que, salvo que elija la custodia en la nube, <b>en 7 días se eliminarán las fotos y soportes</b>; que es <b>mi responsabilidad</b> haber descargado mi información; y <b>eximo a ArriendoSeguro de responsabilidad</b> por ello (Ley 1581 de 2012). El contrato, la recomendación, el historial y la calificación se conservan.</span>
            </label>

            {msg && <p className="mt-2 rounded-lg border border-slate-200 bg-white/80 p-2 text-xs text-slate-800">{msg}</p>}

            <button onClick={() => void closeContract()} disabled={busy} className="mt-3 w-full rounded-2xl bg-[#FF6B4A] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-orange-500/25 transition hover:brightness-105 active:scale-95 disabled:opacity-60">
              {busy ? "Cerrando…" : "Cerrar contrato definitivamente"}
            </button>
          </section>
        </>
      )}
    </main>
  );
}
