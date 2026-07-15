"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
import { PODER_DOC_TYPE, PODER_DOC_LABEL, type DraftPropertyDocRow } from "@/domain/contracts/draftPropertyDocs";

/**
 * Subida del PODER del apoderado (documento aparte del soporte de propiedad).
 * Cuando el arrendador actúa como apoderado, aquí carga el poder que lo faculta
 * para arrendar a nombre del propietario. Usa el mismo proxy same-origin que el
 * documento de propiedad (docType="poder"). Se puede subir ahora o al final
 * (queda pendiente para generar). No requiere validación IA.
 */
export function PoderUpload({ contractDraftId, onUploaded }: { contractDraftId: string; onUploaded?: () => void }) {
  const { user } = useAuth();
  const [docs, setDocs] = useState<DraftPropertyDocRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    if (!user || !contractDraftId) return;
    try {
      const res = await fetch(`/api/contracts/draft-property-docs/list?contractDraftId=${encodeURIComponent(contractDraftId)}`, {
        headers: { ...(await buildAuthHeaders(user)) },
      });
      const j = (await res.json()) as { success?: boolean; docs?: DraftPropertyDocRow[] };
      if (res.ok && j.success) setDocs((j.docs ?? []).filter((d) => d.docType === PODER_DOC_TYPE));
    } catch {
      /* noop */
    }
  }, [user, contractDraftId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function upload(file: File) {
    if (!user) { setMsg("Inicia sesión para subir el poder."); return; }
    if (!contractDraftId) { setMsg("Aún no está listo el borrador; espera un momento e intenta de nuevo."); return; }
    setBusy(true);
    setMsg("");
    try {
      const q = new URLSearchParams({ contractDraftId, docType: PODER_DOC_TYPE, filename: file.name, contentType: file.type || "application/octet-stream" });
      const res = await fetch(`/api/contracts/draft-property-docs/upload?${q.toString()}`, {
        method: "POST",
        headers: { "content-type": file.type || "application/octet-stream", ...(await buildAuthHeaders(user)) },
        body: file,
      });
      let j: { success?: boolean; errors?: { message?: string }[] } = {};
      try { j = (await res.json()) as typeof j; } catch { /* no-JSON */ }
      if (!res.ok || !j.success) { setMsg(j.errors?.[0]?.message ?? `No se pudo subir el poder (código ${res.status}).`); return; }
      setMsg("Poder subido ✓");
      await refresh();
      onUploaded?.();
    } catch {
      setMsg("Error de red al subir el poder. Revisa tu conexión e intenta de nuevo.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function download(id: string) {
    if (!user) return;
    try {
      const res = await fetch(`/api/contracts/draft-property-docs/download-url?id=${encodeURIComponent(id)}`, { headers: { ...(await buildAuthHeaders(user)) } });
      const j = (await res.json()) as { success?: boolean; downloadUrl?: string };
      if (res.ok && j.success && j.downloadUrl) window.open(j.downloadUrl, "_blank", "noopener,noreferrer");
    } catch {
      /* noop */
    }
  }

  return (
    <div className="rounded-2xl border-2 border-amber-200 bg-amber-50/50 p-3">
      <p className="text-sm font-semibold text-amber-900">📎 {PODER_DOC_LABEL}</p>
      <p className="mt-0.5 text-xs text-slate-600">Como apoderado, sube el poder que te faculta para arrendar a nombre del propietario. Puedes subirlo ahora o antes de generar el contrato.</p>
      <label className={`mt-2 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#5646E5] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105 ${busy ? "cursor-not-allowed opacity-50" : ""}`}>
        {busy ? "Subiendo…" : docs.length > 0 ? "Subir otro" : "Adjuntar poder"}
        <input ref={inputRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }} className="sr-only" />
      </label>
      <p className="mt-1 text-[11px] text-slate-500">PDF, JPG, PNG o WEBP.</p>
      {msg && <p className="mt-2 text-xs font-medium text-slate-700">{msg}</p>}
      {docs.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-xs text-slate-700">
              <span className="truncate">📎 {d.fileName}</span>
              <button type="button" onClick={() => void download(d.id)} className="flex-none rounded-lg bg-[#5646E5] px-3 py-1 text-[11px] font-bold text-white transition hover:brightness-105">Ver</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
