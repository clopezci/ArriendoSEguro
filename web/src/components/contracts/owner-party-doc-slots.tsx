"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
import { requiredDocLabel } from "@/domain/party-invite/requiredDocs";

type OwnerSupportRow = { id: string; fileName: string; docKey?: string; codebtorSlot?: number };

/**
 * Casillas nombradas para que el DUEÑO suba, en su nombre, los documentos que
 * exigió a una parte (inquilino/codeudor) cuando él mismo ingresa los datos.
 * Escribe en la misma carpeta que los soportes del invitado (owner-sign/submit).
 */
export function OwnerPartyDocSlots({
  contractDraftId,
  role,
  codebtorSlot = 0,
  requiredDocs,
}: {
  contractDraftId: string;
  role: "tenant" | "solidaryCoDebtor";
  codebtorSlot?: number;
  requiredDocs: string[];
}) {
  const { user } = useAuth();
  const [rows, setRows] = useState<OwnerSupportRow[]>([]);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const extraRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    if (!user || !contractDraftId) return;
    try {
      const res = await fetch(`/api/party-invite/support/owner-list?contractDraftId=${encodeURIComponent(contractDraftId)}&role=${role}&codebtorSlot=${codebtorSlot}`, {
        headers: { ...(await buildAuthHeaders(user)) },
      });
      const j = (await res.json()) as { success?: boolean; supports?: OwnerSupportRow[] };
      if (res.ok && j.success) setRows(j.supports ?? []);
    } catch {
      /* noop */
    }
  }, [user, contractDraftId, role, codebtorSlot]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function upload(file: File, docKey?: string) {
    if (!user) { setMsg("Inicia sesión para subir el documento."); return; }
    if (!contractDraftId) { setMsg("Aún no está listo el borrador; espera un momento e intenta de nuevo."); return; }
    setBusyKey(docKey ?? "extra");
    setMsg("");
    try {
      // Subida DIRECTA a nuestra API (same-origin, sin URL firmada ni CORS): el
      // servidor guarda en Storage. Evita el "error de red" del PUT del navegador.
      const q = new URLSearchParams({ contractDraftId, role, codebtorSlot: String(codebtorSlot), filename: file.name, contentType: file.type || "application/octet-stream", ...(docKey ? { docKey } : {}) });
      const res = await fetch(`/api/party-invite/support/owner-upload?${q.toString()}`, {
        method: "POST",
        headers: { "content-type": file.type || "application/octet-stream", ...(await buildAuthHeaders(user)) },
        body: file,
      });
      let j: { success?: boolean; errors?: { message?: string }[] } = {};
      try { j = (await res.json()) as typeof j; } catch { /* respuesta no-JSON */ }
      if (!res.ok || !j.success) {
        setMsg(j.errors?.[0]?.message ?? `No se pudo subir el documento (código ${res.status}).`);
        return;
      }
      setMsg("Documento subido ✓");
      await refresh();
    } catch {
      setMsg("Error de red al subir el documento. Revisa tu conexión e intenta de nuevo.");
    } finally {
      setBusyKey(null);
      if (extraRef.current) extraRef.current.value = "";
    }
  }

  const uploadedFor = (key: string) => rows.find((s) => s.docKey === key);
  const doneCount = requiredDocs.filter((k) => uploadedFor(k)).length;

  if (requiredDocs.length === 0) return null;

  return (
    <div className="rounded-2xl border-2 border-slate-200 bg-white/70 p-3">
      <p className="text-sm font-medium text-slate-700">📎 Documentos requeridos ({doneCount}/{requiredDocs.length})</p>
      <p className="mt-0.5 text-xs text-slate-500">Súbelos tú en nombre de la parte, o pídelos por el enlace. PDF, JPG, PNG o WEBP.</p>
      <ul className="mt-2 space-y-2">
        {requiredDocs.map((key) => {
          const done = uploadedFor(key);
          const busy = busyKey === key;
          return (
            <li key={key} className={`rounded-xl border-2 p-2.5 ${done ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white/80"}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-700">{done ? "✓ " : "• "}{requiredDocLabel(key)}</span>
                {done && <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Subido</span>}
              </div>
              {done ? (
                <p className="mt-1 truncate text-[11px] text-slate-500">{done.fileName}</p>
              ) : (
                <label className={`mt-1.5 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#5646E5] px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-105 ${busyKey !== null ? "cursor-not-allowed opacity-50" : ""}`}>
                  {busy ? "Subiendo…" : "Adjuntar"}
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    disabled={busy || busyKey !== null}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f, key); e.target.value = ""; }}
                    className="sr-only"
                  />
                </label>
              )}
              {busy && <p className="mt-1 text-[11px] text-slate-600">Subiendo…</p>}
            </li>
          );
        })}
      </ul>
      {msg && <p className="mt-2 text-xs font-medium text-slate-700">{msg}</p>}
    </div>
  );
}
