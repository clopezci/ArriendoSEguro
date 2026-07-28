"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";

/**
 * Expediente — descargas directas en PDF para el dueño (y el admin), pensadas para
 * CELULAR: descargar el CONTRATO y el ACTA de entrega como PDF sin tener que
 * descomprimir el .zip de evidencia. El acta también se envía por correo a las
 * partes al generarla (aquí solo se descarga).
 */
export function ExpedienteDownloads({ contractId, versionId }: { contractId: string; versionId: string }) {
  const { user } = useAuth();
  const [actaUrl, setActaUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<"" | "contract" | "acta">("");
  const [msg, setMsg] = useState("");

  const loadActa = useCallback(async () => {
    if (!user || !versionId) return;
    try {
      const res = await fetch(
        `/api/contracts/annexes/list?contractId=${encodeURIComponent(contractId)}&contractVersionId=${encodeURIComponent(versionId)}`,
        { headers: { ...(await buildAuthHeaders(user)) } },
      );
      const j = (await res.json()) as { success?: boolean; annexes?: Array<{ annexType?: string; pdfUrl?: string | null }> };
      const acta = (j.annexes ?? []).find((a) => a.annexType === "initial_delivery_act" && a.pdfUrl);
      setActaUrl(acta?.pdfUrl ?? null);
    } catch { /* noop */ }
  }, [user, contractId, versionId]);
  useEffect(() => { void loadActa(); }, [loadActa]);

  async function downloadContract() {
    if (!user || !versionId) return;
    setBusy("contract");
    setMsg("");
    try {
      const res = await fetch("/api/contracts/generate-pdf", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({ contractId, contractVersionId: versionId }),
      });
      const j = (await res.json()) as { success?: boolean; pdfUrl?: string; errors?: { message?: string }[] };
      if (j.success && j.pdfUrl) window.open(j.pdfUrl, "_blank", "noopener,noreferrer");
      else setMsg(j.errors?.[0]?.message ?? "No se pudo generar el contrato en PDF.");
    } catch { setMsg("Error de red."); }
    finally { setBusy(""); }
  }

  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white/90 p-4">
      <p className="text-[15px] font-bold">📁 Expediente — descargar en PDF</p>
      <p className="mt-0.5 text-[13px] text-slate-500">Descarga directa al celular, sin descomprimir archivos.</p>
      <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => void downloadContract()}
          disabled={busy === "contract"}
          className="rounded-xl border-2 border-[#5646E5] bg-white px-4 py-2.5 text-sm font-bold text-[#5646E5] transition hover:bg-[#ECE9FB]/50 disabled:opacity-50"
        >
          {busy === "contract" ? "Generando…" : "📄 Descargar contrato (PDF)"}
        </button>
        {actaUrl ? (
          <a
            href={actaUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl border-2 border-[#12B886] bg-white px-4 py-2.5 text-center text-sm font-bold text-[#0B7A55] transition hover:bg-[#12B886]/10"
          >
            📑 Descargar acta de entrega (PDF)
          </a>
        ) : (
          <span className="rounded-xl border-2 border-dashed border-slate-200 px-4 py-2.5 text-center text-sm font-medium text-slate-400">
            Acta: genera el inventario primero
          </span>
        )}
      </div>
      {msg && <p className="mt-2 text-xs font-medium text-rose-600">{msg}</p>}
    </div>
  );
}
