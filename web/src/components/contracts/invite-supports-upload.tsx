"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { InviteSupportRow } from "@/domain/party-invite/inviteSupports";

/**
 * Subida de documentos del invitado (inquilino/codeudor) desde su enlace, con
 * el mismo patrón por token de los comprobantes de pago: sign → PUT → submit.
 * No requiere sesión: la identidad ya quedó validada por OTP al abrir el enlace.
 */
export function InviteSupportsUpload({ token, roleLabel }: { token: string; roleLabel: string }) {
  const [supports, setSupports] = useState<InviteSupportRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/party-invite/support/list?token=${encodeURIComponent(token)}`, { cache: "no-store" });
      const j = (await res.json()) as { success?: boolean; supports?: InviteSupportRow[] };
      if (res.ok && j.success) setSupports(j.supports ?? []);
    } catch {
      /* noop */
    }
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function upload(file: File) {
    setBusy(true);
    setMsg("");
    try {
      const signRes = await fetch("/api/party-invite/support/sign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, filename: file.name, contentType: file.type || "application/octet-stream", sizeBytes: file.size }),
      });
      const sign = (await signRes.json()) as { success?: boolean; uploadUrl?: string; storagePath?: string; errors?: { message?: string }[] };
      if (!signRes.ok || !sign.success || !sign.uploadUrl || !sign.storagePath) {
        setMsg(sign.errors?.[0]?.message ?? "No se pudo preparar la subida.");
        return;
      }
      const put = await fetch(sign.uploadUrl, { method: "PUT", headers: { "content-type": file.type || "application/octet-stream" }, body: file });
      if (!put.ok) {
        setMsg("No se pudo subir el archivo. Revisa tu conexión.");
        return;
      }
      const subRes = await fetch("/api/party-invite/support/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, storagePath: sign.storagePath, fileName: file.name, contentType: file.type, sizeBytes: file.size }),
      });
      const sub = (await subRes.json()) as { success?: boolean; errors?: { message?: string }[] };
      if (!subRes.ok || !sub.success) {
        setMsg(sub.errors?.[0]?.message ?? "No se pudo confirmar el documento.");
        return;
      }
      setMsg("Documento subido ✓");
      await refresh();
    } catch {
      setMsg("Error de red al subir el documento.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="rounded-2xl border-2 border-[#5646E5]/20 bg-[#ECE9FB]/40 p-4">
      <p className="text-sm font-bold text-[#5646E5]">📎 Sube tus documentos {roleLabel}</p>
      <p className="mt-0.5 text-[11px] text-slate-600">
        Cédula, carta laboral, colillas, extractos… (PDF, JPG, PNG o WEBP). Puedes subir varios, uno por uno.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        disabled={busy}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }}
        className="mt-3 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[#5646E5] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white disabled:opacity-50"
      />
      {busy && <p className="mt-2 text-xs text-slate-600">Subiendo…</p>}
      {msg && <p className="mt-2 text-xs font-medium text-slate-700">{msg}</p>}

      {supports.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {supports.map((s) => (
            <li key={s.id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-xs text-slate-700">
              <span aria-hidden="true">✓</span>
              <span className="truncate">{s.fileName}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
