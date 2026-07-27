"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
import {
  PROPERTY_DOC_TYPES,
  PROPERTY_DOC_TYPE_LABELS,
  type PropertyDocType,
} from "@/domain/property-documents/property-documents";

type Doc = { id: string; docType: string; originalFilename: string; storagePath: string; sizeBytes: number; uploadedAt: string };

/**
 * Carga de documentos de propiedad / poder como **lista por documento**: cada
 * tipo (escritura, certificado de libertad, poder, otro) tiene su estado
 * (✓ Cargado / Pendiente) y su propio botón **Adjuntar**. Sin dropdowns que
 * confundan. Sube a Firebase Storage vía URL firmada.
 */
export function PropertyDocumentsPanel({
  contractId,
  contractVersionId,
  highlightPoder = false,
}: {
  contractId: string;
  contractVersionId: string;
  highlightPoder?: boolean;
}) {
  const { user } = useAuth();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [busyType, setBusyType] = useState<string>("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    if (!user || !contractVersionId) return;
    try {
      const qs = new URLSearchParams({ contractId, contractVersionId });
      const res = await fetch(`/api/contracts/property-documents/list?${qs}`, { headers: { ...(await buildAuthHeaders(user)) } });
      const j = (await res.json()) as { success?: boolean; documents?: Doc[] };
      if (res.ok && j.success) setDocs(j.documents ?? []);
    } catch {
      /* noop */
    }
  }, [user, contractId, contractVersionId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function uploadFor(docType: PropertyDocType, file: File) {
    if (!user) return;
    setBusyType(docType);
    setMsg("");
    try {
      const urlRes = await fetch("/api/contracts/property-documents/upload-url", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({ contractId, contractVersionId, docType, filename: file.name, contentType: file.type || "application/octet-stream", sizeBytes: file.size }),
      });
      const urlJson = (await urlRes.json()) as { success?: boolean; uploadUrl?: string; storagePath?: string; errors?: { message?: string }[] };
      if (!urlRes.ok || !urlJson.success || !urlJson.uploadUrl || !urlJson.storagePath) {
        setMsg(urlJson.errors?.[0]?.message ?? "No se pudo preparar la subida.");
        return;
      }
      const put = await fetch(urlJson.uploadUrl, { method: "PUT", headers: { "content-type": file.type || "application/octet-stream" }, body: file });
      if (!put.ok) {
        setMsg("No se pudo subir el archivo.");
        return;
      }
      const confirmRes = await fetch("/api/contracts/property-documents/confirm", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({ contractId, contractVersionId, docType, storagePath: urlJson.storagePath, contentType: file.type || "application/octet-stream", sizeBytes: file.size, originalFilename: file.name }),
      });
      const confirmJson = (await confirmRes.json()) as { success?: boolean; errors?: { message?: string }[] };
      if (!confirmRes.ok || !confirmJson.success) {
        setMsg(confirmJson.errors?.[0]?.message ?? "No se pudo registrar el documento.");
        return;
      }
      setMsg(`Cargado: ${PROPERTY_DOC_TYPE_LABELS[docType]}.`);
      await load();
    } catch {
      setMsg("Error de red al subir.");
    } finally {
      setBusyType("");
    }
  }

  async function view(storagePath: string) {
    if (!user) return;
    try {
      const qs = new URLSearchParams({ contractId, contractVersionId, storagePath });
      const res = await fetch(`/api/contracts/property-documents/download-url?${qs}`, { headers: { ...(await buildAuthHeaders(user)) } });
      const j = (await res.json()) as { success?: boolean; downloadUrl?: string };
      if (res.ok && j.success && j.downloadUrl) window.open(j.downloadUrl, "_blank", "noopener");
    } catch {
      /* noop */
    }
  }

  return (
    <section className={`rounded-xl border p-4 ${highlightPoder ? "border-amber-300 bg-amber-50/50" : "border-slate-300 bg-white/95"}`}>
      <h3 className="text-sm font-semibold text-slate-900">Documentos de propiedad / poder</h3>
      <p className="mt-1 text-xs text-slate-600">
        Adjunta cada documento con su botón. Son opcionales (el poder es necesario si actúas como apoderado).
      </p>
      {!contractVersionId && (
        <p className="mt-2 text-xs text-amber-700">Guarda primero una versión del contrato para poder adjuntar documentos.</p>
      )}

      {contractVersionId && (
        <ul className="mt-3 space-y-2">
          {PROPERTY_DOC_TYPES.map((t) => {
            const ofType = docs.filter((d) => d.docType === t);
            const done = ofType.length > 0;
            const isPoder = t === "poder";
            return (
              <li
                key={t}
                className={`rounded-lg border p-3 ${done ? "border-emerald-300 bg-emerald-50/40" : isPoder && highlightPoder ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm font-medium text-slate-800">
                    <span aria-hidden="true">📄</span>
                    {PROPERTY_DOC_TYPE_LABELS[t]}
                    {done ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">✓ Cargado</span>
                    ) : (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Pendiente</span>
                    )}
                  </span>
                  <label className="cursor-pointer rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500">
                    {busyType === t ? "Subiendo…" : done ? "Adjuntar otro" : "Adjuntar"}
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      className="sr-only"
                      disabled={busyType === t}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void uploadFor(t, f);
                        e.currentTarget.value = "";
                      }}
                    />
                  </label>
                </div>
                {ofType.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {ofType.map((d) => (
                      <li key={d.id} className="flex items-center justify-between gap-2 text-[11px] text-slate-600">
                        <span className="min-w-0 truncate">{d.originalFilename}</span>
                        <button type="button" onClick={() => void view(d.storagePath)} className="shrink-0 rounded border border-slate-400 px-2 py-0.5 text-slate-800">
                          Ver
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-2 text-[11px] text-slate-500">PDF, JPG, PNG o WEBP (máx. 15 MB).</p>
      {msg && <p className="mt-1 text-[11px] text-emerald-700">{msg}</p>}
    </section>
  );
}
