"use client";

import { useDraftGuard } from "@/components/contracts/draft-tools";
import { ExpedienteNotesCard } from "@/components/contracts/expediente-notes-card";
import { WizardShell } from "@/components/contracts/wizard-shell";
import { appendAudit, getDraft, setNotarizationSelection, toContractInput, updateDraft } from "@/features/contracts/wizard-state";
import { auditEvent } from "@/features/contracts/audit";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
import { useFreeTier } from "@/lib/useFreeTier";
import type {
  ContractPreviewResponse,
  GenerateContractPdfResponse,
  SaveDraftVersionResponse,
} from "@/domain/contracts/api-types";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ReadAloudButton } from "@/components/a11y/read-aloud-button";

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

/** Etiqueta amigable para el rol de cada firmante (partyType). */
function signerPartyLabel(party: string): string {
  const map: Record<string, string> = {
    landlord: "Arrendador (dueño)",
    tenant: "Arrendatario (inquilino)",
    solidaryCoDebtor: "Codeudor solidario",
  };
  if (map[party]) return map[party];
  if (party.startsWith("solidaryCoDebtor_")) return `Codeudor ${party.slice("solidaryCoDebtor_".length)}`;
  return party;
}

/** Estado de firma en palabras (color + texto). */
function signatureStatusLabel(status: string): { text: string; className: string } {
  const s = (status || "").toLowerCase();
  if (s === "signed") return { text: "✓ Firmó", className: "font-semibold text-emerald-700" };
  if (s === "sent" || s === "pending" || s === "in_progress")
    return { text: "Pendiente de firma", className: "text-amber-700" };
  if (s === "expired") return { text: "Enlace vencido", className: "text-rose-700" };
  return { text: status || "—", className: "text-slate-600" };
}

