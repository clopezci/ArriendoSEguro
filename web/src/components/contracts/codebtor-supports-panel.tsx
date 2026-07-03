"use client";

import { buildAuthHeaders } from "@/lib/auth/authHeaders";
import {
  CODEBTOR_SUPPORT_MAX_BYTES,
  CODEBTOR_SUPPORT_MAX_PER_TYPE,
  CODEBTOR_SUPPORT_TYPES,
  type CodebtorSupportType,
  type SupportParty,
} from "@/domain/codebtor-supports/support-schema";
import { useAuth } from "@/contexts/auth-context";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

const SUPPORT_LABELS: Record<CodebtorSupportType, string> = {
  carta_laboral: "Carta laboral o certificación de ingresos",
  colilla: "Colilla de pago / comprobante de nómina",
  certificado_libertad: "Certificado de libertad y tradición u otro soporte de activos",
  extracto: "Extractos bancarios",
  declaracion_renta: "Declaración de renta (cuando aplique)",
  otro: "Otro soporte relacionado",
};

type ListRow = {
  id: string;
  supportType: CodebtorSupportType;
  contentType: string;
  sizeBytes: number;
  originalFilename: string;
  uploadedAt: string;
};

type PartySupportsPanelProps = {
  contractId: string;
  /** En el wizard: mensaje más corto y sin cabecera duplicada. */
  variant?: "wizard" | "page";
  /** Parte cuyos soportes se gestionan. Por defecto codeudor (compatibilidad). */
  party?: SupportParty;
};

const PARTY_LABEL: Record<SupportParty, string> = { codebtor: "del codeudor", tenant: "de ingresos del inquilino" };

