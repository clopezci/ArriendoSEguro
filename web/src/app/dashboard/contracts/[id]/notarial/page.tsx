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
  // Compartir con el inquilino (enlace para que firme con el Estado y suba el PDF).
  const [shareBusy, setShareBusy] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareMsg, setShareMsg] = useState("");

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
        { headers: { ...(await buildAuthHeaders(user)) } },
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
  }, [id, user]);

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

  /**
   * Genera el enlace para el inquilino y abre el WhatsApp del dueño con el mensaje
   * listo. Si conocemos el celular del inquilino, lo prellenamos como destinatario.
   */
  async function shareWithTenant() {
    if (!versionId || !user) {
      setShareMsg("Inicia sesión y guarda una versión del contrato para compartir el enlace.");
      return;
    }
    setShareBusy(true);
    setShareMsg("");
    try {
      const res = await fetch("/api/contracts/notarial/share", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({ contractId: id, contractVersionId: versionId, role: "tenant" }),
      });
      const j = (await res.json()) as
        | { success: true; url: string; inviteeName?: string; inviteePhone?: string }
        | { success: false; errors: { message?: string }[] };
      if (!res.ok || !j.success) {
        setShareMsg(!j.success ? j.errors?.[0]?.message ?? "No se pudo generar el enlace." : "No se pudo generar el enlace.");
        return;
      }
      setShareUrl(j.url);
      const firstName = (j.inviteeName ?? "").split(" ")[0];
      const digits = String(j.inviteePhone ?? "").replace(/\D/g, "");
      const withCc = digits.length === 10 && digits.startsWith("3") ? `57${digits}` : digits;
      const text = `Hola${firstName ? ` ${firstName}` : ""}, para firmar el contrato de arriendo con la firma digital GRATIS del Estado y dejarlo guardado, entra a este enlace: ${j.url}`;
      const wa = withCc
        ? `https://wa.me/${withCc}?text=${encodeURIComponent(text)}`
        : `https://wa.me/?text=${encodeURIComponent(text)}`;
      window.open(wa, "_blank", "noopener,noreferrer");
    } catch {
      setShareMsg("Error de red al generar el enlace.");
    } finally {
      setShareBusy(false);
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
    <main className="mx-auto max-w-2xl space-y-5">
      <ExpedienteNav contractId={id} />

      <header className="space-y-2">
        <h1 className="text-balance text-3xl font-extrabold tracking-tight text-[#17151F]">
          Autenticación notarial (opcional)
        </h1>
        <p className="mt-2 text-slate-500">
          Si las partes deciden autenticar el contrato en una notaría, este espacio te orienta: descargas el paquete
          útil, llevas el trámite presencialmente (o por los canales que indique el notario) y vuelves aquí para
          archivar el PDF que te entreguen. ArriendoSeguro no reemplaza al notario ni valida el contenido del
          documento autenticado.
        </p>
        <Link href={`/dashboard/contracts/${id}/evidencias`} className="inline-block text-sm text-[#5646E5] hover:underline">
          ← Evidencias del expediente
        </Link>
      </header>

      <RequiresSavedContract id={id}>
      {loading && <p className="text-sm text-slate-600">Cargando…</p>}
      {error && (
        <p className="rounded-2xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800" role="alert">
          {error}
        </p>
      )}

      {!loading && !error && (
        <div className="space-y-6">
          <section className="rounded-xl border border-emerald-300 bg-emerald-50/70 p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white">GRATIS</span>
              <h2 className="text-sm font-semibold text-emerald-950">Firma digital del Estado (Agencia Nacional Digital)</h2>
            </div>
            <p className="mt-2 text-xs text-emerald-900/90">
              Tu contrato ya queda firmado dentro de ArriendoSeguro (válido por la Ley 527). Si además quieren el{" "}
              <strong>respaldo del Estado sin costo</strong>, el Estado colombiano ofrece firma y autenticación digital
              gratuita a través de la <strong>Agencia Nacional Digital</strong> (Decreto 620 de 2020). Es{" "}
              <strong>opcional</strong> y se hace por fuera de la app: cada parte firma su copia y la pasa a la siguiente.
            </p>

            <div className="mt-3 rounded-2xl border border-emerald-300 bg-white/70 p-3">
              <p className="text-xs font-semibold text-emerald-950">Cómo firmar entre todas las partes (paso a paso):</p>
              <ol className="mt-2 space-y-1.5 pl-5 text-xs text-slate-700 [list-style:decimal]">
                <li>Descarga el <strong>PDF del contrato</strong> (botón de abajo, sección «Descargas para el trámite»).</li>
                <li>
                  La <strong>primera persona</strong> entra a la Agencia Nacional Digital, se registra, sube el PDF,
                  confirma con el <strong>código (OTP) que llega a su correo</strong> y descarga el PDF ya firmado.
                </li>
                <li>
                  Esa persona <strong>le envía ese mismo PDF firmado a la siguiente</strong>, que repite el proceso
                  firmando sobre el mismo archivo. Y así, <strong>uno por uno</strong>, hasta el último firmante
                  (arrendador, arrendatario y codeudor si lo hay).
                </li>
                <li>
                  El <strong>último</strong> en firmar <strong>vuelve aquí y sube el PDF final</strong> (con todas las
                  firmas) en la sección «Subir el PDF firmado» de más abajo. Eso lo deja archivado en el expediente.
                </li>
              </ol>
              <p className="mt-2 text-[11px] text-emerald-900/80">
                Importante: todas las partes deben firmar <strong>el mismo archivo</strong>, en orden. No firmen copias
                distintas por separado.
              </p>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href="https://firmaautenticaciondigital.and.gov.co/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex rounded-xl bg-[#5646E5] px-3 py-2 text-sm font-medium text-white hover:brightness-105"
              >
                Ir a Firma y Autenticación Digital (Agencia Nacional Digital)
              </a>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              Enlace oficial del Estado. Para la notaría física, los costos los cobra la notaría según sus tarifas
              vigentes. ArriendoSeguro no es notaría ni cobra por estos trámites; valida costos y requisitos directamente
              con la entidad.
            </p>

            {/* Atajo: compartir solo con el inquilino para que él firme y suba. */}
            <div className="mt-3 rounded-2xl border border-[#5646E5]/25 bg-[#ECE9FB]/40 p-3">
              <p className="text-xs font-semibold text-[#3a2fb0]">
                ¿Solo quieres que el <strong>inquilino</strong> firme y autentique con el Estado?
              </p>
              <p className="mt-1 text-[11px] text-slate-600">
                Compártele un enlace: él descarga el contrato, lo firma con la Agencia Nacional Digital y lo sube al
                contrato con un clic —<strong>sin crear cuenta</strong>. Se abre <strong>tu propio WhatsApp</strong> con
                el mensaje listo para enviárselo.
              </p>
              <button
                type="button"
                onClick={() => void shareWithTenant()}
                disabled={shareBusy || !user || !versionId}
                className="mt-2.5 inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-3 py-2 text-sm font-bold text-white shadow-sm transition hover:brightness-105 active:scale-95 disabled:opacity-60"
              >
                {shareBusy ? "Generando enlace…" : "🟢 Compartir con el inquilino por WhatsApp"}
              </button>
              {shareUrl && (
                <div className="mt-2 rounded-xl border border-slate-200 bg-white/80 p-2">
                  <p className="text-[11px] font-medium text-slate-600">Enlace para el inquilino (por si prefieres copiarlo):</p>
                  <div className="mt-1 flex items-center gap-2">
                    <input readOnly value={shareUrl} className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700" onFocus={(e) => e.currentTarget.select()} />
                    <button
                      type="button"
                      onClick={() => { void navigator.clipboard?.writeText(shareUrl).then(() => setShareMsg("Enlace copiado ✓")).catch(() => setShareMsg("")); }}
                      className="flex-none rounded-lg border border-[#5646E5] px-2 py-1 text-[11px] font-semibold text-[#5646E5]"
                    >
                      Copiar
                    </button>
                  </div>
                </div>
              )}
              {shareMsg && <p className="mt-1.5 text-[11px] text-emerald-700">{shareMsg}</p>}
            </div>
          </section>

          {!versionId && (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Primero guarda una versión del contrato en la vista previa. Sin versión no podemos asociar el archivo
              autenticado al expediente.
            </p>
          )}

          {versionId && (
            <>
              <section className="rounded-3xl border-2 border-slate-200 bg-white/90 p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-slate-900">Estado del expediente</h2>
                <p className="mt-1 text-xs text-slate-600">
                  Estado: <strong>{contractStatus || "—"}</strong>. Versión contractual actual:{" "}
                  <span className="font-mono text-xs">{versionId}</span>
                </p>
              </section>

              <section className="rounded-3xl border-2 border-slate-200 bg-white/90 p-5 shadow-sm">
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

              <section className="rounded-3xl border-2 border-slate-200 bg-white/90 p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-slate-900">2. Subir el PDF firmado (ANND) o autenticado</h2>
                <p className="mt-1 text-xs text-slate-600">
                  Aquí sube el <strong>último firmante</strong> el PDF final: el que ya tiene todas las firmas de la
                  Agencia Nacional Digital, o el autenticado en notaría. Queda archivado como evidencia del expediente.
                </p>
                <ul className="mt-2 space-y-0.5 rounded-lg bg-white/75 p-3 text-[11px] text-slate-600">
                  <li>✓ Solo lo sube una <strong>parte del contrato</strong> (tu correo debe coincidir con arrendador, arrendatario o codeudor).</li>
                  <li>✓ Verificamos que sea un <strong>PDF real</strong> y que pese menos de 15 MB.</li>
                  <li>✓ Lo dejamos <strong>vinculado a esta versión</strong> del contrato, con autor y fecha, dentro del paquete de evidencia.</li>
                </ul>
                <p className="mt-2 rounded-2xl border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-900">
                  Nota: al firmar, el archivo cambia respecto al original (es normal). Por eso no comparamos byte a byte;
                  la validez de la firma la respalda la propia Agencia Nacional Digital dentro del PDF.
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
                    className="rounded-xl bg-[#5646E5] px-4 py-2 text-sm font-medium text-white shadow-sm hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
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
            <p className="rounded-lg border border-slate-200 bg-white/75 p-3 text-sm text-slate-800">{uploadMsg}</p>
          )}
        </div>
      )}
      </RequiresSavedContract>
    </main>
  );
}
