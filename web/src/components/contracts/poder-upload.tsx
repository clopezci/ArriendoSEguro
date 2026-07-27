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
  const [expanded, setExpanded] = useState(false);
  const [verify, setVerify] = useState<{ status: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const runVerify = useCallback(async () => {
    if (!user || !contractDraftId) return;
    setVerify({ status: "checking" });
    try {
      const res = await fetch("/api/contracts/draft-property-docs/verify-poder", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({ contractDraftId }),
      });
      const j = (await res.json()) as { status?: string };
      setVerify({ status: res.ok && j.status ? j.status : "skipped" });
    } catch {
      setVerify({ status: "skipped" });
    }
  }, [user, contractDraftId]);

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
      void runVerify();
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

  async function remove(id: string) {
    if (!user) return;
    // Sin window.confirm: iOS en modo app instalada (PWA) lo bloquea y el botón
    // "no hacía nada". El botón "Quitar" es explícito y se puede volver a subir.
    try {
      const res = await fetch("/api/contracts/draft-property-docs/delete", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({ id }),
      });
      if (res.ok) { setMsg(""); setVerify(null); await refresh(); onUploaded?.(); }
      else setMsg("No se pudo quitar el poder. Intenta de nuevo.");
    } catch {
      setMsg("Error de red al quitar el poder.");
    }
  }

  const hasDocs = docs.length > 0;
  const showFull = !hasDocs || expanded;
  return (
    <div className="rounded-2xl border-2 border-amber-200 bg-amber-50/50 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-amber-900">📎 {PODER_DOC_LABEL}</p>
        {hasDocs && (
          <button type="button" onClick={() => setExpanded((v) => !v)} className="flex-none text-[11px] font-semibold text-[#5646E5] hover:underline">
            {expanded ? "Listo" : "Cambiar / subir otro"}
          </button>
        )}
      </div>
      {hasDocs && !expanded && <p className="mt-1 text-xs font-medium text-emerald-700">✓ Ya subiste el poder.</p>}
      {showFull && (
        <>
          <p className="mt-0.5 text-xs text-slate-600">Como apoderado, sube el poder que te faculta para arrendar a nombre del propietario. Puedes subirlo ahora o antes de generar el contrato.</p>
          <label className={`mt-2 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#5646E5] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105 ${busy ? "cursor-not-allowed opacity-50" : ""}`}>
            {busy ? "Subiendo…" : hasDocs ? "Subir otro" : "Adjuntar poder"}
            <input ref={inputRef} type="file" accept="image/*,application/pdf" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }} className="sr-only" />
          </label>
          <p className="mt-1 text-[11px] text-slate-500">PDF, JPG, PNG o WEBP.</p>
        </>
      )}
      {msg && <p className="mt-2 text-xs font-medium text-slate-700">{msg}</p>}
      {docs.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-xs text-slate-700">
              <span className="truncate">📎 {d.fileName}</span>
              <span className="flex flex-none items-center gap-1.5">
                <button type="button" onClick={() => void download(d.id)} className="rounded-lg bg-[#5646E5] px-3 py-1 text-[11px] font-bold text-white transition hover:brightness-105">Ver</button>
                <button type="button" onClick={() => void remove(d.id)} aria-label="Quitar el poder" className="rounded-lg border border-rose-300 bg-white px-2.5 py-1 text-[11px] font-bold text-rose-600 transition hover:bg-rose-50">Quitar</button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {verify?.status === "checking" && <p className="mt-2 text-[11px] text-slate-500">Revisando el poder con IA…</p>}
      {verify && (verify.status === "wrong_type" || verify.status === "match") && (
        <div className={`mt-2 rounded-xl border-2 p-2.5 text-xs ${verify.status === "wrong_type" ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
          {verify.status === "wrong_type" ? (
            <>⚠️ <b>Este archivo no parece un poder</b> (documento legal / autorización). Revisa que hayas subido el documento correcto. Es orientativo; si estás seguro, puedes continuar.</>
          ) : (
            <>✓ Revisión IA: el archivo parece un documento/poder válido. Es orientativo; tu declaración jurada respalda la gestión.</>
          )}
        </div>
      )}
    </div>
  );
}
