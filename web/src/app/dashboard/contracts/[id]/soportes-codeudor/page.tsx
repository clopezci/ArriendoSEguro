"use client";

import { ExpedienteNav } from "@/components/contracts/expediente-nav";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
import {
  CODEBTOR_SUPPORT_MAX_BYTES,
  CODEBTOR_SUPPORT_MAX_PER_TYPE,
  CODEBTOR_SUPPORT_TYPES,
  type CodebtorSupportType,
} from "@/domain/codebtor-supports/support-schema";
import { useAuth } from "@/contexts/auth-context";
import Link from "next/link";
import { useParams } from "next/navigation";
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

export default function SoportesCodeudorPage() {
  const id = String(useParams<{ id: string }>().id);
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [versionId, setVersionId] = useState<string | null>(null);
  const [hasCodebtor, setHasCodebtor] = useState(false);
  const [supports, setSupports] = useState<ListRow[]>([]);
  const [viewerRole, setViewerRole] = useState<string | null>(null);
  const [uploadType, setUploadType] = useState<CodebtorSupportType>("carta_laboral");
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
      const lvRes = await fetch(`/api/contracts/latest-version?contractId=${encodeURIComponent(id)}`);
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
      setHasCodebtor(Boolean(lv.version?.hasSolidaryCoDebtor));
      if (!cid || !user) {
        setSupports([]);
        setViewerRole(null);
        return;
      }
      const listRes = await fetch(
        `/api/codebtor-supports/list?contractId=${encodeURIComponent(id)}&contractVersionId=${encodeURIComponent(cid)}`,
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
  }, [id, user]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onPickFile(file: File | null) {
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
          contractId: id,
          contractVersionId: versionId,
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
          contractId: id,
          contractVersionId: versionId,
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
        body: JSON.stringify({ contractId: id, contractVersionId: versionId, supportId }),
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
        contractId: id,
        contractVersionId: versionId,
        supportId,
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

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6 text-slate-900">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-violet-700">Expediente</p>
        <h1 className="text-2xl font-bold">Soportes del codeudor</h1>
        <p className="text-sm text-slate-600">
          Archivos de respaldo económico del codeudor solidario. Solo el arrendador puede subir o borrar; las demás
          partes pueden listar y descargar. Los archivos válidos también se incluyen en el paquete ZIP de evidencia.
        </p>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link href={`/dashboard/contracts/${id}/preview`} className="text-violet-700 underline">
            Vista previa
          </Link>
          <span className="text-slate-400">·</span>
          <Link href={`/dashboard/contracts/${id}/codebtor`} className="text-violet-700 underline">
            Paso codeudor (wizard)
          </Link>
        </div>
      </header>

      <ExpedienteNav contractId={id} />

      {loading && <p className="text-sm text-slate-600">Cargando…</p>}
      {error && (
        <p className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800" role="alert">
          {error}
        </p>
      )}

      {!loading && !error && (
        <div className="space-y-6">
          {!user && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Inicia sesión con el correo de una parte del contrato para ver o cargar soportes.
            </p>
          )}

          {user && !versionId && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Aún no hay una versión guardada del contrato. Guarda una versión en la vista previa para habilitar esta
              sección.
            </p>
          )}

          {user && versionId && !hasCodebtor && (
            <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">
              Esta versión del contrato no incluye codeudor solidario. Si lo necesitas, vuelve al paso codeudor en el
              wizard, guarda de nuevo en vista previa y regresa aquí.
            </p>
          )}

          {user && versionId && hasCodebtor && (
            <>
              {viewerRole === "landlord" && (
                <section className="rounded-xl border border-violet-200 bg-violet-50/40 p-4 shadow-sm">
                  <h2 className="text-sm font-semibold text-violet-950">Cargar archivo</h2>
                  <p className="mt-1 text-xs text-violet-900/90">
                    Hasta {CODEBTOR_SUPPORT_MAX_PER_TYPE} archivos por tipo; máximo {CODEBTOR_SUPPORT_MAX_BYTES / 1024 / 1024} MB
                    cada uno (PDF, JPG o PNG).
                  </p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <label className="text-sm text-slate-700">
                      Tipo de soporte
                      <select
                        className="ml-2 rounded border border-slate-300 bg-white px-2 py-1 text-sm"
                        value={uploadType}
                        onChange={(e) => setUploadType(e.target.value as CodebtorSupportType)}
                        disabled={busy}
                      >
                        {CODEBTOR_SUPPORT_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {SUPPORT_LABELS[t]} ({countsByType.get(t) ?? 0}/{CODEBTOR_SUPPORT_MAX_PER_TYPE})
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:border-violet-500">
                      <input
                        type="file"
                        accept="application/pdf,image/png,image/jpeg"
                        className="hidden"
                        disabled={busy}
                        onChange={(e) => {
                          const f = e.target.files?.[0] ?? null;
                          e.target.value = "";
                          void onPickFile(f);
                        }}
                      />
                      {busy ? "Procesando…" : "Seleccionar archivo"}
                    </label>
                  </div>
                </section>
              )}

              {viewerRole && viewerRole !== "landlord" && (
                <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">
                  Tu rol en este expediente puede ver y descargar soportes; la carga la realiza el arrendador.
                </p>
              )}

              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="text-sm font-semibold text-slate-900">Archivos registrados</h2>
                {supports.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-600">Todavía no hay soportes cargados para esta versión.</p>
                ) : (
                  <ul className="mt-3 divide-y divide-slate-200 text-sm">
                    {supports.map((s) => (
                      <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                        <div>
                          <p className="font-medium text-slate-900">{SUPPORT_LABELS[s.supportType]}</p>
                          <p className="text-xs text-slate-600">
                            {s.originalFilename} · {(s.sizeBytes / 1024).toFixed(1)} KB ·{" "}
                            {new Date(s.uploadedAt).toLocaleString("es-CO")}
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
                          {viewerRole === "landlord" && (
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
      )}
    </main>
  );
}
