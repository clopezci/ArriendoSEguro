"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
import { ExpedienteNav } from "@/components/contracts/expediente-nav";
import { ContractPdfDownloadLink } from "@/components/contracts/contract-pdf-download";

type AnnexRow = {
  id?: string;
  annexType?: string;
  title?: string;
  status?: string;
  pdfUrl?: string | null;
  generatedAt?: string;
};

/**
 * Bloque 8 (inicio): punto único para descargar el paquete lógico de evidencia
 * del expediente. Incluye descarga en ZIP (autenticada) que agrupa PDF/HTML disponibles.
 */
export default function EvidenciaExpedientePage() {
  const id = String(useParams<{ id: string }>().id);
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [zipBusy, setZipBusy] = useState(false);
  const [zipMsg, setZipMsg] = useState("");
  const [contractStatus, setContractStatus] = useState("");
  const [versionId, setVersionId] = useState<string | null>(null);
  const [annexes, setAnnexes] = useState<AnnexRow[]>([]);
  const [evidenceAnnex, setEvidenceAnnex] = useState<{
    title: string;
    pdfUrl: string | null;
    htmlContent?: string;
    generatedAt?: string | null;
  } | null>(null);
  const [inventoryId, setInventoryId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const lvRes = await fetch(`/api/contracts/latest-version?contractId=${encodeURIComponent(id)}`);
      const lv = (await lvRes.json()) as {
        success?: boolean;
        contract?: { currentVersionId?: string; status?: string } | null;
        errors?: { message: string }[];
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
        setAnnexes([]);
        setEvidenceAnnex(null);
        setInventoryId(null);
        return;
      }

      const [listRes, evRes, invRes] = await Promise.all([
        fetch(
          `/api/contracts/annexes/list?contractId=${encodeURIComponent(id)}&contractVersionId=${encodeURIComponent(cid)}`,
        ),
        fetch(
          `/api/contracts/annexes/electronic-signature?contractId=${encodeURIComponent(id)}&contractVersionId=${encodeURIComponent(cid)}`,
        ),
        fetch(
          `/api/inventory/by-contract?contractId=${encodeURIComponent(id)}&contractVersionId=${encodeURIComponent(cid)}`,
        ),
      ]);

      const listData = (await listRes.json()) as { success?: boolean; annexes?: AnnexRow[] };
      if (listRes.ok && listData.success && Array.isArray(listData.annexes)) {
        setAnnexes(listData.annexes);
      } else {
        setAnnexes([]);
      }

      const evData = (await evRes.json()) as {
        success?: boolean;
        annex?: {
          title: string;
          pdfUrl: string | null;
          htmlContent?: string;
          generatedAt?: string | null;
        } | null;
      };
      if (evRes.ok && evData.success && evData.annex) setEvidenceAnnex(evData.annex);
      else setEvidenceAnnex(null);

      const invData = (await invRes.json()) as { success?: boolean; inventory?: { id?: string } | null };
      if (invRes.ok && invData.success && invData.inventory?.id) setInventoryId(invData.inventory.id);
      else setInventoryId(null);
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function downloadEvidenceZip() {
    if (!versionId || !user) {
      setZipMsg("Inicia sesión y asegúrate de tener una versión guardada del contrato.");
      return;
    }
    setZipBusy(true);
    setZipMsg("");
    setError("");
    try {
      const qs = new URLSearchParams({ contractId: id, contractVersionId: versionId });
      const res = await fetch(`/api/contracts/evidence-bundle?${qs.toString()}`, {
        headers: { ...(await buildAuthHeaders(user)) },
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { errors?: { message?: string }[] };
        const msg = j.errors?.[0]?.message ?? "No se pudo generar el paquete.";
        setZipMsg(msg);
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get("content-disposition");
      const match = cd?.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? `evidencia-${id}.zip`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setZipMsg("Descarga iniciada. Revisa la carpeta de descargas y el archivo 00-LEEME.txt dentro del ZIP.");
    } catch {
      setZipMsg("Error de red al generar el ZIP.");
    } finally {
      setZipBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6 text-slate-900">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-violet-700">Paso 12 · Evidencias</p>
        <h1 className="text-2xl font-bold">Paquete de evidencia (descargas)</h1>
        <p className="text-sm text-slate-600">
          Aquí reunimos los enlaces de descarga del contrato y anexos generados en la plataforma. También puedes bajar un
          solo archivo ZIP (contrato, inventario, acta si existen, anexos con PDF o HTML como el registro de pagos). Si
          falta algo, genera primero el PDF o el anexo desde la vista previa o el módulo correspondiente.
        </p>
        <Link href={`/dashboard/contracts/${id}/evidencias`} className="inline-block text-sm text-violet-700 underline">
          ← Evidencias del expediente
        </Link>
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
          {!versionId && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Aún no hay una versión guardada del contrato. Guarda una versión en la vista previa para habilitar las
              descargas.
            </p>
          )}

          {versionId && (
            <>
              <section className="rounded-xl border border-violet-200 bg-violet-50/40 p-4 shadow-sm">
                <h2 className="text-sm font-semibold text-violet-950">Paquete ZIP de evidencia</h2>
                <p className="mt-1 text-xs text-violet-900/90">
                  Solo quien figure como parte del contrato (mismo correo de la cuenta) puede descargar este paquete.
                  Dentro del ZIP, el archivo <strong>00-LEEME.txt</strong> lista lo incluido y lo omitido.
                </p>
                <button
                  type="button"
                  disabled={zipBusy || !user}
                  onClick={() => void downloadEvidenceZip()}
                  className="mt-3 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {zipBusy ? "Generando ZIP…" : "Descargar ZIP de evidencia"}
                </button>
                {!user && (
                  <p className="mt-2 text-xs text-amber-800">Inicia sesión para habilitar la descarga del paquete.</p>
                )}
                {zipMsg && <p className="mt-2 text-xs text-violet-900">{zipMsg}</p>}
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="text-sm font-semibold text-slate-900">Contrato</h2>
                <p className="mt-1 text-xs text-slate-600">
                  Estado del expediente: <strong>{contractStatus || "—"}</strong>
                </p>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">
                  <li>
                    <ContractPdfDownloadLink contractVersionId={versionId} />
                    <span className="text-slate-500"> — solo si ya lo generaste en vista previa.</span>
                  </li>
                </ul>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="text-sm font-semibold text-slate-900">Firma electrónica</h2>
                {evidenceAnnex ? (
                  <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">
                    <li>
                      <span className="font-medium">{evidenceAnnex.title}</span>
                      {evidenceAnnex.generatedAt && (
                        <span className="text-slate-500">
                          {" "}
                          ({new Date(evidenceAnnex.generatedAt).toLocaleString("es-CO")})
                        </span>
                      )}
                    </li>
                    {evidenceAnnex.pdfUrl && (
                      <li>
                        <a className="text-violet-700 underline" href={evidenceAnnex.pdfUrl} target="_blank" rel="noreferrer">
                          Descargar PDF del anexo de evidencia
                        </a>
                      </li>
                    )}
                    {!evidenceAnnex.pdfUrl && evidenceAnnex.htmlContent && (
                      <li className="text-slate-600">
                        Hay contenido HTML del anexo; la vista previa del contrato permite revisarlo antes de exportar a
                        PDF.
                      </li>
                    )}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-slate-600">
                    Aún no hay anexo de evidencia de firma para esta versión. Completa la ronda de firmas o revisa la
                    vista previa.
                  </p>
                )}
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="text-sm font-semibold text-slate-900">Otros anexos registrados</h2>
                {annexes.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-600">No hay más anexos en Firestore para esta versión.</p>
                ) : (
                  <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">
                    {annexes.map((a, idx) => (
                      <li key={a.id ?? `${a.annexType}-${idx}`}>
                        <span className="font-medium">{a.title ?? a.annexType ?? "Anexo"}</span>
                        {a.pdfUrl ? (
                          <>
                            {" "}
                            —{" "}
                            <a className="text-violet-700 underline" href={a.pdfUrl} target="_blank" rel="noreferrer">
                              PDF
                            </a>
                          </>
                        ) : (
                          <span className="text-slate-500"> (sin PDF)</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="text-sm font-semibold text-slate-900">Bitácora de pagos</h2>
                <p className="mt-1 text-xs text-slate-600">
                  El anexo de registro de pagos se guarda como HTML en el expediente. Genera o actualiza el anexo desde{" "}
                  <Link href={`/dashboard/contracts/${id}/payments`} className="text-violet-700 underline">
                    Registro de pagos
                  </Link>
                  ; luego podrás verlo en la lista de anexos de abajo y se incluirá en el ZIP (como HTML si no hay PDF).
                </p>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="text-sm font-semibold text-slate-900">Inventario y acta de entrega</h2>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">
                  {inventoryId ? (
                    <li>
                      <a
                        className="text-violet-700 underline"
                        href={`/api/inventory/pdf/${encodeURIComponent(inventoryId)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        PDF del inventario inicial
                      </a>
                    </li>
                  ) : (
                    <li className="text-slate-600">No hay inventario inicial guardado para esta versión.</li>
                  )}
                  <li>
                    <Link
                      href={`/dashboard/contracts/${id}/delivery-act?contractVersionId=${encodeURIComponent(versionId)}`}
                      className="text-violet-700 underline"
                    >
                      Ir al acta de entrega
                    </Link>
                    <span className="text-slate-500"> — genera o descarga el PDF desde esa pantalla.</span>
                  </li>
                </ul>
              </section>
            </>
          )}
        </div>
      )}
    </main>
  );
}