export function PartySupportsPanel({ contractId, variant = "page", party = "codebtor" }: PartySupportsPanelProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [versionId, setVersionId] = useState<string | null>(null);
  const [hasCodebtor, setHasCodebtor] = useState(false);
  const [supports, setSupports] = useState<ListRow[]>([]);
  const [viewerRole, setViewerRole] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const countsByType = useMemo(() => {
    const m = new Map<CodebtorSupportType, number>();
    for (const t of CODEBTOR_SUPPORT_TYPES) m.set(t, 0);
    for (const s of supports) m.set(s.supportType, (m.get(s.supportType) ?? 0) + 1);
    return m;
  }, [supports]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const lvRes = await fetch(`/api/contracts/latest-version?contractId=${encodeURIComponent(contractId)}`);
      const lv = (await lvRes.json()) as {
        success?: boolean;
        contract?: { currentVersionId?: string } | null;
        version?: { id?: string; hasSolidaryCoDebtor?: boolean } | null;
        errors?: { message?: string }[];
      };
      if (!lvRes.ok || lv.success === false) {
        setError(lv.errors?.[0]?.message ?? "No se pudo cargar el expediente.");
        setVersionId(null);
        setHasCodebtor(false);
        setSupports([]);
        setViewerRole(null);
        return;
      }
      const cid = lv.contract?.currentVersionId ?? null;
      setVersionId(cid);
      // El inquilino siempre "existe"; para codeudor depende de la versión.
      setHasCodebtor(party === "tenant" ? true : Boolean(lv.version?.hasSolidaryCoDebtor));
      if (!cid || !user) {
        setSupports([]);
        setViewerRole(null);
        return;
      }
      const listRes = await fetch(
        `/api/codebtor-supports/list?contractId=${encodeURIComponent(contractId)}&contractVersionId=${encodeURIComponent(cid)}&party=${encodeURIComponent(party)}`,
        { headers: { ...(await buildAuthHeaders(user)) } },
      );
      const listData = (await listRes.json()) as {
        success?: boolean;
        supports?: ListRow[];
        viewerRole?: string;
        errors?: { message?: string }[];
      };
      if (!listRes.ok || !listData.success) {
        setError(listData.errors?.[0]?.message ?? "No se pudo listar soportes.");
        setSupports([]);
        setViewerRole(null);
        return;
      }
      setSupports((listData.supports ?? []) as ListRow[]);
      setViewerRole(listData.viewerRole ?? null);
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }, [contractId, user, party]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onPickFile(file: File | null, uploadType: CodebtorSupportType) {
    setMsg("");
    if (!file || !user || !versionId) return;
    if (file.size <= 0 || file.size > CODEBTOR_SUPPORT_MAX_BYTES) {
      setMsg(`El archivo debe pesar entre 1 byte y ${Math.floor(CODEBTOR_SUPPORT_MAX_BYTES / 1024 / 1024)} MB.`);
      return;
    }
    const n = countsByType.get(uploadType) ?? 0;
    if (n >= CODEBTOR_SUPPORT_MAX_PER_TYPE) {
      setMsg(`Ya tienes ${CODEBTOR_SUPPORT_MAX_PER_TYPE} archivos de este tipo en esta versión.`);
      return;
    }
    const contentType =
      file.type === "application/pdf"
        ? "application/pdf"
        : file.type === "image/png"
          ? "image/png"
          : file.type === "image/jpeg"
            ? "image/jpeg"
            : null;
    if (!contentType) {
      setMsg("Formato no permitido. Usa PDF, JPG o PNG.");
      return;
    }
    setBusy(true);
    try {
      const upRes = await fetch("/api/codebtor-supports/upload-url", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({
          contractId,
          contractVersionId: versionId,
          party,
          supportType: uploadType,
          filename: file.name,
          contentType,
          sizeBytes: file.size,
        }),
      });
      const upJson = (await upRes.json()) as {
        success?: boolean;
        uploadUrl?: string;
        storagePath?: string;
        errors?: { message?: string }[];
      };
      if (!upRes.ok || !upJson.success || !upJson.uploadUrl || !upJson.storagePath) {
        setMsg(upJson.errors?.[0]?.message ?? "No se pudo iniciar la subida.");
        return;
      }
      const putRes = await fetch(upJson.uploadUrl, {
        method: "PUT",
        headers: { "content-type": contentType },
        body: file,
      });
      if (!putRes.ok) {
        setMsg("No se pudo subir el archivo a almacenamiento. Intenta de nuevo.");
        return;
      }
      const cfRes = await fetch("/api/codebtor-supports/confirm", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({
          contractId,
          contractVersionId: versionId,
          party,
          supportType: uploadType,
          storagePath: upJson.storagePath,
          contentType,
          sizeBytes: file.size,
          originalFilename: file.name,
        }),
      });
      const cfJson = (await cfRes.json()) as { success?: boolean; errors?: { message?: string }[] };
      if (!cfRes.ok || !cfJson.success) {
        setMsg(cfJson.errors?.[0]?.message ?? "No se pudo registrar el archivo.");
        return;
      }
      setMsg("Archivo cargado correctamente.");
      await load();
    } catch {
      setMsg("Error de red durante la carga.");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(supportId: string) {
    if (!user || !versionId) return;
    if (!window.confirm("¿Eliminar este soporte del expediente? Esta acción no se puede deshacer.")) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/codebtor-supports/delete", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({ contractId, contractVersionId: versionId, party, supportId }),
      });
      const j = (await res.json()) as { success?: boolean; errors?: { message?: string }[] };
      if (!res.ok || !j.success) {
        setMsg(j.errors?.[0]?.message ?? "No se pudo eliminar.");
        return;
      }
      setMsg("Soporte eliminado.");
      await load();
    } catch {
      setMsg("Error de red al eliminar.");
    } finally {
      setBusy(false);
    }
  }

  async function onDownload(supportId: string, filename: string) {
    if (!user || !versionId) return;
    setBusy(true);
    setMsg("");
    try {
      const qs = new URLSearchParams({
        contractId,
        contractVersionId: versionId,
        supportId,
        party,
      });
      const res = await fetch(`/api/codebtor-supports/download-url?${qs.toString()}`, {
        headers: { ...(await buildAuthHeaders(user)) },
      });
      const j = (await res.json()) as {
        success?: boolean;
        downloadUrl?: string;
        errors?: { message?: string }[];
      };
      if (!res.ok || !j.success || !j.downloadUrl) {
        setMsg(j.errors?.[0]?.message ?? "No se pudo generar la descarga.");
        return;
      }
      window.open(j.downloadUrl, "_blank", "noopener,noreferrer");
      setMsg(`Descarga iniciada: ${filename}`);
    } catch {
      setMsg("Error de red al descargar.");
    } finally {
      setBusy(false);
    }
  }

  const shellClass =
    variant === "wizard"
      ? "rounded-xl border border-violet-200 bg-violet-50/50 p-4"
      : "space-y-4";
  const canUpload = viewerRole === "landlord" || (party === "tenant" && viewerRole === "tenant");

  return (
    <div className={shellClass}>
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-slate-900">Soportes {PARTY_LABEL[party]} (PDF o imágenes)</h3>
        <p className="text-xs text-slate-600">
          Carta laboral, colillas, extractos u otros respaldos económicos.{" "}
          {party === "tenant" ? "El arrendador o el propio inquilino" : "Solo el arrendador"} sube o elimina; las demás
          partes pueden descargar. Requiere haber guardado una versión en vista previa.
        </p>
      </div>

      {loading && <p className="text-sm text-slate-600">Cargando soportes…</p>}
      {error && (
        <p className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800" role="alert">
          {error}
        </p>
      )}

      {!loading && !error && !user && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Inicia sesión con el correo de una parte del contrato para ver o cargar soportes.
        </p>
      )}

      {!loading && !error && user && !versionId && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Aún no hay versión guardada del contrato. Completa la{" "}
          <Link href={`/dashboard/contracts/${contractId}/preview`} className="font-medium text-violet-800 underline">
            vista previa
          </Link>{" "}
          y pulsa «Guardar versión» para habilitar la carga aquí.
        </p>
      )}

      {!loading && !error && user && versionId && !hasCodebtor && (
        <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">
          Esta versión no incluye codeudor. Si lo necesitas, vuelve al paso codeudor, guarda de nuevo en vista previa y
          regresa.
        </p>
      )}

      {!loading && !error && user && versionId && hasCodebtor && (
        <>
          {canUpload && (
            <section className="rounded-lg border border-violet-200 bg-white p-3 shadow-sm">
              <p className="text-xs text-slate-600">
                Adjunta cada soporte con su botón. Hasta {CODEBTOR_SUPPORT_MAX_PER_TYPE} por tipo; máx.{" "}
                {CODEBTOR_SUPPORT_MAX_BYTES / 1024 / 1024} MB (PDF, JPG o PNG).
              </p>
              <ul className="mt-3 space-y-2">
                {CODEBTOR_SUPPORT_TYPES.map((t) => {
                  const n = countsByType.get(t) ?? 0;
                  const done = n > 0;
                  return (
                    <li
                      key={t}
                      className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 ${done ? "border-emerald-300 bg-emerald-50/40" : "border-slate-200 bg-white"}`}
                    >
                      <span className="flex items-center gap-2 text-sm font-medium text-slate-800">
                        <span aria-hidden="true">📄</span>
                        {SUPPORT_LABELS[t]}
                        {done ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">✓ {n} cargado(s)</span>
                        ) : (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Pendiente</span>
                        )}
                      </span>
                      <label className="cursor-pointer rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500">
                        {done ? "Adjuntar otro" : "Adjuntar"}
                        <input
                          type="file"
                          accept="application/pdf,image/png,image/jpeg"
                          className="sr-only"
                          disabled={busy}
                          onChange={(e) => {
                            const f = e.target.files?.[0] ?? null;
                            e.target.value = "";
                            void onPickFile(f, t);
                          }}
                        />
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {viewerRole && !canUpload && (
            <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">
              Puedes ver y descargar soportes; la carga la realiza el arrendador.
            </p>
          )}

          <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-700">Archivos registrados</h4>
            {supports.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600">Todavía no hay soportes para esta versión.</p>
            ) : (
              <ul className="mt-2 divide-y divide-slate-200 text-sm">
                {supports.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <div>
                      <p className="font-medium text-slate-900">{SUPPORT_LABELS[s.supportType]}</p>
                      <p className="text-xs text-slate-600">
                        {s.originalFilename} · {(s.sizeBytes / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded border border-slate-300 px-2 py-1 text-xs hover:border-violet-500"
                        disabled={busy}
                        onClick={() => void onDownload(s.id, s.originalFilename)}
                      >
                        Descargar
                      </button>
                      {canUpload && (
                        <button
                          type="button"
                          className="rounded border border-rose-300 px-2 py-1 text-xs text-rose-800 hover:bg-rose-50"
                          disabled={busy}
                          onClick={() => void onDelete(s.id)}
                        >
                          Eliminar
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {msg && (
            <p className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm text-slate-800" role="status">
              {msg}
            </p>
          )}
        </>
      )}
    </div>
  );
}
