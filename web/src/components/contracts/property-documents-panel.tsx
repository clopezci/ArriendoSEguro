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
 * Carga de documentos de propiedad / poder (escritura, certificado de libertad,
 * **poder autenticado** del apoderado). Sube a Firebase Storage vía URL firmada.
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
  const [docType, setDocType] = useState<PropertyDocType>(highlightPoder ? "poder" : "escritura");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
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

  async function upload() {
    if (!user || !file) return;
    setBusy(true);
    setMsg("");
    try {
      const urlRes = await fetch("/api/contracts/property-documents/upload-url", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({
          contractId,
          contractVersionId,
          docType,
          filename: file.name,
          contentType: file.type || "application/octet-stream",
          sizeBytes: file.size,
        }),
      });
      const urlJson = (await urlRes.json()) as { success?: boolean; uploadUrl?: string; storagePath?: string; errors?: { message?: string }[] };
      if (!urlRes.ok || !urlJson.success || !urlJson.uploadUrl || !urlJson.storagePath) {
        setMsg(urlJson.errors?.[0]?.message ?? "No se pudo preparar la subida.");
        return;
      }
      const put = await fetch(urlJson.uploadUrl, {
        method: "PUT",
        headers: { "content-type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!put.ok) {
        setMsg("No se pudo subir el archivo.");
        return;
      }
      const confirmRes = await fetch("/api/contracts/property-documents/confirm", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({
          contractId,
          contractVersionId,
          docType,
          storagePath: urlJson.storagePath,
          contentType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          originalFilename: file.name,
        }),
      });
      const confirmJson = (await confirmRes.json()) as { success?: boolean; errors?: { message?: string }[] };
      if (!confirmRes.ok || !confirmJson.success) {
        setMsg(confirmJson.errors?.[0]?.message ?? "No se pudo registrar el documento.");
        return;
      }
      setFile(null);
      setMsg("Documento cargado.");
      await load();
    } catch {
      setMsg("Error de red al subir.");
    } finally {
      setBusy(false);
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
        {highlightPoder
          ? "Como actúas en calidad de apoderado, sube aquí el poder autenticado. También puedes adjuntar escritura o certificado de libertad."
          : "Opcional: escritura, certificado de libertad y tradición o poder. Quedan como soporte del expediente."}
      </p>
      {!contractVersionId && (
        <p className="mt-2 text-xs text-amber-700">Guarda primero una versión del contrato para poder adjuntar documentos.</p>
      )}

      {contractVersionId && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium text-slate-700">
              1. ¿Qué documento es?
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value as PropertyDocType)}
                className="mt-1 block w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
              >
                {PROPERTY_DOC_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {PROPERTY_DOC_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium text-slate-700">
              2. Elige el archivo
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                aria-label="Archivo de documento de propiedad"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="mt-1 block w-full text-xs file:mr-2 file:rounded file:border-0 file:bg-violet-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-violet-800"
              />
              <span className="mt-1 block text-[11px] font-normal text-slate-500">
                PDF, JPG, PNG o WEBP. {file ? `Seleccionado: ${file.name}` : "Aún no has elegido archivo."}
              </span>
            </label>
          </div>
          <button
            type="button"
            disabled={busy || !file}
            onClick={() => void upload()}
            className="mt-3 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Subiendo…" : "3. Subir documento"}
          </button>
        </div>
      )}

      {docs.length > 0 && (
        <ul className="mt-3 space-y-1">
          {docs.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 bg-white/80 px-2 py-1.5 text-[11px]">
              <span className="min-w-0">
                <strong className="text-slate-800">{PROPERTY_DOC_TYPE_LABELS[d.docType as PropertyDocType] ?? d.docType}</strong>
                <span className="text-slate-500"> · {d.originalFilename}</span>
              </span>
              <button type="button" onClick={() => void view(d.storagePath)} className="rounded border border-slate-400 px-2 py-0.5 text-slate-800">
                Ver
              </button>
            </li>
          ))}
        </ul>
      )}
      {msg && <p className="mt-2 text-[11px] text-slate-600">{msg}</p>}
    </section>
  );
}
