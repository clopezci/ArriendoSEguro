"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
import { PROPERTY_DOC_TYPES, PROPERTY_DOC_LABELS, type PropertyDocType, type DraftPropertyDocRow } from "@/domain/contracts/draftPropertyDocs";

/**
 * Reemplazo de la matrícula: el dueño ELIGE qué documento soporta la propiedad
 * (certificado de tradición, servicios públicos, impuesto predial, escritura u
 * otro) y lo SUBE. Reusa el patrón de subida por URL firmada (sign → PUT →
 * submit). Etapa de borrador (autenticado por el dueño, keyed por draftId).
 */
type VerifyStatus = "match" | "mismatch" | "unreadable" | "skipped" | "checking";

export function PropertyDocUpload({
  contractDraftId,
  docType,
  onDocType,
  expectedName,
  actingAs,
}: {
  contractDraftId: string;
  docType: string;
  onDocType: (v: PropertyDocType) => void;
  /** Nombre contra el que se coteja el documento (arrendador; vacío si apoderado sin poderdante). */
  expectedName?: string;
  actingAs?: "" | "owner" | "proxy";
}) {
  const { user } = useAuth();
  const [docs, setDocs] = useState<DraftPropertyDocRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [verify, setVerify] = useState<{ status: VerifyStatus; names?: string[] } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const runVerify = useCallback(async () => {
    if (!user || !contractDraftId) return;
    setVerify({ status: "checking" });
    try {
      const res = await fetch("/api/contracts/draft-property-docs/verify", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({ contractDraftId, expectedName: expectedName ?? "", actingAs: actingAs || undefined }),
      });
      const j = (await res.json()) as { status?: VerifyStatus; names?: string[] };
      setVerify(res.ok && j.status ? { status: j.status, names: j.names } : { status: "skipped" });
    } catch {
      setVerify({ status: "skipped" });
    }
  }, [user, contractDraftId, expectedName, actingAs]);

  const refresh = useCallback(async () => {
    if (!user || !contractDraftId) return;
    try {
      const res = await fetch(`/api/contracts/draft-property-docs/list?contractDraftId=${encodeURIComponent(contractDraftId)}`, {
        headers: { ...(await buildAuthHeaders(user)) },
      });
      const j = (await res.json()) as { success?: boolean; docs?: DraftPropertyDocRow[] };
      if (res.ok && j.success) setDocs(j.docs ?? []);
    } catch {
      /* noop */
    }
  }, [user, contractDraftId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function upload(file: File) {
    if (!user) return;
    if (!docType) { setMsg("Primero elige qué documento vas a subir."); return; }
    setBusy(true);
    setMsg("");
    try {
      const h = { "content-type": "application/json", ...(await buildAuthHeaders(user)) };
      const signRes = await fetch("/api/contracts/draft-property-docs/sign", {
        method: "POST", headers: h,
        body: JSON.stringify({ contractDraftId, docType, filename: file.name, contentType: file.type || "application/octet-stream", sizeBytes: file.size }),
      });
      const sign = (await signRes.json()) as { success?: boolean; uploadUrl?: string; storagePath?: string; errors?: { message?: string }[] };
      if (!signRes.ok || !sign.success || !sign.uploadUrl || !sign.storagePath) {
        setMsg(sign.errors?.[0]?.message ?? "No se pudo preparar la subida.");
        return;
      }
      const put = await fetch(sign.uploadUrl, { method: "PUT", headers: { "content-type": file.type || "application/octet-stream" }, body: file });
      if (!put.ok) { setMsg("No se pudo subir el archivo. Revisa tu conexión."); return; }
      const subRes = await fetch("/api/contracts/draft-property-docs/submit", {
        method: "POST", headers: h,
        body: JSON.stringify({ contractDraftId, docType, storagePath: sign.storagePath, fileName: file.name, contentType: file.type, sizeBytes: file.size }),
      });
      const sub = (await subRes.json()) as { success?: boolean; errors?: { message?: string }[] };
      if (!subRes.ok || !sub.success) { setMsg(sub.errors?.[0]?.message ?? "No se pudo confirmar el documento."); return; }
      setMsg("Documento subido ✓");
      await refresh();
      void runVerify();
    } catch {
      setMsg("Error de red al subir el documento.");
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
    <div className="rounded-2xl border-2 border-slate-200 bg-white/70 p-3">
      <p className="text-sm font-medium text-slate-600">Documento que soporta la propiedad</p>
      <p className="mt-0.5 text-xs text-slate-500">Elige cuál vas a incluir y súbelo (PDF, JPG, PNG o WEBP).</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {PROPERTY_DOC_TYPES.map((t) => (
          <button key={t} type="button" onClick={() => onDocType(t)}
            className={`rounded-2xl border-2 px-3 py-2 text-xs font-medium transition ${docType === t ? "border-[#5646E5] bg-[#ECE9FB] text-[#5646E5]" : "border-slate-200 bg-white text-slate-700 hover:border-[#5646E5]"}`}>
            {PROPERTY_DOC_LABELS[t as PropertyDocType]}
          </button>
        ))}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        disabled={busy || !docType}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }}
        className="mt-3 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[#5646E5] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white disabled:opacity-50"
      />
      {busy && <p className="mt-2 text-xs text-slate-600">Subiendo…</p>}
      {msg && <p className="mt-2 text-xs font-medium text-slate-700">{msg}</p>}

      {docs.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-xs text-slate-700">
              <span className="truncate">📎 {PROPERTY_DOC_LABELS[d.docType as PropertyDocType] ?? d.docType} · {d.fileName}</span>
              <button type="button" onClick={() => void download(d.id)} className="flex-none rounded-lg bg-[#5646E5] px-3 py-1 text-[11px] font-bold text-white transition hover:brightness-105">Ver</button>
            </li>
          ))}
        </ul>
      )}

      {verify && verify.status !== "skipped" && (
        <div
          className={`mt-3 rounded-xl border-2 p-3 text-xs ${
            verify.status === "match"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : verify.status === "mismatch"
                ? "border-rose-200 bg-rose-50 text-rose-800"
                : "border-slate-200 bg-slate-50 text-slate-600"
          }`}
        >
          {verify.status === "checking" && "Revisando el documento con IA…"}
          {verify.status === "match" && (
            <>✓ Revisión IA: el documento <b>parece estar a nombre de {expectedName}</b>. Recuerda que es orientativo; tu declaración jurada es la que vale.</>
          )}
          {verify.status === "mismatch" && (
            <>
              ⚠️ <b>Posible incumplimiento:</b> la revisión automática <b>no encontró el nombre de {expectedName}</b> en el documento
              {verify.names && verify.names.length > 0 ? ` (leyó: ${verify.names.slice(0, 3).join(", ")})` : ""}. Verifica que subiste el documento correcto.
              Si estás seguro, tu declaración jurada de facultad te permite continuar. La revisión IA es orientativa y no vinculante.
            </>
          )}
          {verify.status === "unreadable" && (
            <>No pudimos leer el nombre en el documento (revisa que la foto esté nítida). No pasa nada: tu declaración jurada respalda la propiedad.</>
          )}
        </div>
      )}
    </div>
  );
}