export default function PreviewStepPage() {
  const id = String(useParams<{ id: string }>().id);
  const { draft, state } = useDraftGuard(id);
  const { user } = useAuth();
  const freeTier = useFreeTier();
  // Estado Plus: define si el contrato lleva marca de agua + CTA del tier gratis.
  const [plusActive, setPlusActive] = useState(false);
  // Demo también habilita firmar/posventa (sin ser Plus de pago).
  const [demoActive, setDemoActive] = useState(false);
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
  const [refreshingSignatures, setRefreshingSignatures] = useState(false);
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
      signingUrl?: string;
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
  const [wantsDigitalNotaryUi, setWantsDigitalNotaryUi] = useState(false);
  // Ref al HTML del contrato renderizado, para la lectura por voz.
  const contractRef = useRef<HTMLDivElement>(null);

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
        const data = (await res.json()) as { success?: boolean; plusActive?: boolean; demoActive?: boolean };
        if (!cancelled) {
          setPlusActive(Boolean(res.ok && data.success && data.plusActive));
          setDemoActive(Boolean(res.ok && data.success && data.demoActive));
        }
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
    setWantsDigitalNotaryUi(Boolean(d?.notarization?.wantsDigitalNotary));
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
        headers: { "content-type": "application/json", ...(user ? await buildAuthHeaders(user) : {}) },
        body: JSON.stringify({
          contractPayload: toContractInput(activeDraft),
          isDemo: Boolean(activeDraft.isDemo),
          isFreeTier: freeTier.enabled && !activeDraft.isDemo && !plusActive,
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

  async function saveDraftVersion(opts?: { force?: boolean }): Promise<SavedVersionState | null> {
    if (!activeDraft) return null;
    if (!previewHtml || !versionInfo) {
      setRenderErrors(["Primero genera la vista previa del contrato."]);
      return null;
    }
    // Sin `force`, si ya hay versión no re-guardamos (evita duplicar). Con
    // `force` (botón "Guardar de nuevo"), SÍ re-guardamos para capturar cambios
    // de datos (p. ej. un correo editado) en una versión nueva.
    if (savedVersion && !opts?.force) return savedVersion;
    setSavingVersion(true);
    setSaveMessage("");
    try {
      const res = await fetch("/api/contracts/save-draft-version", {
        method: "POST",
        headers: { "content-type": "application/json", ...(user ? await buildAuthHeaders(user) : {}) },
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
        // Quien ya firmó no se reenvía: lo indicamos claramente para que se vea
        // quién firmó y quién falta.
        if (s.signatureStatus === "signed") {
          return `${label} (${s.signerEmail}): ✓ firma ya realizada (no se reenvía).`;
        }
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
      // "skipped" ya no cuenta como fallo: ahora significa "ya había firmado".
      const anyFailed = data.signatures.some((s) => s.emailMode === "failed");
      let footer: "mock" | "send_failed" | undefined;
      if (anyFailed) footer = "send_failed";
      else if (!anyReal) footer = "mock";
      setSignatureRoundMessage({
        tone: anyFailed ? "warning" : "info",
        title: anyReal
          ? "Enviamos la solicitud de firma por correo a cada parte."
          : "Preparamos la ronda de firmas para todas las partes.",
        details,
        footer,
      });
      // El resultado aparece más abajo en la página; lo traemos a la vista para
      // que el usuario vea que SÍ pasó algo al pulsar "Iniciar firma".
      setTimeout(() => {
        document.getElementById("firma-resultado")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
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

  // Al RECARGAR la página, `savedVersion` queda vacío (solo se llena al guardar
  // durante la sesión). Si el contrato ya tiene una versión guardada en el
  // servidor, la hidratamos para poder mostrar el estado de las firmas. Sin
  // esto, tras firmar y refrescar no se veía ningún avance (parecía que no había
  // pasado nada) y el botón de firma quedaba deshabilitado: un callejón sin salida.
  useEffect(() => {
    if (savedVersion) return;
    if (!id) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/contracts/latest-version?contractId=${encodeURIComponent(id)}`);
        const data = (await res.json()) as {
          success?: boolean;
          contract?: { currentVersionId?: string | null; status?: string | null } | null;
          version?: { id?: string; contractId?: string | null } | null;
        };
        if (cancelled || !res.ok || !data.success) return;
        const versionId = data.version?.id ?? data.contract?.currentVersionId ?? null;
        if (versionId) {
          setSavedVersion({
            contractId: id,
            contractVersionId: versionId,
            versionNumber: 0,
            documentHash: "",
          });
          if (data.contract?.status) setContractStatus(data.contract.status);
        }
      } catch {
        /* silencioso: si no hay versión aún, el flujo normal sigue igual */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, savedVersion]);

  // Refresco manual del estado de firmas (botón "Actualizar estado"): re-consulta
  // la lista para que el dueño vea, sin recargar, quién ya firmó.
  async function refreshSignatures() {
    if (!savedVersion) return;
    setRefreshingSignatures(true);
    try {
      const sigRes = await fetch(
        `/api/signatures/list?contractId=${encodeURIComponent(savedVersion.contractId)}&contractVersionId=${encodeURIComponent(savedVersion.contractVersionId)}`,
      );
      const sigData = (await sigRes.json()) as
        | { success: true; signatures: typeof signatureRows }
        | { success: false };
      if (sigRes.ok && sigData.success) setSignatureRows(sigData.signatures);
    } catch {
      /* silencioso */
    } finally {
      setRefreshingSignatures(false);
    }
  }

  if (state !== "ready" || !activeDraft) return <p className="text-sm text-slate-700">Cargando…</p>;

  return (
    <WizardShell title="Revisa y finaliza tu contrato" currentStep={10} contractId={id}>
      <p className="mb-4 flex items-start gap-2 text-xs text-slate-500">
        <span aria-hidden="true">👀</span>
        <span>Esta es tu vista previa. Queda listo para firma cuando ambas partes revisen y acepten la versión final.</span>
      </p>
      {/* Notas del expediente: secundario → plegado para no saturar el cierre. */}
      <details className="group mb-4 rounded-2xl border border-slate-200 bg-white/85 shadow-[0_6px_20px_rgba(86,70,229,0.06)] p-4">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold text-slate-900">
          <span>📝 Anotaciones del expediente (opcional)</span>
          <span className="text-xs font-normal text-slate-500 group-open:hidden">Toca para ver ▾</span>
        </summary>
        <div className="mt-3">
          <ExpedienteNotesCard draftId={id} initialNotes={activeDraft.expedienteNotes ?? ""} variant="banner" />
        </div>
      </details>
      <details className="group mb-4 rounded-2xl border border-slate-200 bg-white/85 shadow-[0_6px_20px_rgba(86,70,229,0.06)] p-4 text-sm text-slate-800">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-semibold text-slate-900">
          <span>🏛️ ¿Autenticar el contrato? (opcional)</span>
          <span className="text-xs font-normal text-slate-500 group-open:hidden">Toca para ver ▾</span>
        </summary>
        <div className="mt-2">
        <p className="mt-1 text-xs text-slate-600">
          La firma electrónica que hacen aquí (código OTP + evidencia de fecha, IP y hash) ya tiene validez legal en
          Colombia (Ley 527 de 1999). Si además quieren un respaldo extra, tienen dos caminos. Puedes elegir{" "}
          <strong>uno, ambos o ninguno</strong>. Ninguno reemplaza la firma electrónica de la plataforma; son
          complementarios.
        </p>

        {/* Opción A · Notaría digital gratuita (firma del Estado) */}
        <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3">
          <input
            type="checkbox"
            checked={wantsDigitalNotaryUi}
            onChange={(e) => {
              const v = e.target.checked;
              setWantsDigitalNotaryUi(v);
              setNotarizationSelection(id, { wantsDigitalNotary: v });
            }}
            className="mt-0.5"
          />
          <span>
            <span className="block font-semibold text-emerald-900">Notaría digital · gratis</span>
            <span className="mt-0.5 block text-xs text-slate-700">
              Firma y autenticación digital gratuita del Estado (Agencia Nacional Digital, Decreto 620 de 2020). Se hace{" "}
              <strong>uno a uno</strong>, por fuera de la app: cada parte firma el mismo PDF en su turno y el último sube
              el PDF final en el paso de <strong>Notaría</strong> del expediente. Es opcional y sin costo.
            </span>
            <a
              href="https://firmaautenticaciondigital.and.gov.co/"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex text-xs font-medium text-violet-700 underline"
            >
              Ir a Firma y Autenticación Digital (Agencia Nacional Digital) ↗
            </a>
          </span>
        </label>

        {/* Opción B · Notaría física (con costo) */}
        <label className="mt-2 flex cursor-pointer items-start gap-2 rounded-2xl border border-slate-200 bg-white/85 p-3">
          <input
            type="checkbox"
            checked={wantsNotarizationUi}
            onChange={(e) => {
              const v = e.target.checked;
              setWantsNotarizationUi(v);
              setNotarizationSelection(id, { wantsNotarization: v });
              if (previewHtml) {
                setSaveMessage(
                  "Actualizaste la preferencia de notaría. Pulsa «Regenerar vista previa» y, si ya habías guardado versión, vuelve a guardarla para alinear el expediente.",
                );
              }
            }}
            className="mt-0.5"
          />
          <span>
            <span className="block font-semibold text-slate-900">
              Notaría física · opcional (sujeta a los costos de la notaría)
            </span>
            <span className="mt-0.5 block text-xs text-slate-700">
              Las partes acuden a una notaría para autenticar sus firmas o reconocer el contenido del contrato. El costo
              lo cobra la notaría según sus tarifas vigentes. El PDF autenticado se sube en el paso de{" "}
              <strong>Notaría</strong> del expediente.
            </span>
          </span>
        </label>

        <p className="mt-3 text-xs text-slate-500">
          Elijas lo que elijas (o nada), continúa abajo para revisar, guardar y firmar el contrato. El paso a paso
          completo y la carga del PDF firmado están en el paso de <strong>Notaría</strong> del expediente.
        </p>
        </div>
      </details>
      <div id="preview-acciones" className="mb-4 flex flex-wrap items-center gap-3 scroll-mt-24">
        <button
          type="button"
          onClick={requestPreview}
          disabled={loadingPreview}
          className="rounded-xl bg-[#5646E5] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
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
        <div role="alert" className="mb-4 rounded-3xl border-2 border-amber-300 bg-amber-50/70 p-5 text-sm text-amber-950 shadow-[0_6px_20px_rgba(245,165,36,0.12)]">
          <p className="flex items-center gap-2 text-base font-black">📋 Falta completar para poder generar</p>
          <p className="mt-0.5 text-xs text-amber-900/80">Estos datos son necesarios para el contrato. Vuelve al asistente para completarlos.</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {renderErrors.map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
          <Link href={`/dashboard/contracts/${id}/contract-type`} className="mt-3 inline-flex rounded-xl bg-[#5646E5] px-4 py-2 text-sm font-bold text-white transition hover:brightness-105">Completar datos →</Link>
        </div>
      )}
      {previewHtml && (
        <>
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate-500">Vista previa del contrato</p>
            <ReadAloudButton targetRef={contractRef} withText label="Escuchar el contrato en voz alta" />
          </div>
          {/* `relative z-0 [transform:translateZ(0)]` crea un bloque contenedor para
              descendientes con `position:fixed` (p. ej. marca de agua o CSS propio del
              contrato inyectado): así el HTML del contrato NUNCA escapa del recuadro ni
              se monta sobre el menú/encabezado. `overflow-auto` mantiene el scroll interno. */}
          <div className="relative z-0 max-h-[70vh] overflow-auto rounded-2xl border border-slate-200 bg-white/95 shadow-[0_6px_20px_rgba(86,70,229,0.06)] p-4 text-slate-900 [transform:translateZ(0)]">
            <div ref={contractRef} dangerouslySetInnerHTML={{ __html: previewHtml }} />
          </div>
        </>
      )}
      {versionInfo && (
        <details className="group mt-3 rounded-2xl border border-slate-200 bg-white/85 p-3 text-xs text-slate-600">
          <summary className="cursor-pointer list-none font-medium text-slate-500">🔐 Datos técnicos de la versión (hash) <span className="group-open:hidden">▾</span></summary>
          <div className="mt-2 space-y-0.5 break-all">
            <p>Hash: {versionInfo.documentHash}</p>
            <p>Versión draft: {versionInfo.versionNumber}</p>
            <p>Generado: {new Date(versionInfo.generatedAt).toLocaleString("es-CO")}</p>
          </div>
        </details>
      )}
      {/* Finalizar — flujo guiado en 3 pasos: Guarda → Firma (Plus) → PDF */}
      <section className="mt-6 rounded-3xl border-2 border-[#5646E5]/20 bg-[#ECE9FB]/40 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-black text-[#17151F]">✅ Finaliza tu contrato</h3>
          <p className="rounded-full bg-white/70 px-3 py-1 text-[11px] font-bold text-[#5646E5]">Guarda → Firma → PDF</p>
        </div>

        {/* Paso 1 · Guardar */}
        <div className="mt-3 rounded-2xl border border-slate-200 bg-white/95 shadow-[0_6px_20px_rgba(86,70,229,0.06)] p-3">
          <p className="text-sm font-semibold text-slate-900">Paso 1 · Guarda tu contrato</p>
          <p className="mt-0.5 text-xs text-slate-600">
            {savedVersion
              ? "Listo: tu contrato quedó registrado. Ya puedes firmar, descargar el PDF y usar la posventa."
              : "Deja registrada esta versión para poder firmar, descargar el PDF y habilitar la posventa (pagos, novedades, documentos)."}
          </p>
          {savedVersion && (
            <p className="mt-1 rounded-md border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-900">
              ¿Volviste atrás y cambiaste datos de una parte (por ejemplo, el correo del codeudor)? Pulsa{" "}
              <strong>«Guardar de nuevo»</strong> aquí y luego <strong>reenvía las firmas</strong> para que se use el dato
              actualizado. La firma toma los datos de la última versión guardada.
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void saveDraftVersion({ force: Boolean(savedVersion) })}
              disabled={savingVersion || !previewHtml}
              className="rounded-xl bg-[#5646E5] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {savingVersion
                ? "Guardando…"
                : savedVersion
                  ? "Guardar de nuevo (si cambiaste datos)"
                  : "Guardar mi contrato"}
            </button>
            {savedVersion && !savingVersion && (
              <span className="text-xs font-medium text-emerald-700">
                Guardado ✓{versionInfo ? ` (v${versionInfo.versionNumber})` : ""}
              </span>
            )}
            {!previewHtml && !savedVersion && (
              <span className="text-xs text-slate-500">Espera a que termine la vista previa (se genera sola).</span>
            )}
          </div>
        </div>

        {/* Paso 2 · Firmar (Plan Plus) */}
        <div className="mt-2 rounded-2xl border border-slate-200 bg-white/95 shadow-[0_6px_20px_rgba(86,70,229,0.06)] p-3">
          <p className="text-sm font-semibold text-slate-900">
            Paso 2 · Firma electrónica <span className="text-violet-700">(Plan Plus)</span>
          </p>
          {!(plusActive || demoActive) ? (
            <>
              <p className="mt-0.5 text-xs text-slate-600">
                La firma con respaldo legal (código OTP + evidencia de IP/fecha/hash, Ley 527) es parte del Plan Plus.
                Puedes generar el contrato gratis y firmarlo cuando actives Plus.
              </p>
              {activeDraft?.specialClauses?.enabled &&
                activeDraft.specialClauses.selected?.includes("OTRA") && (
                  <p className="mt-1 text-xs text-amber-800">
                    Este contrato incluye la cláusula «Otra» (con costo): se sumará automáticamente en el carrito al
                    activar Plan Plus.
                  </p>
                )}
              <Link
                href={`/dashboard/plans?contract=${encodeURIComponent(activeDraft?.id ?? id)}`}
                className="mt-2 inline-flex rounded-lg border border-violet-500 px-4 py-2 text-sm font-medium text-violet-700"
              >
                Activar Plan Plus
              </Link>
            </>
          ) : (
            <>
              <p className="mt-0.5 text-xs text-slate-600">
                {!savedVersion
                  ? "Primero completa el Paso 1 (guardar tu contrato)."
                  : hasAllSigned
                    ? "El contrato ya quedó firmado por todas las partes. Revisa el estado más abajo ↓"
                    : signatureRows.length > 0
                      ? "La ronda de firmas ya está iniciada. Puedes reenviar la invitación por correo si alguna parte no la recibió."
                      : "Enviaremos la solicitud de firma por correo a cada parte (arrendador, arrendatario y codeudores)."}
              </p>
              <button
                type="button"
                onClick={startSignatureRound}
                disabled={startingSignatures || !savedVersion || hasAllSigned}
                className="mt-2 rounded-lg border border-sky-500 px-4 py-2 text-sm font-medium text-sky-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {startingSignatures
                  ? "Iniciando firma…"
                  : signatureRows.length > 0
                    ? "Reenviar invitación de firma"
                    : "Iniciar firma"}
              </button>
              {!startingSignatures && signatureRows.length > 0 && (
                <p className="mt-1 text-xs font-medium text-emerald-700">
                  ✓ Ronda de firmas iniciada. Revisa el detalle de firmas más abajo ↓
                </p>
              )}
            </>
          )}
        </div>

        {/* Paso 3 · PDF (disponible para todos; gratis sale con marca de agua) */}
        <div className="mt-2 rounded-2xl border border-slate-200 bg-white/95 shadow-[0_6px_20px_rgba(86,70,229,0.06)] p-3">
          <p className="text-sm font-semibold text-slate-900">Paso 3 · Descarga el PDF</p>
          <p className="mt-0.5 text-xs text-slate-600">
            Genera el PDF de tu contrato. Si aún no lo guardaste, lo hacemos por ti automáticamente.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void generatePdf()}
              disabled={generatingPdf || savingVersion || !previewHtml}
              className="rounded-xl border-2 border-[#5646E5] px-4 py-2 text-sm font-bold text-[#5646E5] transition hover:bg-[#ECE9FB] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {generatingPdf ? "Generando PDF…" : savingVersion ? "Guardando…" : "Generar PDF"}
            </button>
            {pdfInfo && (
              <a
                href={pdfInfo.pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border-2 border-[#12B886] px-4 py-2 text-sm font-bold text-[#0B6E4E] transition hover:bg-[#12B886]/10"
              >
                Descargar PDF
              </a>
            )}
          </div>
        </div>

        <div className="mt-3">
          <Link
            href={`/dashboard/contracts/${id}/review`}
            className="text-xs text-slate-600 underline hover:text-violet-700"
          >
            ← Volver a editar los datos del contrato
          </Link>
        </div>
      </section>
      {saveMessage && <p className="mt-3 text-sm text-emerald-700">{saveMessage}</p>}
      {pdfFeedback && (
        <p className="mt-2 text-sm text-violet-800" role="status">
          {pdfFeedback}
        </p>
      )}
      {contractStatus && <p className="text-xs text-slate-600">Estado contractual: {contractStatus}</p>}

      {signatureRoundMessage && (
        <div
          id="firma-resultado"
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
          <div className="mt-2 rounded border border-slate-200 bg-white/70 p-2 text-slate-700">
            <p className="font-semibold text-slate-900">¿Qué hace cada parte ahora?</p>
            <ol className="mt-1 list-decimal space-y-0.5 pl-5">
              <li>Recibe un correo con su <strong>enlace de firma</strong> y lo abre.</li>
              <li>Verifica su identidad con un <strong>código (OTP)</strong> que le llega al correo.</li>
              <li>Lee el contrato, acepta los consentimientos y <strong>firma</strong>.</li>
            </ol>
            <p className="mt-1">
              Cuando <strong>todas las partes</strong> hayan firmado, el contrato queda <strong>firmado</strong> y podrás
              descargar la versión final con su evidencia (fecha, IP y hash). Mientras tanto, puedes continuar con los
              siguientes pasos más abajo.
            </p>
          </div>
          {signatureRoundMessage.footer === "mock" && (
            <p className="mt-2">
              Nota: el <strong>envío automático de correos</strong> se activará cuando se configure el proveedor de
              correo (Resend) en el servidor. Por ahora las firmas quedan registradas en el expediente; al activarlo, las
              invitaciones
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
        <section className="mt-4 rounded-2xl border border-slate-200 bg-white/95 shadow-[0_6px_20px_rgba(86,70,229,0.06)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900">
              Estado de firmas
              <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                {signatureRows.filter((s) => s.signatureStatus === "signed").length} de {signatureRows.length} firmaron
              </span>
            </h3>
            <button
              type="button"
              onClick={() => void refreshSignatures()}
              disabled={refreshingSignatures}
              className="rounded-lg border border-violet-500 px-3 py-1.5 text-xs font-medium text-violet-700 disabled:opacity-60"
            >
              {refreshingSignatures ? "Actualizando…" : "↻ Actualizar estado"}
            </button>
          </div>

          {/* Guía de qué sigue, según cómo va la ronda. */}
          {hasAllSigned ? (
            <div className="mt-2 rounded-2xl border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-900">
              <p className="font-semibold">¡Todas las partes firmaron! 🎉</p>
              <p className="mt-0.5">
                El contrato quedó firmado con su evidencia (fecha, IP y hash). Cada parte recibió el aviso por correo.
                Continúa con la <strong>posventa</strong> más abajo para gestionar el arriendo (pagos, inventario y más).
              </p>
            </div>
          ) : (
            <div className="mt-2 rounded-lg border border-sky-300 bg-sky-50 p-3 text-xs text-sky-900">
              <p className="font-semibold">Vas en camino: falta que firmen algunas partes.</p>
              <p className="mt-0.5">
                Como <strong>arrendador (dueño)</strong>, cuando <strong>todas</strong> las partes firmen, el contrato
                quedará firmado y recibirás el aviso por correo. Puedes pulsar «↻ Actualizar estado» para ver el avance
                sin recargar. Pendientes:{" "}
                <strong>
                  {signatureRows
                    .filter((s) => s.signatureStatus !== "signed")
                    .map((s) => signerPartyLabel(s.partyType))
                    .join(", ") || "ninguna"}
                </strong>
                .
              </p>
            </div>
          )}

          {signatureRows.some((s) => s.signingUrl) && (
            <div className="mt-2 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
              <p className="font-semibold">Modo prueba (correo sin configurar)</p>
              <p className="mt-0.5">
                El correo aún no está activo, así que aquí tienes los enlaces para <strong>firmar cada parte tú
                mismo</strong> y probar el flujo completo. Al abrir cada enlace, pulsa «Solicitar código»: el código
                aparecerá en pantalla. Cuando actives el correo (Resend), estos enlaces dejarán de mostrarse y llegarán
                por correo a cada parte.
              </p>
            </div>
          )}

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
                  <th className="px-2 py-1 text-left">Enlace (prueba)</th>
                </tr>
              </thead>
              <tbody>
                {signatureRows.map((s, idx) => (
                  <tr key={`${s.partyType}-${idx}`} className="border-b border-slate-300">
                    <td className="px-2 py-1">{signerPartyLabel(s.partyType)}</td>
                    <td className="px-2 py-1">{s.signerName ?? "-"}</td>
                    <td className="px-2 py-1">{s.signerEmail}</td>
                    <td className={`px-2 py-1 ${signatureStatusLabel(s.signatureStatus).className}`}>
                      {signatureStatusLabel(s.signatureStatus).text}
                    </td>
                    <td className="px-2 py-1">{s.sentAt ? new Date(s.sentAt).toLocaleString("es-CO") : "-"}</td>
                    <td className="px-2 py-1">{s.signedAt ? new Date(s.signedAt).toLocaleString("es-CO") : "-"}</td>
                    <td className="px-2 py-1">
                      {s.signingUrl ? (
                        <a
                          href={s.signingUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-violet-700 underline"
                        >
                          Abrir y firmar →
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
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
        <div className="mt-3 rounded-2xl border border-slate-200 bg-white/95 shadow-[0_6px_20px_rgba(86,70,229,0.06)] p-3 text-xs text-slate-700">
          <p>PDF generado: {new Date(pdfInfo.pdfGeneratedAt).toLocaleString("es-CO")}</p>
          <p>Versión: {pdfInfo.versionNumber}</p>
          <p>Hash: {pdfInfo.documentHash}</p>
        </div>
      )}
      {hasAllSigned && (
        <section className="mt-4 rounded-2xl border border-emerald-500 bg-emerald-50 p-4 text-sm text-emerald-700">
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
        <section className="mt-4 rounded-2xl border border-slate-200 bg-white/95 shadow-[0_6px_20px_rgba(86,70,229,0.06)] p-4">
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

      {/* CTA FINAL — al final del todo, sin romper el flujo de los pasos de arriba. */}
      {savedVersion && (
        <section className="mt-8 rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50/90 to-white p-5 shadow-[0_8px_28px_rgba(139,92,246,0.14)]">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Y para terminar</p>
          {plusActive || demoActive ? (
            <>
              <h3 className="mt-1 text-base font-bold text-slate-900">Continúa con la posventa, paso a paso</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                Con tu contrato guardado, te llevamos a un <strong>centro de control</strong> donde haces, en orden y
                viendo qué falta: documentos de respaldo, método de pago, calendario de pagos, inventario de entrega y
                más.
              </p>
              <Link
                href={`/dashboard/contracts/${id}/adicionales`}
                className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-[#5646E5] px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition hover:brightness-105 active:scale-95"
              >
                Ir a la posventa →
              </Link>
            </>
          ) : (
            <>
              <h3 className="mt-1 text-base font-bold text-slate-900">
                Tu contrato está listo. ¿Quieres el respaldo completo del arriendo?
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                Lo generaste y guardaste <strong>gratis</strong>. El acompañamiento <strong>durante el arriendo</strong>{" "}
                es parte del <strong>Plan Plus</strong>:
              </p>
              <ul className="mt-2 grid gap-1 text-xs text-slate-700 sm:grid-cols-2">
                <li>• Inventario y acta de entrega</li>
                <li>• Alertas de vencimiento y renovación</li>
                <li>• Recordatorios y notificaciones</li>
                <li>• Registro de pagos y soportes</li>
                <li>• Registro de novedades y mantenimientos</li>
                <li>• Calificación de la experiencia</li>
              </ul>
              <Link
                href="/dashboard/plans"
                className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-[#5646E5] px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition hover:brightness-105 active:scale-95"
              >
                Activar Plan Plus →
              </Link>
            </>
          )}
        </section>
      )}
    </WizardShell>
  );
}

