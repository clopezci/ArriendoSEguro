"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";

/**
 * Tarjeta "Iniciar contrato definitivo": al iniciarlo, el contrato queda guardado,
 * iniciado y NO se podrá borrar (solo el admin desbloquea), y se consume el cupo
 * Plus. Un nuevo contrato tendrá valor normal. Cierra el abuso de "pagar, borrar y
 * rehacer gratis". Muestra estado (iniciado / por iniciar) leyendo /lifecycle.
 */
export function StartDefinitiveContract({ contractId }: { contractId: string }) {
  const { user } = useAuth();
  const [started, setStarted] = useState<boolean | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/contracts/lifecycle?contractId=${encodeURIComponent(contractId)}`, {
        headers: { ...(await buildAuthHeaders(user)) },
      });
      const j = (await res.json()) as { success?: boolean; started?: boolean };
      if (j.success) setStarted(Boolean(j.started));
    } catch { /* noop */ }
  }, [user, contractId]);
  useEffect(() => { void load(); }, [load]);

  async function start() {
    if (!user) return;
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/contracts/start-definitive", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({ contractId }),
      });
      const j = (await res.json()) as { success?: boolean; errors?: { message?: string }[] };
      if (j.success) { setStarted(true); setConfirmOpen(false); }
      else setErr(j.errors?.[0]?.message ?? "No se pudo iniciar el contrato.");
    } catch { setErr("Error de red."); }
    finally { setBusy(false); }
  }

  if (started === null) return null;

  if (started) {
    return (
      <div className="mt-6 flex items-center gap-3 rounded-2xl border-2 border-emerald-300 bg-emerald-50/80 p-4">
        <span className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-emerald-100 text-xl">🔒</span>
        <div className="min-w-0">
          <b className="text-[15px] text-emerald-900">Contrato iniciado (definitivo)</b>
          <p className="mt-0.5 text-[13px] text-emerald-800/80">
            Queda guardado e iniciado; no se puede borrar. Puedes seguir gestionando pagos, novedades, soportes y contactos.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mt-6 rounded-2xl border-2 border-[#5646E5]/40 bg-[#ECE9FB]/40 p-4">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-[#5646E5] text-xl text-white">🚀</span>
          <div className="min-w-0 flex-1">
            <b className="text-[15px]">Iniciar contrato definitivo</b>
            <p className="mt-0.5 text-[13px] text-slate-600">Cuando ya esté todo listo (contrato, firmas, inventario y acta), inícialo para dejarlo en firme.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          className="mt-3 w-full rounded-xl bg-[#5646E5] px-4 py-3 text-sm font-bold text-white transition hover:brightness-105 active:scale-[0.99]"
        >
          🚀 Iniciar contrato definitivo
        </button>
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-modal="true" onClick={() => !busy && setConfirmOpen(false)}>
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-black text-[#17151F]">¿Iniciar el contrato definitivo?</h3>
            <p className="mt-2 text-sm text-slate-600">Al iniciarlo:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
              <li>El contrato queda <b>guardado e iniciado</b> y <b>ya no se podrá borrar</b>.</li>
              <li>Podrás seguir ajustando cosas que <b>no alteran el contrato</b> (recordatorios, contactos de notificación, novedades y soportes), pero <b>no</b> las partes, el canon, las fechas ni las cláusulas.</li>
              <li>Se consume tu <b>cupo pagado</b>; un <b>nuevo contrato tendrá valor normal</b>.</li>
              <li>Si necesitas un cambio de fondo, deberá autorizarlo el administrador.</li>
            </ul>
            {err && <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-2 text-sm text-rose-700">{err}</p>}
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" disabled={busy} onClick={() => setConfirmOpen(false)} className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-600 disabled:opacity-50">Cancelar</button>
              <button type="button" disabled={busy} onClick={() => void start()} className="rounded-2xl bg-[#5646E5] px-5 py-3 text-sm font-bold text-white transition hover:brightness-105 disabled:opacity-50">
                {busy ? "Iniciando…" : "Sí, iniciar definitivo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
