"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
import { captureOathEvidence } from "@/lib/nuevo/oath-evidence";
import { PROPERTY_DOC_TYPES, PROPERTY_DOC_LABELS, PODER_DOC_TYPE, type PropertyDocType, type DraftPropertyDocRow } from "@/domain/contracts/draftPropertyDocs";

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
  expectedAddress,
  actingAs,
  onUploaded,
}: {
  contractDraftId: string;
  docType: string;
  onDocType: (v: PropertyDocType) => void;
  /** Nombre contra el que se coteja el documento (arrendador; vacío si apoderado sin poderdante). */
  expectedName?: string;
  /** Dirección del inmueble contra la que se coteja el documento (opcional). */
  expectedAddress?: string;
  actingAs?: "" | "owner" | "proxy";
  /** Se llama tras subir con éxito (para refrescar estados externos, p. ej. pendientes). */
  onUploaded?: () => void;
}) {
  const { user } = useAuth();
  const [docs, setDocs] = useState<DraftPropertyDocRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [verify, setVerify] = useState<{ status: VerifyStatus; names?: string[]; reason?: string; addressStatus?: string } | null>(null);
  const [overrideAck, setOverrideAck] = useState(false);
  // Si ya hay documento, mostramos recogido; "Cambiar / subir otro" expande el bloque.
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const runVerify = useCallback(async () => {
    if (!user || !contractDraftId) return;
    setVerify({ status: "checking" });
    try {
      const res = await fetch("/api/contracts/draft-property-docs/verify", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({ contractDraftId, expectedName: expectedName ?? "", expectedAddress: expectedAddress ?? "", actingAs: actingAs || undefined }),
      });
      const j = (await res.json()) as { status?: VerifyStatus; names?: string[]; reason?: string; addressStatus?: string };
      setVerify(res.ok && j.status ? { status: j.status, names: j.names, reason: j.reason, addressStatus: j.addressStatus } : { status: "skipped" });
    } catch {
      setVerify({ status: "skipped" });
    }
  }, [user, contractDraftId, expectedName, expectedAddress, actingAs]);

  const refresh = useCallback(async () => {
    if (!user || !contractDraftId) return;
    try {
      const res = await fetch(`/api/contracts/draft-property-docs/list?contractDraftId=${encodeURIComponent(contractDraftId)}`, {
        headers: { ...(await buildAuthHeaders(user)) },
      });
      const j = (await res.json()) as { success?: boolean; docs?: DraftPropertyDocRow[] };
      // El poder tiene su propia casilla: no lo mezclamos con los de propiedad.
      if (res.ok && j.success) setDocs((j.docs ?? []).filter((d) => d.docType !== PODER_DOC_TYPE));
    } catch {
      /* noop */
    }
  }, [user, contractDraftId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function upload(file: File) {
    if (!user) { setMsg("Inicia sesión para subir el documento."); return; }
    if (!contractDraftId) { setMsg("Aún no está listo el borrador; espera un momento e intenta de nuevo."); return; }
    if (!docType) { setMsg("Primero elige qué documento vas a subir."); return; }
    setBusy(true);
    setMsg("");
    try {
      // Subida DIRECTA a nuestra API (same-origin, sin URL firmada ni CORS): el
      // servidor guarda en Storage. Evita el "error de red" del PUT del navegador.
      const q = new URLSearchParams({ contractDraftId, docType, filename: file.name, contentType: file.type || "application/octet-stream" });
      const res = await fetch(`/api/contracts/draft-property-docs/upload?${q.toString()}`, {
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
      setOverrideAck(false);
      await refresh();
      onUploaded?.();
      void runVerify();
    } catch {
      setMsg("Error de red al subir el documento. Revisa tu conexión e intenta de nuevo.");
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

  const hasDocs = docs.length > 0;
  const showFull = !hasDocs || expanded;
  return (
    <div className="rounded-2xl border-2 border-slate-200 bg-white/70 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-600">Documento que soporta la propiedad</p>
        {hasDocs && (
          <button type="button" onClick={() => setExpanded((v) => !v)} className="flex-none text-[11px] font-semibold text-[#5646E5] hover:underline">
            {expanded ? "Listo" : "Cambiar / subir otro"}
          </button>
        )}
      </div>
      {hasDocs && !expanded && <p className="mt-1 text-xs font-medium text-emerald-700">✓ Ya subiste el documento.</p>}

      {showFull && (
        <>
          <p className="mt-0.5 text-xs text-slate-500">Elige cuál vas a incluir y súbelo (PDF, JPG, PNG o WEBP).</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {PROPERTY_DOC_TYPES.map((t) => (
              <button key={t} type="button" onClick={() => onDocType(t)}
                className={`rounded-2xl border-2 px-3 py-2 text-xs font-medium transition ${docType === t ? "border-[#5646E5] bg-[#ECE9FB] text-[#5646E5]" : "border-slate-200 bg-white text-slate-700 hover:border-[#5646E5]"}`}>
                {PROPERTY_DOC_LABELS[t as PropertyDocType]}
              </button>
            ))}
          </div>
          {/* Input nativo oculto: evitamos el "No file chosen" y usamos nuestro estado. */}
          <label className={`mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#5646E5] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105 ${busy || !docType ? "cursor-not-allowed opacity-50" : ""}`}>
            {busy ? "Subiendo…" : hasDocs ? "Subir otro" : "Adjuntar documento"}
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              disabled={busy || !docType}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }}
              className="sr-only"
            />
          </label>
          <p className="mt-1 text-[11px] text-slate-500">PDF, JPG, PNG o WEBP.{!docType ? " Primero elige el tipo de documento." : ""}</p>
        </>
      )}
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

      {verify && (verify.status !== "skipped" || ["pdf_scanned", "doc_legacy", "unsupported_format", "pdf_error", "docx_error", "docx_empty", "too_large", "ai_off", "provider_error", "download_error"].includes(verify.reason ?? "")) && (
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
              ⚠️ <b>Posible diferencia:</b>{" "}
              {verify.addressStatus === "mismatch" ? (
                <>la <b>dirección del inmueble</b> del documento no coincide con la que ingresaste{expectedAddress ? ` (${expectedAddress})` : ""}. </>
              ) : (
                <>la revisión automática <b>no encontró el nombre de {expectedName}</b> en el documento{verify.names && verify.names.length > 0 ? ` (leyó: ${verify.names.slice(0, 3).join(", ")})` : ""}. </>
              )}
              Verifica que subiste el documento correcto.
              La revisión IA es orientativa y no vinculante: <b>puedes corregir el documento</b> o, si estás seguro, aceptar la declaración para <b>avanzar de todos modos</b>.
              <label className="mt-2 flex cursor-pointer items-start gap-2 rounded-lg border-2 border-rose-300 bg-white/70 p-2 text-[11px] text-slate-700">
                <input
                  type="checkbox"
                  checked={overrideAck}
                  onChange={(e) => { const v = e.target.checked; if (v && !overrideAck) void captureOathEvidence("property_name_mismatch_override", contractDraftId); setOverrideAck(v); }}
                  className="mt-0.5 h-4 w-4 flex-none accent-[#5646E5]"
                />
                <span>
                  Declaro que, pese a la alerta, el documento <b>sí respalda la propiedad</b> y que estoy facultado para arrendar. Asumo la
                  responsabilidad de su veracidad y <b>eximo a ArriendoSeguro</b> de cualquier reclamación por la titularidad o la
                  autenticidad del documento. Queda registrado con evidencia (fecha e IP).
                </span>
              </label>
            </>
          )}
          {verify.status === "unreadable" && (
            <>No pudimos leer el nombre en el documento (revisa que la foto esté nítida). No pasa nada: tu declaración jurada respalda la propiedad.</>
          )}
          {verify.status === "skipped" && ["pdf_scanned", "doc_legacy", "unsupported_format", "pdf_error", "docx_error", "docx_empty"].includes(verify.reason ?? "") && (
            <>📄 No pudimos leer el documento automáticamente (parece <b>escaneado</b> o en un formato no soportado). La IA lee <b>fotos, PDF con texto y Word</b>. Puedes subir una <b>foto nítida</b> o un PDF con texto para que valide el nombre y la dirección, o continuar: tu declaración jurada lo respalda.</>
          )}
          {verify.status === "skipped" && verify.reason === "too_large" && (
            <>El archivo es muy grande para la validación automática. Puedes continuar; tu declaración jurada respalda la propiedad.</>
          )}
          {verify.status === "skipped" && ["ai_off", "provider_error", "download_error"].includes(verify.reason ?? "") && (
            <>La validación automática por IA no está disponible en este momento. Puedes continuar; tu declaración jurada respalda la propiedad.</>
          )}
        </div>
      )}

      <p className="mt-2 text-[10px] leading-snug text-slate-400">
        Un asistente automatizado revisa este documento para <b>detectar inconsistencias</b> (nombre y dirección).
        Es orientativo y <b>no vinculante</b>; el documento se procesa únicamente para esta validación. Al subirlo
        autorizas este tratamiento (Ley 1581 de 2012).
      </p>
    </div>
  );
}
