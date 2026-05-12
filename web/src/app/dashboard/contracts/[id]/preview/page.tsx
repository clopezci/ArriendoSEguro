"use client";

import { useDraftGuard } from "@/components/contracts/draft-tools";
import { ExpedienteNotesCard } from "@/components/contracts/expediente-notes-card";
import { WizardShell } from "@/components/contracts/wizard-shell";
import { appendAudit, toContractInput, updateDraft } from "@/features/contracts/wizard-state";
import { auditEvent } from "@/features/contracts/audit";
import type {
  ContractPreviewResponse,
  GenerateContractPdfResponse,
  SaveDraftVersionResponse,
} from "@/domain/contracts/api-types";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Etiquetas amigables para los `field` que devuelve `validateContractData`
 * y los demás endpoints. Permite mostrar al usuario "Canon mensual" en
 * lugar de "lease.monthlyRent" cuando algo falla en la generación del
 * contrato o el PDF.
 */
const CONTRACT_FIELD_LABELS: Record<string, string> = {
  "landlord.fullName": "Nombre del arrendador",
  "landlord.documentNumber": "Documento del arrendador",
  "landlord.email": "Correo del arrendador",
  "landlord.phone": "Teléfono del arrendador",
  "landlord.notificationAddress": "Dirección de notificación del arrendador",
  "tenant.fullName": "Nombre del arrendatario",
  "tenant.documentNumber": "Documento del arrendatario",
  "tenant.email": "Correo del arrendatario",
  "tenant.phone": "Teléfono del arrendatario",
  "tenant.notificationAddress": "Dirección de notificación del arrendatario",
  "solidaryCoDebtor": "Codeudor solidario",
  "solidaryCoDebtor.fullName": "Nombre del codeudor",
  "solidaryCoDebtor.documentNumber": "Documento del codeudor",
  "solidaryCoDebtor.email": "Correo del codeudor",
  "property.address": "Dirección del inmueble",
  "property.city": "Ciudad del inmueble",
  "property.department": "Departamento del inmueble",
  "property.type": "Tipo de inmueble",
  "property.registryNumber": "Matrícula / registro del inmueble",
  "property.commercialValue": "Valor comercial del inmueble",
  "property.legalRentCap": "Tope legal del canon",
  "property.noCapAcknowledgement": "Aceptación del arrendador",
  "lease.monthlyRent": "Canon mensual",
  "lease.monthlyRentText": "Canon mensual en letras",
  "lease.paymentDueDay": "Día de pago",
  "lease.paymentMethod": "Método de pago",
  "lease.startDate": "Fecha de inicio del contrato",
  "lease.endDate": "Fecha de fin del contrato",
  "lease.termMonths": "Duración del contrato",
  "lease.latePaymentMonthsThreshold": "Umbral de mora",
  "utilities.responsibleParty": "Responsable de servicios públicos",
  "utilities.details": "Detalle de servicios públicos",
  "utilities.adminFeesDetails": "Administración y expensas",
  contractVersion: "Versión del contrato",
  generatedAt: "Fecha de generación",
};

function formatBackendIssues(
  issues: { field: string; message: string }[],
): string[] {
  if (!issues.length) return [];
  return issues.map((issue) => {
    const label = CONTRACT_FIELD_LABELS[issue.field] ?? issue.field;
    return `${label}: ${issue.message}`;
  });
}

