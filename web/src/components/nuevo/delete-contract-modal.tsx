"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
import { getAllDrafts, saveAllDrafts } from "@/features/contracts/wizard-state";

/**
 * Eliminar un contrato con TRIPLE validación:
 *  1) aviso de alerta,
 *  2) consentimiento (casilla) de borrado permanente,
 *  3) escribir exactamente «Borrar contrato {nombre del dueño}» (con el ejemplo
 *     en gris como placeholder).
 * Borra en el servidor (DELETE /api/contracts/drafts) y en el navegador.
 */
export function DeleteContractModal({
  contractId,
  ownerName,
  onDeleted,
  onClose,
}: {
  contractId: string;
  ownerName: string;
  onDeleted: () => void;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [consent, setConsent] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const owner = (ownerName || "").trim();
  const phrase = owner ? `Borrar contrato ${owner}` : "Borrar contrato";
  const matches = typed.trim() === phrase;

  async function doDelete() {
    setBusy(true);
    setErr("");
    try {
      // 1) Servidor (best-effort; el backend valida que sea el dueño).
      if (user) {
        try {
          await fetch(`/api/contracts/drafts?id=${encodeURIComponent(contractId)}`, {
            method: "DELETE",
            headers: { ...(await buildAuthHeaders(user)) },
          });
        } catch {
          /* seguimos con el borrado local */
        }
      }
      // 2) Local (localStorage).
      saveAllDrafts(getAllDrafts().filter((d) => d.id !== contractId));
      onDeleted();
    } catch {
      setErr("No se pudo eliminar. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 inline-flex items-center gap-2 rounded-full bg-rose-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-rose-700">
          🗑️ Eliminar contrato
        </div>

        {step === 1 && (
          <>
            <h3 className="mt-2 text-xl font-black text-[#17151F]">¿Seguro que quieres eliminarlo?</h3>
            <p className="mt-2 text-sm text-slate-600">
              Vas a eliminar este contrato y su expediente. <b>Esta acción es permanente</b> y no se puede deshacer:
              se perderán los datos, borradores y avances de este contrato.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" onClick={() => setStep(2)} className="rounded-2xl bg-rose-600 px-5 py-3 text-sm font-bold text-white transition hover:brightness-105 active:scale-95">Sí, continuar</button>
              <button type="button" onClick={onClose} className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-600">Cancelar</button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h3 className="mt-2 text-xl font-black text-[#17151F]">Confirma el borrado</h3>
            <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-2xl border-2 border-rose-200 bg-rose-50/60 p-4 text-sm text-slate-700">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-5 w-5 flex-none accent-rose-600" />
              <span>Entiendo y <b>consiento</b> que el contrato y su expediente se eliminen de forma <b>permanente</b>, y que esta acción <b>no se puede deshacer</b>.</span>
            </label>
            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" disabled={!consent} onClick={() => setStep(3)} className="rounded-2xl bg-rose-600 px-5 py-3 text-sm font-bold text-white transition hover:brightness-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50">Continuar</button>
              <button type="button" onClick={onClose} className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-600">Cancelar</button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h3 className="mt-2 text-xl font-black text-[#17151F]">Escribe para confirmar</h3>
            <p className="mt-2 text-sm text-slate-600">
              Para eliminar definitivamente, escribe exactamente:
            </p>
            <p className="mt-1 select-all rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-800">{phrase}</p>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={phrase}
              autoComplete="off"
              className="mt-3 w-full rounded-2xl border-2 border-slate-200 px-4 py-3 text-sm outline-none transition placeholder:text-slate-300 focus:border-rose-400"
            />
            {err && <p className="mt-2 text-sm font-medium text-rose-700">{err}</p>}
            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" disabled={!matches || busy} onClick={() => void doDelete()} className="rounded-2xl bg-rose-600 px-5 py-3 text-sm font-bold text-white transition hover:brightness-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50">
                {busy ? "Eliminando…" : "Eliminar definitivamente"}
              </button>
              <button type="button" onClick={onClose} className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-600">Cancelar</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
