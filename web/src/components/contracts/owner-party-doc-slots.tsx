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
    if (!user) return;
    setBusyKey(docKey ?? "extra");
    setMsg("");
    try {
      const h = { "content-type": "application/json", ...(await buildAuthHeaders(user)) };
      const signRes = await fetch("/api/party-invite/support/owner-sign", {
        method: "POST", headers: h,
        body: JSON.stringify({ contractDraftId, role, codebtorSlot, filename: file.name, contentType: file.type || "application/octet-stream", sizeBytes: file.size }),
      });
      const sign = (await signRes.json()) as { success?: boolean; uploadUrl?: string; storagePath?: string; errors?: { message?: string }[] };
      if (!signRes.ok || !sign.success || !sign.uploadUrl || !sign.storagePath) {
        setMsg(sign.errors?.[0]?.message ?? "No se pudo preparar la subida.");
        return;
      }
      const put = await fetch(sign.uploadUrl, { method: "PUT", headers: { "content-type": file.type || "application/octet-stream" }, body: file });
      if (!put.ok) { setMsg("No se pudo subir el archivo. Revisa tu conexión."); return; }
      const subRes = await fetch("/api/party-invite/support/owner-submit", {
        method: "POST", headers: h,
        body: JSON.stringify({ contractDraftId, role, codebtorSlot, storagePath: sign.storagePath, fileName: file.name, contentType: file.type, sizeBytes: file.size, ...(docKey ? { docKey } : {}) }),
      });
      const sub = (await subRes.json()) as { success?: boolean; errors?: { message?: string }[] };
      if (!subRes.ok || !sub.success) { setMsg(sub.errors?.[0]?.message ?? "No se pudo confirmar el documento."); return; }
      setMsg("Documento subido ✓");
      await refresh();
    } catch {
      setMsg("Error de red al subir el documento.");
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
                <input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  disabled={busy || busyKey !== null}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f, key); e.target.value = ""; }}
                  className="mt-1.5 block w-full text-xs file:mr-2 file:rounded-lg file:border-0 file:bg-[#5646E5] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white disabled:opacity-50"
                />
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
