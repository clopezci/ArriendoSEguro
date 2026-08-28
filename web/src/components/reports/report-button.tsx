"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";

/**
 * Botón "🚩 Reportar" para contenido/abuso entre partes de un contrato
 * (mensajes/fotos de mantenimiento o calificaciones de reputación). Abre un
 * campo para el motivo y lo envía a `/api/reports/abuse` (correo + panel +
 * Telegram). Cumple la política de contenido generado por usuarios de Play.
 */
export function ReportButton({
  area,
  contractId,
  targetId,
  className = "",
}: {
  area: "mantenimiento" | "reputacion" | "otro";
  contractId?: string;
  targetId?: string;
  className?: string;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (reason.trim().length < 5) {
      setErr("Cuéntanos por qué reportas (mín. 5 caracteres).");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/reports/abuse", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({ area, contractId, targetId, reason: reason.trim() }),
      });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) setErr(j.error || "No se pudo enviar el reporte.");
      else {
        setDone(true);
        setOpen(false);
      }
    } catch {
      setErr("Error de red.");
    } finally {
      setBusy(false);
    }
  }

  if (done) return <span className={`text-[11px] font-medium text-emerald-600 ${className}`}>✓ Reporte enviado</span>;

  return (
    <span className={className}>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="Reportar contenido indebido"
          className="text-[11px] font-medium text-slate-400 transition hover:text-rose-600"
        >
          🚩 Reportar
        </button>
      ) : (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <input
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void submit(); if (e.key === "Escape") { setOpen(false); setErr(null); } }}
            placeholder="¿Por qué lo reportas?"
            className="w-52 rounded border border-slate-300 px-2 py-1 text-xs outline-none focus:border-rose-400"
          />
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy}
            className="rounded bg-rose-600 px-2.5 py-1 text-[11px] font-bold text-white disabled:opacity-50"
          >
            {busy ? "…" : "Enviar"}
          </button>
          <button type="button" onClick={() => { setOpen(false); setErr(null); }} className="text-[11px] text-slate-400 hover:text-slate-600">
            Cancelar
          </button>
          {err && <span className="w-full text-[11px] text-rose-600">{err}</span>}
        </span>
      )}
    </span>
  );
}
