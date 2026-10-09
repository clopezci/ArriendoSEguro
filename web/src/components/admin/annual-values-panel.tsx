"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";

type Status = "updated" | "pending";
type View = {
  currentYear: number;
  status: { ipc: Status; uvt: Status };
  notice: { ipc: string; uvt: string };
  meta: { lastRunAt: string | null; ipcLastNote: string | null; uvtLastNote: string | null };
};

function Badge({ status }: { status: Status }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        status === "updated" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"
      }`}
    >
      {status === "updated" ? "Actualizado" : "Aún sin actualizar"}
    </span>
  );
}

/**
 * Estado de los valores anuales oficiales (IPC del DANE, UVT de la DIAN) que
 * usan el blog, la calculadora y las renovaciones. La revisión automática corre
 * 1 vez por semana en enero y febrero; "Revisar ahora" la ejecuta al instante.
 */
export function AnnualValuesPanel({ onChanged }: { onChanged?: () => void }) {
  const { user } = useAuth();
  const [view, setView] = useState<View | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch("/api/admin/annual-values", { headers: { ...(await buildAuthHeaders(user)) } });
      const j = (await res.json()) as { success?: boolean } & Partial<View>;
      if (res.ok && j.success && j.status && j.notice && j.meta) {
        setView({ currentYear: j.currentYear ?? new Date().getFullYear(), status: j.status, notice: j.notice, meta: j.meta });
      }
    } catch {
      /* silencioso: no debe romper el panel */
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  async function checkNow() {
    if (!user) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/annual-values", {
        method: "POST",
        headers: { ...(await buildAuthHeaders(user)) },
      });
      const j = (await res.json()) as { success?: boolean; result?: { ipc?: { changed?: boolean; note?: string }; uvt?: { note?: string } } } & Partial<View>;
      if (!res.ok || !j.success) {
        setMsg("No se pudo revisar (¿sesión de admin con 2FA vigente?).");
        return;
      }
      if (j.status && j.notice && j.meta) {
        setView({ currentYear: j.currentYear ?? new Date().getFullYear(), status: j.status, notice: j.notice, meta: j.meta });
      }
      setMsg([j.result?.ipc?.note, j.result?.uvt?.note].filter(Boolean).join(" · "));
      if (j.result?.ipc?.changed) onChanged?.();
    } catch {
      setMsg("Error de red.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-6 rounded-xl border border-sky-300 bg-sky-50/50 p-4">
      <h2 className="text-sm font-semibold text-slate-900">Valores anuales oficiales (actualización automática)</h2>
      <p className="mt-1 text-xs leading-relaxed text-slate-600">
        El blog, la calculadora y las renovaciones usan estos valores como variables. Cada semana de{" "}
        <strong>enero y febrero</strong> se revisa el <strong>IPC en el DANE</strong> y, si ya salió el de diciembre, se
        actualiza solo (y te llega un Telegram). La <strong>UVT</strong> la fija la DIAN por resolución: no hay dato
        automático, así que te avisamos para cargarla abajo en «Impuestos». Mientras falte, la web dice «aún sin
        actualizar según la fuente».
      </p>
      {view ? (
        <div className="mt-3 space-y-2 text-xs text-slate-800">
          <p className="flex flex-wrap items-center gap-2">
            <strong>IPC (DANE)</strong> <Badge status={view.status.ipc} /> <span>{view.notice.ipc}</span>
          </p>
          <p className="flex flex-wrap items-center gap-2">
            <strong>UVT (DIAN)</strong> <Badge status={view.status.uvt} /> <span>{view.notice.uvt}</span>
          </p>
          <p className="text-[11px] text-slate-500">
            Última revisión automática:{" "}
            {view.meta.lastRunAt ? new Date(view.meta.lastRunAt).toLocaleString("es-CO", { timeZone: "America/Bogota" }) : "aún ninguna"}
            {view.meta.ipcLastNote ? ` · ${view.meta.ipcLastNote}` : ""}
          </p>
        </div>
      ) : (
        <p className="mt-2 text-xs text-slate-400">Cargando…</p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy || !user}
          onClick={() => void checkNow()}
          className="rounded border border-sky-600 bg-sky-600 px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Revisando…" : "Revisar ahora en el DANE"}
        </button>
        {msg && <span className="text-[11px] font-medium text-slate-700">{msg}</span>}
      </div>
    </section>
  );
}
