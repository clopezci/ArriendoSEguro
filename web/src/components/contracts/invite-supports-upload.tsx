"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { InviteSupportRow } from "@/domain/party-invite/inviteSupports";
import { requiredDocLabel } from "@/domain/party-invite/requiredDocs";
import { UploadPhotoTip } from "@/components/documents/upload-photo-tip";

/**
 * Subida de documentos del invitado (inquilino/codeudor) desde su enlace, con
 * el mismo patrón por token de los comprobantes de pago: sign → PUT → submit.
 * No requiere sesión: la identidad ya quedó validada por OTP al abrir el enlace.
 *
 * Si el DUEÑO exigió documentos (`requiredDocs`), se muestran como CASILLAS
 * NOMBRADAS (una por documento) con estado pendiente/subido, para asegurar la
 * cantidad requerida. Siempre se permite además subir documentos adicionales.
 */
export function InviteSupportsUpload({
  token,
  roleLabel,
  requiredDocs = [],
}: {
  token: string;
  roleLabel: string;
  requiredDocs?: string[];
}) {
  const [supports, setSupports] = useState<InviteSupportRow[]>([]);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [showCreditHelp, setShowCreditHelp] = useState(false);
  const extraRef = useRef<HTMLInputElement>(null);

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

  async function upload(file: File, docKey?: string) {
    setBusyKey(docKey ?? "extra");
    setMsg("");
    try {
      // Subida DIRECTA a nuestra API (same-origin, sin URL firmada ni CORS): el
      // servidor guarda en Storage. Evita el "error de red" del PUT del navegador.
      const q = new URLSearchParams({ token, filename: file.name, contentType: file.type || "application/octet-stream", ...(docKey ? { docKey } : {}) });
      const res = await fetch(`/api/party-invite/support/upload?${q.toString()}`, {
        method: "POST",
        headers: { "content-type": file.type || "application/octet-stream" },
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

  async function remove(id: string) {
    // Sin window.confirm: iOS en modo app instalada (PWA) lo bloquea y el botón
    // "no hacía nada". El botón "Quitar" es explícito y se puede volver a subir.
    try {
      const res = await fetch("/api/party-invite/support/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, id }),
      });
      if (res.ok) { setMsg(""); await refresh(); }
      else setMsg("No se pudo quitar el documento. Intenta de nuevo.");
    } catch {
      setMsg("Error de red al quitar el documento.");
    }
  }

  const uploadedFor = (key: string) => supports.find((s) => s.docKey === key);
  // Documentos ya subidos que NO corresponden a una casilla requerida (adicionales
  // o cargados antes de exigir la lista).
  const extras = supports.filter((s) => !s.docKey || !requiredDocs.includes(s.docKey));
  const doneCount = requiredDocs.filter((k) => uploadedFor(k)).length;

  return (
    <div className="rounded-2xl border-2 border-[#5646E5]/20 bg-[#ECE9FB]/40 p-4">
      <p className="text-sm font-bold text-[#5646E5]">📎 Sube tus documentos {roleLabel}</p>
      <UploadPhotoTip className="mt-2 bg-white/70" />
      {requiredDocs.length > 0 ? (
        <p className="mt-0.5 text-[11px] text-slate-600">
          El arrendador te pide estos documentos ({doneCount}/{requiredDocs.length} subido{doneCount === 1 ? "" : "s"}). Sube cada uno en su casilla (PDF, JPG, PNG o WEBP).
        </p>
      ) : (
        <p className="mt-0.5 text-[11px] text-slate-600">
          Cédula, carta laboral, colillas, extractos… (PDF, JPG, PNG o WEBP). Puedes subir varios, uno por uno.
        </p>
      )}

      {/* Casillas nombradas de los documentos requeridos. */}
      {requiredDocs.length > 0 && (
        <ul className="mt-3 space-y-2">
          {requiredDocs.map((key) => {
            const done = uploadedFor(key);
            const busy = busyKey === key;
            return (
              <li key={key} className={`rounded-xl border-2 p-2.5 ${done ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white/80"}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-700">
                    {done ? "✓ " : "• "}{requiredDocLabel(key)}
                  </span>
                  {done && <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Subido</span>}
                </div>
                {key === "datacredito" && !done && (
                  <div className="mt-1.5 rounded-lg border border-rose-200 bg-rose-50/70 p-2 text-[11px]">
                    <p className="font-semibold text-rose-700">⚠️ El dueño te pide adjuntar tu reporte de DataCrédito. No te bloquea, pero es un requisito que él solicitó.</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <a href="https://www.midatacredito.com/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-[#5646E5] px-2.5 py-1 text-[11px] font-bold text-white hover:brightness-105">📊 Consultar mi DataCrédito</a>
                      <button type="button" onClick={() => setShowCreditHelp((v) => !v)} className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600 hover:border-[#5646E5]">ⓘ ¿Cómo lo hago?</button>
                    </div>
                    {showCreditHelp && (
                      <ol className="mt-2 list-decimal space-y-0.5 pl-4 text-slate-600">
                        <li>Entra a MiDataCrédito y crea tu cuenta (si no la tienes) con tu cédula y correo.</li>
                        <li>Verifica tu identidad y abre tu reporte o puntaje.</li>
                        <li>Toma una foto clara (o descarga el PDF) del reporte.</li>
                        <li>Súbelo aquí abajo con «Elegir documento».</li>
                      </ol>
                    )}
                  </div>
                )}
                {done ? (
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <p className="truncate text-[11px] text-slate-500">{done.fileName}</p>
                    <button type="button" onClick={() => void remove(done.id)} aria-label="Quitar documento" className="flex-none rounded-lg border border-rose-300 bg-white px-2 py-0.5 text-[11px] font-bold text-rose-600 hover:bg-rose-50">Quitar</button>
                  </div>
                ) : (
                  <label className={`mt-1.5 inline-flex items-center gap-2 rounded-lg bg-[#5646E5] px-3 py-1.5 text-xs font-bold text-white transition hover:brightness-105 ${busy || busyKey !== null ? "cursor-not-allowed opacity-50" : "cursor-pointer active:scale-95"}`}>
                    📎 Elegir documento
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
      )}

      {/* Subida libre (adicionales, o único método si no hay lista requerida). */}
      <div className="mt-3">
        {requiredDocs.length > 0 && <p className="mb-1 text-[11px] font-medium text-slate-500">¿Otro documento adicional?</p>}
        <label className={`inline-flex items-center gap-2 rounded-lg bg-[#5646E5] px-4 py-2 text-sm font-bold text-white transition hover:brightness-105 ${busyKey !== null ? "cursor-not-allowed opacity-50" : "cursor-pointer active:scale-95"}`}>
          📎 Subir documento
          <input
            ref={extraRef}
            type="file"
            accept="image/*,application/pdf"
            disabled={busyKey !== null}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }}
            className="sr-only"
          />
        </label>
      </div>
      {busyKey === "extra" && <p className="mt-2 text-xs text-slate-600">Subiendo…</p>}
      {msg && <p className="mt-2 text-xs font-medium text-slate-700">{msg}</p>}

      {extras.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {extras.map((s) => (
            <li key={s.id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-xs text-slate-700">
              <span aria-hidden="true">✓</span>
              <span className="flex-1 truncate">{s.fileName}</span>
              <button type="button" onClick={() => void remove(s.id)} aria-label="Quitar documento" className="flex-none rounded-lg border border-rose-300 bg-white px-2 py-0.5 text-[11px] font-bold text-rose-600 hover:bg-rose-50">Quitar</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
