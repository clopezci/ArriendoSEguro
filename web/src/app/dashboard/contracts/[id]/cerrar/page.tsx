"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ExpedientePostWizardNav } from "@/components/contracts/expediente-post-wizard-nav";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";

type Choice = "download" | "cloud" | "undecided";

export default function CerrarContratoPage() {
  const id = String(useParams<{ id: string }>().id);
  const router = useRouter();
  const custodyReturn = useSearchParams().get("custody") === "return";
  const { user } = useAuth();
  const [versionId, setVersionId] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [confirmDl, setConfirmDl] = useState(false); // modal de confirmación de "descargar y conservar yo"
  const [downloaded, setDownloaded] = useState(false);
  const [dlBusy, setDlBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  // Guardia de fecha: cerrar el contrato solo tiene sentido cerca del fin (o
  // después), o si ya hubo una terminación anticipada. Si falta mucho, se bloquea.
  const [closeGate, setCloseGate] = useState<"checking" | "ok" | "blocked">("checking");
  const [endDate, setEndDate] = useState("");
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [earlyStep, setEarlyStep] = useState<0 | 1>(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/contracts/latest-version?contractId=${encodeURIComponent(id)}`);
      const j = await r.json();
      setVersionId(j?.version?.id ?? j?.contract?.currentVersionId ?? "");
      const st = j?.contract?.status ?? "";
      setStatus(st);
      const end = String(j?.version?.contractPayload?.lease?.endDate ?? "").trim();
      setEndDate(end);
      if (st === "closed") { setCloseGate("ok"); return; }
      let hasEarly = false;
      if (user) {
        try {
          const tc = await fetch(`/api/contracts/termination/context?contractId=${encodeURIComponent(id)}`, { headers: { ...(await buildAuthHeaders(user)) } }).then((x) => x.json());
          hasEarly = Boolean(tc?.success && tc?.notice && tc.notice.type === "early");
        } catch { /* noop */ }
      }
      if (!end) { setCloseGate("ok"); return; }
      const days = Math.ceil((new Date(end.length === 10 ? `${end}T00:00:00` : end).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      setDaysLeft(days);
      setCloseGate(days <= 7 || days < 0 || hasEarly ? "ok" : "blocked");
    } catch { setCloseGate("ok"); } finally { setLoading(false); }
  }, [id, user]);

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

  /** Inicia el pago de la custodia ($20.000) y redirige al checkout de Wompi. */
  async function payCustody() {
    if (!user) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/contracts/custody/create-order", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({ contractId: id }),
      });
      const j = (await res.json()) as { success?: boolean; checkoutUrl?: string; errors?: { message?: string }[] };
      if (!res.ok || !j.success || !j.checkoutUrl) { setMsg(j.errors?.[0]?.message ?? "No se pudo iniciar el pago de la custodia."); return; }
      window.location.href = j.checkoutUrl;
    } catch {
      setMsg("Error de red al iniciar el pago.");
    } finally {
      setBusy(false);
    }
  }

  async function closeContract(choiceArg: Choice) {
    if (!user) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/contracts/close", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({ contractId: id, choice: choiceArg, consentAccepted: true }),
      });
      const j = (await res.json()) as { success?: boolean; errors?: { message?: string }[] };
      if (!res.ok || !j.success) { setMsg(j.errors?.[0]?.message ?? "No se pudo cerrar el contrato."); return; }
      // Si eligió la nube, el cierre queda registrado y pasamos DIRECTO al pago.
      if (choiceArg === "cloud") { await payCustody(); return; }
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

      {custodyReturn && (
        <p className="rounded-2xl border border-sky-300 bg-sky-50 p-3 text-sm text-sky-900">
          Estamos confirmando tu pago de custodia. Puede tardar un momento; si ya pagaste, tu información quedará
          protegida y no se eliminará. Recarga esta página en unos minutos para verlo reflejado.
        </p>
      )}

      {!loading && isClosed && (
        <section className="rounded-3xl border-2 border-emerald-400 bg-emerald-50 p-5 text-emerald-900">
          <p className="text-lg font-bold">✓ Contrato cerrado</p>
          <p className="mt-1 text-sm">Quedó registrado como conciliado y cerrado. Puedes descargar tu expediente cuando lo necesites.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => void downloadZip()} disabled={dlBusy} className="rounded-xl border-2 border-emerald-500 bg-white px-4 py-2 text-sm font-bold text-emerald-700 disabled:opacity-60">
              {dlBusy ? "Generando…" : "⬇️ Descargar expediente (ZIP)"}
            </button>
            <button onClick={() => void payCustody()} disabled={busy} className="rounded-xl bg-[#5646E5] px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
              {busy ? "Abriendo pago…" : "☁️ Activar custodia en la nube ($20.000)"}
            </button>
          </div>
          <p className="mt-2 text-[11px] text-emerald-800/80">Si no activas la custodia, las fotos y soportes se eliminarán a los 7 días del cierre. El contrato, la recomendación, el historial y la calificación se conservan.</p>
          {msg && <p className="mt-2 text-xs">{msg}</p>}
        </section>
      )}

      {/* Guardia: no cerrar a destiempo sin terminación anticipada. */}
      {!loading && !isClosed && closeGate === "checking" && <p className="text-sm text-slate-400">Verificando la fecha del contrato…</p>}
      {!loading && !isClosed && closeGate === "blocked" && (
        <section className="rounded-3xl border-2 border-amber-300 bg-amber-50/80 p-5">
          {earlyStep === 0 ? (
            <>
              <p className="text-lg font-bold text-amber-900">Aún falta para el fin del contrato</p>
              <p className="mt-1 text-sm text-amber-900/90">
                Cerrar el contrato es el paso FINAL, cuando el arriendo ya terminó. Tu contrato vence el <b>{endDate || "—"}</b>
                {daysLeft !== null ? ` (faltan ~${daysLeft} días)` : ""}. ¿Seguro que quieres cerrarlo ahora?
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => setEarlyStep(1)} className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-white">Sí, continuar</button>
                <button type="button" onClick={() => router.push(`/nuevo/gestionar/${id}`)} className="rounded-xl border-2 border-amber-400 bg-white px-4 py-2 text-sm font-bold text-amber-800">Cancelar</button>
              </div>
            </>
          ) : (
            <>
              <p className="text-lg font-bold text-amber-900">Para cerrar a destiempo, usa Terminación anticipada</p>
              <p className="mt-1 text-sm text-amber-900/90">
                Terminar el arriendo <b>antes de tiempo</b> tiene condiciones legales (preaviso e indemnización, Ley 820). Debes
                registrar primero la <b>Terminación anticipada</b> del contrato; una vez aceptada, podrás cerrarlo aquí.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => router.push(`/dashboard/contracts/${id}/terminacion`)} className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white">Ir a Terminación anticipada →</button>
                <button type="button" onClick={() => setEarlyStep(0)} className="rounded-xl border-2 border-amber-400 bg-white px-4 py-2 text-sm font-bold text-amber-800">Volver</button>
              </div>
            </>
          )}
        </section>
      )}

      {!loading && !isClosed && closeGate === "ok" && (
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

          {/* Paso 2: qué vas a hacer con TU información. Solo dos opciones. */}
          <section className="rounded-3xl border-2 border-slate-200 bg-white/90 p-5 shadow-sm">
            <p className="text-sm font-bold text-slate-900">2) Elige qué vas a hacer con tu información</p>
            <p className="mt-1 text-xs text-slate-600">Al cerrar el contrato, elige una de estas dos opciones:</p>
            <div className="mt-3 grid gap-2">
              <button
                type="button"
                onClick={() => setConfirmDl(true)}
                disabled={busy}
                className="rounded-2xl border-2 border-slate-200 bg-white p-4 text-left transition hover:border-[#5646E5] disabled:opacity-60"
              >
                <span className="block text-sm font-bold text-slate-900">📥 La descargo y la conservo yo</span>
                <span className="mt-0.5 block text-xs text-slate-600">Entiendo que ArriendoSeguro <b>eliminará toda mi información en 7 días</b> y no es responsable de conservarla.</span>
              </button>
              <button
                type="button"
                onClick={() => void closeContract("cloud")}
                disabled={busy}
                className="rounded-2xl border-2 border-[#5646E5] bg-[#ECE9FB]/40 p-4 text-left transition hover:brightness-105 disabled:opacity-60"
              >
                <span className="block text-sm font-bold text-[#3a2fb0]">☁️ Guardar en la nube por 5 años — $20.000</span>
                <span className="mt-0.5 block text-xs text-slate-600">Conservamos tu información 5 años. Al elegir esta opción, te llevamos al <b>pago</b>.</span>
              </button>
            </div>
            {msg && <p className="mt-2 rounded-lg border border-slate-200 bg-white/80 p-2 text-xs text-slate-800">{msg}</p>}
          </section>

          {/* Confirmación de la opción "descargar y conservar yo". */}
          {confirmDl && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setConfirmDl(false)}>
              <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
                <p className="text-base font-bold text-slate-900">Confirma el cierre</p>
                <p className="mt-1 text-sm text-slate-600">
                  ¿Descargaste tu información? Al confirmar, cerramos el contrato y <b>en 7 días se eliminará toda tu
                  información</b>. ArriendoSeguro no será responsable de conservarla.
                </p>
                <div className="mt-4 flex flex-col gap-2">
                  <button type="button" onClick={() => { setConfirmDl(false); void closeContract("download"); }} disabled={busy} className="w-full rounded-2xl bg-[#FF6B4A] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">Sí, cerrar (conservo yo)</button>
                  <button type="button" onClick={() => setConfirmDl(false)} className="w-full rounded-2xl border-2 border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700">Volver</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