export default function PreviewStepPage() {
  const id = String(useParams<{ id: string }>().id);
  const { draft, state } = useDraftGuard(id);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [savingVersion, setSavingVersion] = useState(false);
  const [renderErrors, setRenderErrors] = useState<string[]>([]);
  const [previewHtml, setPreviewHtml] = useState("");
  const [versionInfo, setVersionInfo] = useState<{
    versionNumber: number;
    generatedAt: string;
    documentHash: string;
    hasSolidaryCoDebtor: boolean;
  } | null>(null);
  const [saveMessage, setSaveMessage] = useState("");
  const [savedVersion, setSavedVersion] = useState<{
    contractId: string;
    contractVersionId: string;
    versionNumber: number;
    documentHash: string;
  } | null>(null);
  const [pdfInfo, setPdfInfo] = useState<{
    pdfUrl: string;
    pdfGeneratedAt: string;
    versionNumber: number;
    documentHash: string;
  } | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [startingSignatures, setStartingSignatures] = useState(false);
  const [signatureRows, setSignatureRows] = useState<
    Array<{
      id?: string;
      partyType: string;
      signerName?: string;
      signerEmail: string;
      signatureStatus: string;
      tokenExpiresAt?: string;
      sentAt?: string | null;
      signedAt?: string | null;
    }>
  >([]);
  const [contractStatus, setContractStatus] = useState<string>("");
  const [annexRows, setAnnexRows] = useState<
    Array<{
      annexType: string;
      status: string;
      generatedAt?: string;
      htmlContent?: string;
      pdfUrl?: string | null;
    }>
  >([]);
  const [evidenceAnnex, setEvidenceAnnex] = useState<{
    title: string;
    htmlContent: string;
    pdfUrl: string | null;
    generatedAt: string | null;
    documentHash: string | null;
  } | null>(null);

  const activeDraft = draft;

  async function requestPreview() {
    if (!activeDraft) return;
    setLoadingPreview(true);
    setRenderErrors([]);
    setSaveMessage("");
    auditEvent("contract_preview_requested", { contractDraftId: id });
    try {
      const res = await fetch("/api/contracts/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contractPayload: toContractInput(activeDraft),
          isDemo: Boolean(activeDraft.isDemo),
        }),
      });
      const data = (await res.json()) as ContractPreviewResponse;
      if (!res.ok || !data.success) {
        const issues = !data.success ? data.validationErrors : [];
        const list = formatBackendIssues(issues);
        setRenderErrors(
          list.length > 0 ? list : ["No se pudo generar la vista previa del contrato."],
        );
        auditEvent("contract_preview_validation_failed", {
          contractDraftId: id,
          issues: issues.length,
        });
        return;
      }
      setPreviewHtml(data.html);
      setVersionInfo(data.contractVersionDraft);
      updateDraft(id, (d) =>
        appendAudit(
          { ...d, status: "preview_generated" },
          "contract_preview_generated",
          { hash: data.contractVersionDraft.documentHash },
        ),
      );
      auditEvent("contract_preview_generated", {
        contractDraftId: id,
        hash: data.contractVersionDraft.documentHash,
      });
    } catch {
      setRenderErrors([
        "No pudimos conectar con el servidor para generar la vista previa. Revisa tu conexión e inténtalo nuevamente.",
      ]);
    } finally {
      setLoadingPreview(false);
    }
  }

  async function saveDraftVersion() {
    if (!activeDraft) return;
    if (!previewHtml || !versionInfo) {
      setRenderErrors(["Primero genera la vista previa del contrato."]);
      return;
    }
    setSavingVersion(true);
    setSaveMessage("");
    try {
      const res = await fetch("/api/contracts/save-draft-version", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contractDraftId: id,
          contractPayload: toContractInput(activeDraft),
          html: previewHtml,
          documentHash: versionInfo.documentHash,
          hasSolidaryCoDebtor: activeDraft.hasSolidaryCoDebtor,
          generatedAt: versionInfo.generatedAt,
        }),
      });
      const data = (await res.json()) as SaveDraftVersionResponse;
      if (!res.ok || !data.success) {
        const list = !data.success ? formatBackendIssues(data.errors) : [];
        setRenderErrors(
          list.length > 0 ? list : ["No se pudo guardar la versión del contrato."],
        );
        return;
      }
      setSaveMessage(
        `Versión del contrato guardada correctamente. Versión #${data.versionNumber}.`,
      );
      setSavedVersion({
        contractId: data.contractId,
        contractVersionId: data.contractVersionId,
        versionNumber: data.versionNumber,
        documentHash: data.documentHash,
      });
      updateDraft(id, (d) => appendAudit({ ...d, status: "version_saved" }, "contract_draft_saved"));
    } catch {
      setRenderErrors([
        "No pudimos conectar con el servidor para guardar la versión. Inténtalo nuevamente.",
      ]);
    } finally {
      setSavingVersion(false);
    }
  }

  async function generatePdf() {
    if (!savedVersion) {
      setRenderErrors(["Primero guarda una versión del contrato."]);
      return;
    }
    setGeneratingPdf(true);
    setRenderErrors([]);
    try {
      const res = await fetch("/api/contracts/generate-pdf", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contractId: savedVersion.contractId,
          contractVersionId: savedVersion.contractVersionId,
        }),
      });
      const data = (await res.json()) as GenerateContractPdfResponse;
      if (!res.ok || !data.success) {
        const list = !data.success ? formatBackendIssues(data.errors) : [];
        setRenderErrors(list.length > 0 ? list : ["No se pudo generar el PDF del contrato."]);
        return;
      }
      setPdfInfo({
        pdfUrl: data.pdfUrl,
        pdfGeneratedAt: data.pdfGeneratedAt,
        versionNumber: data.versionNumber,
        documentHash: data.documentHash,
      });
    } catch {
      setRenderErrors([
        "No pudimos conectar con el servidor para generar el PDF. Inténtalo nuevamente.",
      ]);
    } finally {
      setGeneratingPdf(false);
    }
  }

  async function startSignatureRound() {
    if (!savedVersion) {
      setRenderErrors(["Primero guarda una versión del contrato."]);
      return;
    }
    setStartingSignatures(true);
    setRenderErrors([]);
    try {
      const res = await fetch("/api/signatures/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contractId: savedVersion.contractId,
          contractVersionId: savedVersion.contractVersionId,
        }),
      });
      const data = (await res.json()) as
        | { success: true; signatures: typeof signatureRows }
        | { success: false; errors: { field: string; message: string }[] };
      if (!res.ok || !data.success) {
        const list = !data.success ? formatBackendIssues(data.errors) : [];
        setRenderErrors(list.length > 0 ? list : ["No se pudo iniciar la ronda de firmas."]);
        return;
      }
      setSignatureRows(data.signatures);
      setContractStatus("signature_in_progress");
    } catch {
      setRenderErrors([
        "No pudimos conectar con el servidor para iniciar la firma. Inténtalo nuevamente.",
      ]);
    } finally {
      setStartingSignatures(false);
    }
  }

  const hasAllSigned =
    signatureRows.length > 0 &&
    signatureRows.every((s) => s.signatureStatus === "signed");

  useEffect(() => {
    if (!savedVersion) return;
    const load = async () => {
      try {
        const sigRes = await fetch(
          `/api/signatures/list?contractId=${encodeURIComponent(savedVersion.contractId)}&contractVersionId=${encodeURIComponent(savedVersion.contractVersionId)}`,
        );
        const sigData = (await sigRes.json()) as
          | { success: true; signatures: typeof signatureRows }
          | { success: false };
        if (sigRes.ok && sigData.success) setSignatureRows(sigData.signatures);
      } catch {
        // silencioso en fase inicial
      }
      try {
        const annexRes = await fetch(
          `/api/contracts/annexes/electronic-signature?contractId=${encodeURIComponent(savedVersion.contractId)}&contractVersionId=${encodeURIComponent(savedVersion.contractVersionId)}`,
        );
        const annexData = (await annexRes.json()) as
          | {
              success: true;
              annex: {
                title: string;
                htmlContent: string;
                pdfUrl: string | null;
                generatedAt: string | null;
                documentHash: string | null;
              } | null;
            }
          | { success: false };
        if (annexRes.ok && annexData.success) setEvidenceAnnex(annexData.annex);
      } catch {
        // silencioso en fase inicial
      }
      try {
        const listRes = await fetch(
          `/api/contracts/annexes/list?contractId=${encodeURIComponent(savedVersion.contractId)}&contractVersionId=${encodeURIComponent(savedVersion.contractVersionId)}`,
        );
        const listData = (await listRes.json()) as
          | { success: true; annexes: typeof annexRows }
          | { success: false };
        if (listRes.ok && listData.success) setAnnexRows(listData.annexes);
      } catch {
        // silencioso en fase inicial
      }
    };
    void load();
  }, [savedVersion]);

  if (state !== "ready" || !activeDraft) return <p className="text-sm text-slate-300">Cargando…</p>;

  return (
    <WizardShell title="Vista previa del contrato" currentStep={10} contractId={id}>
      <p className="mb-4 rounded-lg border border-slate-700 bg-slate-900/70 p-3 text-sm text-slate-300">
        Esta es una vista previa. El contrato solo quedará listo para firma cuando ambas partes
        revisen y acepten la versión final.
      </p>
      <div className="mb-4">
        <ExpedienteNotesCard
          draftId={id}
          initialNotes={activeDraft.expedienteNotes ?? ""}
          variant="banner"
        />
      </div>
      <div className="mb-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={requestPreview}
          disabled={loadingPreview}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white"
        >
          {loadingPreview ? "Generando vista previa…" : "Generar vista previa"}
        </button>
      </div>
      {renderErrors.length > 0 && (
        <div
          role="alert"
          className="mb-3 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-100"
        >
          <p className="font-semibold">Revisa estos puntos antes de continuar:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {renderErrors.map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        </div>
      )}
      {previewHtml && (
        <div className="max-h-[70vh] overflow-auto rounded-lg border border-slate-700 bg-white p-4 text-slate-900">
          <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
        </div>
      )}
      {versionInfo && (
        <div className="mt-3 rounded-lg border border-slate-700 bg-slate-900/70 p-3 text-xs text-slate-300">
          <p>Hash: {versionInfo.documentHash}</p>
          <p>Versión draft: {versionInfo.versionNumber}</p>
          <p>Generado: {new Date(versionInfo.generatedAt).toLocaleString("es-CO")}</p>
        </div>
      )}
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href={`/dashboard/contracts/${id}/review`}
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-violet-400"
        >
          Volver a editar
        </Link>
        <button
          type="button"
          onClick={saveDraftVersion}
          disabled={savingVersion || !previewHtml}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white"
        >
          {savingVersion ? "Guardando versión…" : "Guardar versión"}
        </button>
        <button
          type="button"
          onClick={generatePdf}
          disabled={generatingPdf || !savedVersion}
          className="rounded-lg border border-violet-500 px-4 py-2 text-sm font-medium text-violet-200 disabled:opacity-60"
        >
          {generatingPdf ? "Generando PDF…" : "Generar PDF"}
        </button>
        {pdfInfo && (
          <a
            href={pdfInfo.pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-emerald-500 px-4 py-2 text-sm font-medium text-emerald-200"
          >
            Descargar PDF
          </a>
        )}
        <button
          type="button"
          onClick={startSignatureRound}
          disabled={startingSignatures || !savedVersion}
          className="rounded-lg border border-sky-500 px-4 py-2 text-sm font-medium text-sky-200 disabled:opacity-60"
        >
          {startingSignatures ? "Iniciando firma…" : "Iniciar firma"}
        </button>
        <button
          type="button"
          disabled
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-400"
          title="Próximamente"
        >
          Continuar a firma (Próximamente)
        </button>
      </div>
      {saveMessage && <p className="mt-3 text-sm text-emerald-300">{saveMessage}</p>}
      {contractStatus && <p className="text-xs text-slate-400">Estado contractual: {contractStatus}</p>}
      {savedVersion && (
        <section className="mt-4 rounded-lg border border-slate-700 bg-slate-900/70 p-4">
          <h3 className="text-sm font-semibold text-slate-100">Inventario y entrega</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link
              href={`/dashboard/contracts/${id}/inventory`}
              className="rounded border border-slate-700 px-3 py-2 text-xs text-slate-200"
            >
              Crear inventario inicial
            </Link>
            <Link
              href={`/dashboard/contracts/${id}/inventory/new?contractVersionId=${encodeURIComponent(savedVersion.contractVersionId)}`}
              className="rounded border border-violet-500 px-3 py-2 text-xs text-violet-200"
            >
              Continuar inventario
            </Link>
            <Link
              href={`/dashboard/contracts/${id}/delivery-act?contractVersionId=${encodeURIComponent(savedVersion.contractVersionId)}`}
              className="rounded border border-sky-600 px-3 py-2 text-xs text-sky-200"
            >
              Generar acta de entrega
            </Link>
            <Link
              href={`/dashboard/contracts/${id}/payments`}
              className="rounded border border-emerald-600 px-3 py-2 text-xs text-emerald-200"
            >
              Registro de pagos
            </Link>
          </div>
        </section>
      )}
      {signatureRows.length > 0 && (
        <section className="mt-4 rounded-lg border border-slate-700 bg-slate-900/70 p-4">
          <h3 className="text-sm font-semibold text-slate-100">Firmas</h3>
          <div className="mt-2 overflow-auto">
            <table className="min-w-full text-xs text-slate-300">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="px-2 py-1 text-left">Parte</th>
                  <th className="px-2 py-1 text-left">Nombre</th>
                  <th className="px-2 py-1 text-left">Email</th>
                  <th className="px-2 py-1 text-left">Estado</th>
                  <th className="px-2 py-1 text-left">Enviado</th>
                  <th className="px-2 py-1 text-left">Firmado</th>
                </tr>
              </thead>
              <tbody>
                {signatureRows.map((s, idx) => (
                  <tr key={`${s.partyType}-${idx}`} className="border-b border-slate-800">
                    <td className="px-2 py-1">{s.partyType}</td>
                    <td className="px-2 py-1">{s.signerName ?? "-"}</td>
                    <td className="px-2 py-1">{s.signerEmail}</td>
                    <td className="px-2 py-1">{s.signatureStatus}</td>
                    <td className="px-2 py-1">{s.sentAt ? new Date(s.sentAt).toLocaleString("es-CO") : "-"}</td>
                    <td className="px-2 py-1">{s.signedAt ? new Date(s.signedAt).toLocaleString("es-CO") : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-400">Reenviar enlace: TODO (siguiente iteración).</p>
        </section>
      )}
      {pdfInfo && (
        <div className="mt-3 rounded-lg border border-slate-700 bg-slate-900/70 p-3 text-xs text-slate-300">
          <p>PDF generado: {new Date(pdfInfo.pdfGeneratedAt).toLocaleString("es-CO")}</p>
          <p>Versión: {pdfInfo.versionNumber}</p>
          <p>Hash: {pdfInfo.documentHash}</p>
        </div>
      )}
      {hasAllSigned && (
        <section className="mt-4 rounded-lg border border-emerald-700 bg-emerald-950/30 p-4 text-sm text-emerald-200">
          <p className="font-semibold">Contrato firmado</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {evidenceAnnex?.htmlContent && (
              <details className="rounded border border-emerald-600 px-3 py-2 text-xs">
                <summary>Ver evidencia de firma</summary>
                <div
                  className="mt-2 max-h-64 overflow-auto rounded bg-white p-3 text-slate-900"
                  dangerouslySetInnerHTML={{ __html: evidenceAnnex.htmlContent }}
                />
              </details>
            )}
            {pdfInfo?.pdfUrl && (
              <a
                href={pdfInfo.pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded border border-emerald-500 px-3 py-2 text-xs"
              >
                Descargar contrato
              </a>
            )}
            {evidenceAnnex?.pdfUrl && (
              <a
                href={evidenceAnnex.pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded border border-emerald-500 px-3 py-2 text-xs"
              >
                Descargar evidencia
              </a>
            )}
          </div>
        </section>
      )}
      {savedVersion && (
        <section className="mt-4 rounded-lg border border-slate-700 bg-slate-900/70 p-4">
          <h3 className="text-sm font-semibold text-slate-100">Anexos del contrato</h3>
          <div className="mt-2 overflow-auto">
            <table className="min-w-full text-xs text-slate-300">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="px-2 py-1 text-left">Anexo</th>
                  <th className="px-2 py-1 text-left">Estado</th>
                  <th className="px-2 py-1 text-left">Generación</th>
                  <th className="px-2 py-1 text-left">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {[
                  "initial_inventory",
                  "initial_delivery_act",
                  "electronic_signature_evidence",
                  "payment_log",
                  "closing_act",
                  "structured_evaluation",
                ].map((type) => {
                  const row = annexRows.find((a) => a.annexType === type);
                  const labelMap: Record<string, string> = {
                    initial_inventory: "Inventario inicial",
                    initial_delivery_act: "Acta de entrega inicial",
                    electronic_signature_evidence: "Evidencia de firma electrónica",
                    payment_log: "Registro de pagos",
                    closing_act: "Acta de cierre",
                    structured_evaluation: "Evaluación estructurada",
                  };
                  const status = row?.status ?? "pendiente";
                  return (
                    <tr key={type} className="border-b border-slate-800">
                      <td className="px-2 py-1">{labelMap[type] ?? type}</td>
                      <td className="px-2 py-1">{status}</td>
                      <td className="px-2 py-1">{row?.generatedAt ? new Date(row.generatedAt).toLocaleString("es-CO") : "-"}</td>
                      <td className="px-2 py-1">
                        {row?.htmlContent ? (
                          <details>
                            <summary className="cursor-pointer text-violet-300">Ver</summary>
                            <div className="mt-2 max-h-48 overflow-auto rounded bg-white p-2 text-slate-900" dangerouslySetInnerHTML={{ __html: row.htmlContent }} />
                          </details>
                        ) : (
                          <span className="text-slate-500">No aplica</span>
                        )}
                        {row?.pdfUrl && (
                          <a href={row.pdfUrl} target="_blank" rel="noreferrer" className="ml-2 text-emerald-300">
                            Descargar PDF
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <p className="mt-3 text-xs text-slate-400">
        TODO: validar sesión y accessStatus en backend para ambos endpoints antes de producción.
      </p>
    </WizardShell>
  );
}

