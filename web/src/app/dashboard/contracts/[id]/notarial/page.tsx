"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
import { ExpedienteNav } from "@/components/contracts/expediente-nav";
import { ContractPdfDownloadLink } from "@/components/contracts/contract-pdf-download";
import { RequiresSavedContract } from "@/components/contracts/requires-saved-contract";

function notarialAnnexFirestoreId(contractId: string, contractVersionId: string): string {
  return `annex_notarial_auth_${contractId}_${contractVersionId}`;
}

/**
 * Bloque 9: trámite opcional de autenticación notarial (orientación + descargas + carga de PDF).
 */
export default function NotarialOptionalPage() {
  const id = String(useParams<{ id: string }>().id);
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [versionId, setVersionId] = useState<string | null>(null);
  const [contractStatus, setContractStatus] = useState("");
  const [uploadMsg, setUploadMsg] = useState("");
  const [uploadBusy, setUploadBusy] = useState(false);
  const [zipBusy, setZipBusy] = useState(false);
  const [hasNotarialAnnex, setHasNotarialAnnex] = useState(false);
  const [notarialPdfUrl, setNotarialPdfUrl] = useState<string | null>(null);

  const annexId = versionId && id ? notarialAnnexFirestoreId(id, versionId) : null;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const lvRes = await fetch(`/api/contracts/latest-version?contractId=${encodeURIComponent(id)}`);
      const lv = (await lvRes.json()) as {
        success?: boolean;
        contract?: { currentVersionId?: string; status?: string } | null;
        errors?: { message?: string }[];
      };
      if (!lvRes.ok || !lv.success) {
        setError(lv.errors?.[0]?.message ?? "No se pudo cargar el expediente.");
        setVersionId(null);
        return;
      }
      const cid = lv.contract?.currentVersionId ?? null;
      setVersionId(cid);
      setContractStatus(lv.contract?.status ?? "");
      if (!cid) {
        setHasNotarialAnnex(false);
        setNotarialPdfUrl(null);
        return;
      }
      const listRes = await fetch(
        `/api/contracts/annexes/list?contractId=${encodeURIComponent(id)}&contractVersionId=${encodeURIComponent(cid)}`,
      );
      const listData = (await listRes.json()) as {
        success?: boolean;
        annexes?: Array<{ annexType?: string; pdfUrl?: string | null; id?: string }>;
      };
      const nid = notarialAnnexFirestoreId(id, cid);
      const row = listRes.ok && listData.success && Array.isArray(listData.annexes)
        ? listData.annexes.find((a) => a.annexType === "notarial_authentication" || a.id === nid)
        : undefined;
      setHasNotarialAnnex(Boolean(row?.pdfUrl || row));
      setNotarialPdfUrl(row?.pdfUrl?.trim() ? row.pdfUrl : null);
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function downloadNotaryZip() {
    if (!versionId || !user) {
      setUploadMsg("Inicia sesión y asegúrate de tener una versión guardada del contrato.");
      return;
    }
    setZipBusy(true);
    setUploadMsg("");
    setError("");
    try {
      const qs = new URLSearchParams({
        contractId: id,
        contractVersionId: versionId,
        context: "notary",
      });
      const res = await fetch(`/api/contracts/evidence-bundle?${qs.toString()}`, {
        headers: { ...(await buildAuthHeaders(user)) },
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { errors?: { message?: string }[] };
        setUploadMsg(j.errors?.[0]?.message ?? "No se pudo generar el paquete.");
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get("content-disposition");
      const match = cd?.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? `paquete-notaria-${id}.zip`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setUploadMsg(
        "Descarga iniciada. Lleva el ZIP a la notaría junto con las indicaciones que te den allí. Revisa 00-LEEME.txt dentro del archivo.",
      );
    } catch {
      setUploadMsg("Error de red al generar el ZIP.");
    } finally {
      setZipBusy(false);
    }
  }

  async function onUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!versionId || !user) {
      setUploadMsg("Inicia sesión y confirma que hay una versión guardada del contrato.");
      return;
    }
    const fd = new FormData(e.currentTarget);
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setUploadMsg("Selecciona un archivo PDF.");
      return;
    }
    setUploadBusy(true);
    setUploadMsg("");
    setError("");
    try {
      const body = new FormData();
      body.set("contractId", id);
      body.set("contractVersionId", versionId);
      body.set("file", file);
      const res = await fetch("/api/contracts/notarial/upload", {
        method: "POST",
        headers: { ...(await buildAuthHeaders(user)) },
        body,
      });
      const data = (await res.json()) as
        | { success: true; pdfUrl: string | null; uploadedAt: string }
        | { success: false; errors: { message: string }[] };
      if (!res.ok || !data.success) {
        const msg = !data.success ? data.errors?.[0]?.message : "No se pudo subir el archivo.";
        setUploadMsg(msg ?? "No se pudo subir el archivo.");
        return;
      }
      setUploadMsg("Listo: guardamos el PDF autenticado en el expediente.");
      void load();
      e.currentTarget.reset();
    } catch {
      setUploadMsg("Error de red al subir el archivo.");
    } finally {
      setUploadBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6 text-slate-900">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-violet-700">Paso 12 · Evidencias</p>
        <h1 className="text-2xl font-bold">Autenticación notarial (opcional)</h1>
        <p className="text-sm text-slate-600">
          Si las partes deciden autenticar el contrato en una notaría, este espacio te orienta: descargas el paquete
          útil, llevas el trámite presencialmente (o por los canales que indique el notario) y vuelves aquí para
          archivar el PDF que te entreguen. ArriendoSeguro no reemplaza al notario ni valida el contenido del
          documento autenticado.
        </p>
        <Link href={`/dashboard/contracts/${id}/evidencias`} className="inline-block text-sm text-violet-700 underline">
          ← Evidencias del expediente
        </Link>
      </header>

      <ExpedienteNav contractId={id} />

      <RequiresSavedContract id={id}>
      {loading && <p className="text-sm text-slate-600">Cargando…</p>}
      {error && (
        <p className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800" role="alert">
          {error}
        </p>
      )}

      {!loading && !error && (
        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-violet-50/50 p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-violet-950">Próximamente: notariado digital</h2>
            <p className="mt-1 text-xs text-violet-900/90">
              Estamos evaluando aliados para ofrecer notariado digital con costos y alcance claros. Mientras tanto,
              el flujo es manual: imprimes o llevas el PDF, autenticas según te indique el notario y cargas el PDF
              final aquí.
            </p>
          </section>

          {!versionId && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Primero guarda una versión del contrato en la vista previa. Sin versión no podemos asociar el archivo
              autenticado al expediente.
            </p>
          )}

          {versionId && (
            <>
              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="text-sm font-semibold text-slate-900">Estado del expediente</h2>
                <p className="mt-1 text-xs text-slate-600">
                  Estado: <strong>{contractStatus || "—"}</strong>. Versión contractual actual:{" "}
                  <span className="font-mono text-xs">{versionId}</span>
                </p>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="text-sm font-semibold text-slate-900">1. Descargas para el trámite</h2>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
                  <li>
                    <ContractPdfDownloadLink contractVersionId={versionId} label="PDF del contrato" />
                    <span className="text-slate-500"> — si ya lo generaste en vista previa.</span>
                  </li>
                  <li>
                    <button
                      type="button"
                      disabled={zipBusy || !user}
                      onClick={() => void downloadNotaryZip()}
                      className="text-left text-violet-700 underline disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {zipBusy ? "Generando paquete…" : "Paquete ZIP (contrato, inventario, anexos disponibles)"}
                    </button>
                    {!user && (
                      <span className="ml-2 text-xs text-amber-800">Inicia sesión para descargar el ZIP.</span>
                    )}
                  </li>
                </ul>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="text-sm font-semibold text-slate-900">2. Subir el PDF autenticado</h2>
                <p className="mt-1 text-xs text-slate-600">
                  Solo quien figure como parte del contrato (correo de la cuenta coincide con arrendador, arrendatario o
                  codeudor) puede subir el archivo. Tamaño máximo: 15 MB. Formato: PDF.
                </p>
                {hasNotarialAnnex && (
                  <p className="mt-2 text-xs text-slate-700">
                    Ya hay un PDF registrado para esta versión. Si subes otro archivo, reemplazamos el anterior en el
                    expediente.
                  </p>
                )}
                <form className="mt-4 space-y-3" onSubmit={(ev) => void onUpload(ev)}>
                  <input
                    name="file"
                    type="file"
                    accept="application/pdf"
                    required
                    className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-violet-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-violet-900"
                  />
                  <button
                    type="submit"
                    disabled={uploadBusy || !user}
                    className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {uploadBusy ? "Subiendo…" : "Guardar PDF en el expediente"}
                  </button>
                </form>
                {annexId && notarialPdfUrl && (
                  <p className="mt-3 text-sm">
                    <a className="text-violet-700 underline" href={notarialPdfUrl} target="_blank" rel="noreferrer">
                      Abrir último PDF autenticado cargado
                    </a>
                    <span className="text-slate-500"> — también aparece en el ZIP de evidencia.</span>
                  </p>
                )}
                {annexId && !notarialPdfUrl && hasNotarialAnnex && (
                  <p className="mt-3 text-sm">
                    <a
                      className="text-violet-700 underline"
                      href={`/api/contracts/annexes/pdf?annexId=${encodeURIComponent(annexId)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Descargar PDF autenticado (enlace seguro)
                    </a>
                  </p>
                )}
              </section>
            </>
          )}

          {uploadMsg && (
            <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">{uploadMsg}</p>
          )}
        </div>
      )}
      </RequiresSavedContract>
    </main>
  );
}
