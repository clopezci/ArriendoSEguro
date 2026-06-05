"use client";

import { useDraftGuard } from "@/components/contracts/draft-tools";
import { ExpedienteNotesCard } from "@/components/contracts/expediente-notes-card";
import { WizardShell } from "@/components/contracts/wizard-shell";
import { appendAudit, getDraft, setNotarizationSelection, toContractInput, updateDraft } from "@/features/contracts/wizard-state";
import { auditEvent } from "@/features/contracts/audit";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
import { freeTierEnabled } from "@/lib/config";
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
  "landlord.fullName": "Nombre del arrendador (dueño)",
  "landlord.documentNumber": "Documento del arrendador (dueño)",
  "landlord.email": "Correo del arrendador (dueño)",
  "landlord.phone": "Teléfono del arrendador (dueño)",
  "landlord.notificationAddress": "Dirección de notificación del arrendador (dueño)",
  "tenant.fullName": "Nombre del arrendatario (inquilino)",
  "tenant.documentNumber": "Documento del arrendatario (inquilino)",
  "tenant.email": "Correo del arrendatario (inquilino)",
  "tenant.phone": "Teléfono del arrendatario (inquilino)",
  "tenant.notificationAddress": "Dirección de notificación del arrendatario (inquilino)",
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
  "property.noCapAcknowledgement": "Aceptación del arrendador (dueño)",
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
  const { user } = useAuth();
  // Estado Plus: define si el contrato lleva marca de agua + CTA del tier gratis.
  const [plusActive, setPlusActive] = useState(false);
  const [entitlementsLoaded, setEntitlementsLoaded] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [savingVersion, setSavingVersion] = useState(false);
  const [renderErrors, setRenderErrors] = useState<string[]>([]);
  const [previewHtml, setPreviewHtml] = useState("");
  /** HTML limpio (sin marca de agua) que se guarda como versión legal. */
  const [cleanHtmlForSave, setCleanHtmlForSave] = useState("");
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
  const [pdfFeedback, setPdfFeedback] = useState("");
  const [startingSignatures, setStartingSignatures] = useState(false);
  const [signatureRoundMessage, setSignatureRoundMessage] = useState<{
    tone: "info" | "warning";
    title: string;
    details: string[];
    footer?: "mock" | "send_failed";
  } | null>(null);
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
      emailMode?: "real" | "mock" | "failed" | "skipped";
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

  const [wantsNotarizationUi, setWantsNotarizationUi] = useState(false);

  const activeDraft = draft;

  // Genera automáticamente la vista previa la primera vez que el usuario llega
  // al paso 10 del wizard. Antes el flujo requería que la persona tocara
  // "Generar vista previa" para que se llenara `previewHtml`; mientras tanto el
  // botón "Guardar versión" parecía habilitado visualmente (no tenía estilo
  // disabled), lo cual era confuso: al hacer click no pasaba nada porque
  // realmente estaba bloqueado por `disabled={!previewHtml}`. Auto-generar al
  // montar mantiene el control manual del botón "Generar vista previa" para
  // refrescar si el usuario edita y vuelve, y evita el clic extra inicial.
  // Estado Plus (entitlements): para decidir marca de agua + CTA del tier gratis.
  useEffect(() => {
    let cancelled = false;
    async function loadEntitlements() {
      if (!user) {
        setEntitlementsLoaded(true);
        return;
      }
      try {
        const res = await fetch("/api/access/entitlements/me", {
          headers: { ...(await buildAuthHeaders(user)) },
        });
        const data = (await res.json()) as { success?: boolean; plusActive?: boolean };
        if (!cancelled) setPlusActive(Boolean(res.ok && data.success && data.plusActive));
      } catch {
        /* si falla, asumimos no-Plus (tier gratis con marca de agua) */
      } finally {
        if (!cancelled) setEntitlementsLoaded(true);
      }
    }
    void loadEntitlements();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!entitlementsLoaded) return; // evita marca de agua errónea antes de saber si es Plus
    if (!activeDraft) return;
    if (previewHtml) return;
    if (loadingPreview) return;
    if (renderErrors.length > 0) return;
    void requestPreview();
    // requestPreview no es estable porque depende de activeDraft; lo dejamos
    // fuera del array de deps para evitar bucle, controlando re-ejecución con
    // las guardas anteriores.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDraft?.id, entitlementsLoaded]);

  useEffect(() => {
    if (state !== "ready" || !id) return;
    const d = getDraft(id);
    setWantsNotarizationUi(Boolean(d?.notarization?.wantsNotarization));
  }, [id, state]);

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
          isFreeTier: freeTierEnabled && !activeDraft.isDemo && !plusActive,
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
      // En pantalla mostramos el HTML de display (con marca de agua + CTA en
      // tier gratis); para GUARDAR usamos el HTML limpio (versión legal).
      setPreviewHtml(data.displayHtml ?? data.html);
      setCleanHtmlForSave(data.html);
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

  type SavedVersionState = {
    contractId: string;
    contractVersionId: string;
    versionNumber: number;
    documentHash: string;
  };

  async function saveDraftVersion(): Promise<SavedVersionState | null> {
    if (!activeDraft) return null;
    if (!previewHtml || !versionInfo) {
      setRenderErrors(["Primero genera la vista previa del contrato."]);
      return null;
    }
    if (savedVersion) return savedVersion;
    setSavingVersion(true);
    setSaveMessage("");
    try {
      const res = await fetch("/api/contracts/save-draft-version", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contractDraftId: id,
          contractPayload: toContractInput(activeDraft),
          html: cleanHtmlForSave || previewHtml,
          documentHash: versionInfo.documentHash,
          hasSolidaryCoDebtor: activeDraft.hasSolidaryCoDebtor,
          generatedAt: versionInfo.generatedAt,
          renewalReminderEnabled: activeDraft.renewalReminderEnabled ?? true,
        }),
      });
      const data = (await res.json()) as SaveDraftVersionResponse;
      if (!res.ok || !data.success) {
        const list = !data.success ? formatBackendIssues(data.errors) : [];
        setRenderErrors(
          list.length > 0 ? list : ["No se pudo guardar la versión del contrato."],
        );
        return null;
      }
      setSaveMessage(
        `Versión del contrato guardada correctamente. Versión #${data.versionNumber}.`,
      );
      const next: SavedVersionState = {
        contractId: data.contractId,
        contractVersionId: data.contractVersionId,
        versionNumber: data.versionNumber,
        documentHash: data.documentHash,
      };
      setSavedVersion(next);
      updateDraft(id, (d) => appendAudit({ ...d, status: "version_saved" }, "contract_draft_saved"));
      // Marca al usuario como referido "calificado" si vino por referido y usó
      // la app de verdad (ya generó/guardó un contrato). Best-effort.
      if (user) {
        void fetch("/api/referrals/mark-usage", { method: "POST", headers: { ...(await buildAuthHeaders(user)) } }).catch(() => {});
      }
      return next;
    } catch {
      setRenderErrors([
        "No pudimos conectar con el servidor para guardar la versión. Inténtalo nuevamente.",
      ]);
      return null;
    } finally {
      setSavingVersion(false);
    }
  }

  async function generatePdf() {
    setPdfFeedback("");
    setRenderErrors([]);
    const version = savedVersion ?? (await saveDraftVersion());
    if (!version) {
      setPdfFeedback(
        "Para generar el PDF necesitas una vista previa válida y guardar la versión (pulsa «Guardar versión» o vuelve a intentar).",
      );
      return;
    }
    setGeneratingPdf(true);
    try {
      const res = await fetch("/api/contracts/generate-pdf", {
        method: "POST",
        headers: { "content-type": "application/json", ...(user ? await buildAuthHeaders(user) : {}) },
        body: JSON.stringify({
          contractId: version.contractId,
          contractVersionId: version.contractVersionId,
        }),
      });
      const data = (await res.json()) as GenerateContractPdfResponse;
      if (!res.ok || !data.success) {
        const list = !data.success ? formatBackendIssues(data.errors) : [];
        setRenderErrors(list.length > 0 ? list : ["No se pudo generar el PDF del contrato."]);
        setPdfFeedback("Revisa los errores indicados arriba.");
        return;
      }
      setPdfInfo({
        pdfUrl: data.pdfUrl,
        pdfGeneratedAt: data.pdfGeneratedAt,
        versionNumber: data.versionNumber,
        documentHash: data.documentHash,
      });
      setPdfFeedback("PDF generado correctamente.");
      if (data.pdfUrl) {
        window.open(data.pdfUrl, "_blank", "noopener,noreferrer");
      }
    } catch {
      setRenderErrors([
        "No pudimos conectar con el servidor para generar el PDF. Inténtalo nuevamente.",
      ]);
      setPdfFeedback("Error de conexión al generar el PDF.");
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
    setSignatureRoundMessage(null);
    try {
      const res = await fetch("/api/signatures/start", {
        method: "POST",
        headers: { "content-type": "application/json", ...(user ? await buildAuthHeaders(user) : {}) },
        body: JSON.stringify({
          contractId: savedVersion.contractId,
          contractVersionId: savedVersion.contractVersionId,
        }),
      });
      const data = (await res.json()) as
        | { success: true; signatures: typeof signatureRows }
        | { success: false; errors: { field: string; message: string }[] };
      if (!res.ok || !data.success) {
        // Gate de pago: la firma es Plus. Mostramos un CTA claro.
        if (res.status === 402) {
          const msg = !data.success ? data.errors[0]?.message : "";
          setRenderErrors([
            `${msg ?? "La firma es parte de Plan Plus."} Actívalo en «Planes» (menú del panel) para firmar tu contrato.`,
          ]);
          return;
        }
        const list = !data.success ? formatBackendIssues(data.errors) : [];
        setRenderErrors(list.length > 0 ? list : ["No se pudo iniciar la ronda de firmas."]);
        return;
      }
      setSignatureRows(data.signatures);
      setContractStatus("signature_in_progress");

      // Mostramos un mensaje claro al usuario indicando a quién se envió la
      // invitación y en qué modo. Si el proveedor de correo aún no está
      // configurado (modo `mock`), avisamos sin asustar para que se sepa
      // que en producción esto sí saldrá del servidor.
      const partyLabel: Record<string, string> = {
        landlord: "Arrendador (dueño)",
        tenant: "Arrendatario (inquilino)",
        solidaryCoDebtor: "Codeudor",
      };
      const labelForParty = (party: string): string => {
        if (partyLabel[party]) return partyLabel[party];
        if (party.startsWith("solidaryCoDebtor_")) return `Codeudor ${party.slice("solidaryCoDebtor_".length)}`;
        return party;
      };
      const details = data.signatures.map((s) => {
        const label = labelForParty(s.partyType);
        const mode = s.emailMode ?? "mock";
        const modeLabel =
          mode === "real"
            ? "correo enviado"
            : mode === "mock"
              ? "modo demo (correo no enviado todavía)"
              : mode === "failed"
                ? "envío de correo falló"
                : "correo omitido";
        return `${label} (${s.signerEmail}): ${modeLabel}.`;
      });
      const anyReal = data.signatures.some((s) => s.emailMode === "real");
      const anyFailed = data.signatures.some(
        (s) => s.emailMode === "failed" || s.emailMode === "skipped",
      );
      let footer: "mock" | "send_failed" | undefined;
      if (anyFailed) footer = "send_failed";
      else if (!anyReal) footer = "mock";
      setSignatureRoundMessage({
        tone: anyFailed || !anyReal ? "warning" : "info",
        title: anyReal
          ? "Iniciamos la ronda de firmas y enviamos los correos a las partes."
          : "Iniciamos la ronda de firmas en modo demo. Cuando configures el proveedor de correo, las invitaciones se enviarán automáticamente.",
        details,
        footer,
      });
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

  if (state !== "ready" || !activeDraft) return <p className="text-sm text-slate-700">Cargando…</p>;

  return (
    <WizardShell title="Vista previa del contrato" currentStep={9} contractId={id}>
      <p className="mb-4 rounded-lg border border-slate-300 bg-white/95 p-3 text-sm text-slate-700">
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
      <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-800">
        <h2 className="font-semibold text-slate-900">Autenticación notarial (opcional)</h2>
        <p className="mt-1 text-xs text-slate-600">
          Si las partes van a autenticar el contrato en notaría, deja constancia aquí. Cuando la plantilla{" "}
          <span className="font-mono">AS-LEASE-2026.2</span> esté activa, la cláusula correspondiente puede mostrarse al
          regenerar la vista previa. El PDF autenticado lo subes en el{" "}
          <Link href={`/dashboard/contracts/${id}/evidencias`} className="font-medium text-violet-700 underline">
            paso 12 — Evidencias
          </Link>{" "}
          → Notaría (no sustituye la firma electrónica en la plataforma).
        </p>
        <label className="mt-3 flex cursor-pointer items-start gap-2">
          <input
            type="checkbox"
            checked={wantsNotarizationUi}
            onChange={(e) => {
              const v = e.target.checked;
              setWantsNotarizationUi(v);
              setNotarizationSelection(id, v);
              if (previewHtml) {
                setSaveMessage(
                  "Actualizaste la preferencia de notaría. Pulsa «Regenerar vista previa» y, si ya habías guardado versión, vuelve a guardarla para alinear el expediente.",
                );
              }
            }}
            className="mt-0.5"
          />
          <span>Llevaremos el contrato a notaría para autenticación (como refuerzo a la firma electrónica aquí).</span>
        </label>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={requestPreview}
          disabled={loadingPreview}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loadingPreview
            ? "Generando vista previa…"
            : previewHtml
              ? "Regenerar vista previa"
              : "Generar vista previa"}
        </button>
        {!previewHtml && !loadingPreview && renderErrors.length === 0 && (
          <span className="text-xs text-slate-600">
            Estamos generando la primera vista previa automáticamente.
          </span>
        )}
      </div>
      {renderErrors.length > 0 && (
        <div
          role="alert"
          className="mb-3 rounded-lg border border-rose-300 bg-rose-100/60 p-3 text-sm text-rose-800"
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
        <div className="max-h-[70vh] overflow-auto rounded-lg border border-slate-300 bg-white p-4 text-slate-900">
          <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
        </div>
      )}
      {versionInfo && (
        <div className="mt-3 rounded-lg border border-slate-300 bg-white/95 p-3 text-xs text-slate-700">
          <p>Hash: {versionInfo.documentHash}</p>
          <p>Versión draft: {versionInfo.versionNumber}</p>
          <p>Generado: {new Date(versionInfo.generatedAt).toLocaleString("es-CO")}</p>
        </div>
      )}
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href={`/dashboard/contracts/${id}/review`}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-800 hover:border-violet-500"
        >
          Volver a editar
        </Link>
        <button
          type="button"
          onClick={() => void saveDraftVersion()}
          disabled={savingVersion || !previewHtml || Boolean(savedVersion)}
          title={
            !previewHtml
              ? "Espera a que termine de generarse la vista previa."
              : savedVersion
                ? "Versión ya guardada. Continúa con generar el PDF o iniciar firma."
                : undefined
          }
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {savingVersion
            ? "Guardando versión…"
            : savedVersion
              ? "Versión guardada ✓"
              : "Guardar versión"}
        </button>
        <button
          type="button"
          onClick={() => void generatePdf()}
          disabled={generatingPdf || savingVersion || !previewHtml}
          title={
            !previewHtml
              ? "Genera primero la vista previa del contrato."
              : "Guarda la versión automáticamente si aún no lo hiciste y genera el PDF."
          }
          className="rounded-lg border border-violet-500 px-4 py-2 text-sm font-medium text-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {generatingPdf ? "Generando PDF…" : savingVersion ? "Guardando versión…" : "Generar PDF"}
        </button>
        {pdfInfo && (
          <a
            href={pdfInfo.pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-emerald-500 px-4 py-2 text-sm font-medium text-emerald-700"
          >
            Descargar PDF
          </a>
        )}
        <button
          type="button"
          onClick={startSignatureRound}
          disabled={startingSignatures || !savedVersion}
          className="rounded-lg border border-sky-500 px-4 py-2 text-sm font-medium text-sky-800 disabled:opacity-60"
        >
          {startingSignatures ? "Iniciando firma…" : "Iniciar firma"}
        </button>
      </div>
      {saveMessage && <p className="mt-3 text-sm text-emerald-700">{saveMessage}</p>}
      {pdfFeedback && (
        <p className="mt-2 text-sm text-violet-800" role="status">
          {pdfFeedback}
        </p>
      )}
      {contractStatus && <p className="text-xs text-slate-600">Estado contractual: {contractStatus}</p>}

      <section className="mt-8 rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50/90 to-white p-5 shadow-[0_8px_28px_rgba(139,92,246,0.14)]">
        <h3 className="text-base font-bold text-slate-900">Durante el arriendo</h3>
        <p className="mt-1 text-xs text-slate-600">
          Después de firmar, usa estos módulos para respaldos documentales y comunicación entre partes.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Link
            href={`/dashboard/contracts/${id}/evidencias`}
            className="rounded-xl border border-violet-300 bg-white p-4 shadow-sm transition hover:border-violet-500 hover:shadow-md"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Paso 12</p>
            <p className="mt-1 text-sm font-bold text-slate-900">Evidencias del expediente</p>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              Soportes del codeudor, paquete ZIP, notaría, pagos e inventario en un solo lugar.
            </p>
          </Link>
          <Link
            href={`/dashboard/contracts/${id}/novedades`}
            title="Ejemplos: mora en el canon, daños o reparaciones, convivencia, solicitudes entre arrendador y arrendatario, acuerdos documentados."
            className="rounded-xl border border-violet-300 bg-white p-4 shadow-sm transition hover:border-violet-500 hover:shadow-md"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Paso 13</p>
            <p className="mt-1 text-sm font-bold text-slate-900">
              Registrar novedades y solicitudes del arrendamiento
            </p>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              Incumplimientos, reparaciones, convivencia u otras situaciones con historial y notificación por correo.
            </p>
          </Link>
        </div>
      </section>

      {savedVersion && (
        <section className="mt-4 rounded-lg border border-slate-300 bg-white/95 p-4">
          <h3 className="text-sm font-semibold text-slate-900">Inventario y entrega</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link
              href={`/dashboard/contracts/${id}/evidencias`}
              className="rounded border border-violet-600 px-3 py-2 text-xs font-medium text-violet-800"
            >
              Ir a evidencias del expediente
            </Link>
            <Link
              href={`/dashboard/contracts/${id}/inventory`}
              className="rounded border border-slate-300 px-3 py-2 text-xs text-slate-800"
            >
              Crear inventario inicial
            </Link>
            <Link
              href={`/dashboard/contracts/${id}/inventory/new?contractVersionId=${encodeURIComponent(savedVersion.contractVersionId)}`}
              className="rounded border border-violet-500 px-3 py-2 text-xs text-violet-700"
            >
              Continuar inventario
            </Link>
            <Link
              href={`/dashboard/contracts/${id}/delivery-act?contractVersionId=${encodeURIComponent(savedVersion.contractVersionId)}`}
              className="rounded border border-sky-500 px-3 py-2 text-xs text-sky-800"
            >
              Generar acta de entrega
            </Link>
            <Link
              href={`/dashboard/contracts/${id}/payments`}
              className="rounded border border-emerald-500 px-3 py-2 text-xs text-emerald-700"
            >
              Registro de pagos
            </Link>
          </div>
        </section>
      )}
      {signatureRoundMessage && (
        <div
          role="status"
          className={`mt-3 rounded-lg border p-3 text-xs ${
            signatureRoundMessage.tone === "info"
              ? "border-emerald-300 bg-emerald-50 text-emerald-800"
              : "border-amber-300 bg-amber-50 text-amber-800"
          }`}
        >
          <p className="font-semibold">{signatureRoundMessage.title}</p>
          {signatureRoundMessage.details.length > 0 && (
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {signatureRoundMessage.details.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          )}
          {signatureRoundMessage.footer === "mock" && (
            <p className="mt-2">
              Aún no hay envío real de correo: falta configurar el proveedor en el servidor (clave de API y remitente)
              o estás en modo simulado. Las firmas quedan en el expediente; al activar el proveedor, las invitaciones
              saldrán automáticamente.
            </p>
          )}
          {signatureRoundMessage.footer === "send_failed" && (
            <p className="mt-2">
              Uno o más correos de invitación no se pudieron enviar. Revisa la configuración del proveedor, la carpeta
              de spam de las partes y los registros de correo del sistema. Puedes intentar de nuevo más tarde o repetir
              la ronda si hace falta.
            </p>
          )}
        </div>
      )}
      {signatureRows.length > 0 && (
        <section className="mt-4 rounded-lg border border-slate-300 bg-white/95 p-4">
          <h3 className="text-sm font-semibold text-slate-900">Firmas</h3>
          <div className="mt-2 overflow-auto">
            <table className="min-w-full text-xs text-slate-700">
              <thead>
                <tr className="border-b border-slate-300">
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
                  <tr key={`${s.partyType}-${idx}`} className="border-b border-slate-300">
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
          <p className="mt-2 text-xs text-slate-600">
            Para pedir de nuevo el código de verificación (OTP), cada firmante usa «Solicitar código al correo» en su
            enlace de firma. Las invitaciones con enlace se envían al pulsar «Iniciar firma» arriba.
          </p>
        </section>
      )}
      {pdfInfo && (
        <div className="mt-3 rounded-lg border border-slate-300 bg-white/95 p-3 text-xs text-slate-700">
          <p>PDF generado: {new Date(pdfInfo.pdfGeneratedAt).toLocaleString("es-CO")}</p>
          <p>Versión: {pdfInfo.versionNumber}</p>
          <p>Hash: {pdfInfo.documentHash}</p>
        </div>
      )}
      {hasAllSigned && (
        <section className="mt-4 rounded-lg border border-emerald-500 bg-emerald-50 p-4 text-sm text-emerald-700">
          <p className="font-semibold">Contrato firmado</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {evidenceAnnex?.htmlContent && (
              <details className="rounded border border-emerald-500 px-3 py-2 text-xs">
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
        <section className="mt-4 rounded-lg border border-slate-300 bg-white/95 p-4">
          <h3 className="text-sm font-semibold text-slate-900">Anexos del contrato</h3>
          <div className="mt-2 overflow-auto">
            <table className="min-w-full text-xs text-slate-700">
              <thead>
                <tr className="border-b border-slate-300">
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
                    <tr key={type} className="border-b border-slate-300">
                      <td className="px-2 py-1">{labelMap[type] ?? type}</td>
                      <td className="px-2 py-1">{status}</td>
                      <td className="px-2 py-1">{row?.generatedAt ? new Date(row.generatedAt).toLocaleString("es-CO") : "-"}</td>
                      <td className="px-2 py-1">
                        {row?.htmlContent ? (
                          <details>
                            <summary className="cursor-pointer text-violet-700">Ver</summary>
                            <div className="mt-2 max-h-48 overflow-auto rounded bg-white p-2 text-slate-900" dangerouslySetInnerHTML={{ __html: row.htmlContent }} />
                          </details>
                        ) : (
                          <span className="text-slate-500">No aplica</span>
                        )}
                        {row?.pdfUrl && (
                          <a href={row.pdfUrl} target="_blank" rel="noreferrer" className="ml-2 text-emerald-700">
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
      <p className="mt-3 text-xs text-slate-600">
        TODO: validar sesión y accessStatus en backend para ambos endpoints antes de producción.
      </p>
    </WizardShell>
  );
}

