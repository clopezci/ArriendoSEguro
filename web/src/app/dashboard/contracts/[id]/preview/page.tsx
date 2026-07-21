"use client";

import { useDraftGuard } from "@/components/contracts/draft-tools";
import { ExpedienteNotesCard } from "@/components/contracts/expediente-notes-card";
import { WizardShell } from "@/components/contracts/wizard-shell";
import { appendAudit, getDraft, setNotarizationSelection, toContractInput, updateDraft } from "@/features/contracts/wizard-state";
import { flushDraftToServer } from "@/features/contracts/draft-server-sync";
import { InviteSupportsOwnerList } from "@/components/contracts/invite-supports-owner-list";
import { OwnerIncomeReminder } from "@/components/contracts/owner-income-reminder";
import { PropertyDocUpload } from "@/components/contracts/property-doc-upload";
import { PoderUpload } from "@/components/contracts/poder-upload";
import { SpecialClauseReviewStatus } from "@/components/contracts/special-clause-review-status";
import { formatAppDateTime } from "@/lib/datetime/appTime";
import { INTRO_PROMO_TITLE, INTRO_PROMO_MESSAGE } from "@/lib/product-pricing";
import type { PropertyDocType } from "@/domain/contracts/draftPropertyDocs";
import type { PartyDraft } from "@/features/contracts/draft-types";
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
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ReadAloudButton } from "@/components/a11y/read-aloud-button";

/** Secciones del cierre paso a paso (bento): una a la vez. */
type Section = "revisar" | "documentos" | "guardar" | "firma" | "pdf" | "posventa";
const SECTIONS: { key: Section; label: string }[] = [
  { key: "revisar", label: "Revisar" },
  { key: "documentos", label: "Documentos" },
  { key: "guardar", label: "Guardar" },
  { key: "firma", label: "Firma" },
  { key: "pdf", label: "PDF" },
  { key: "posventa", label: "Terminar" },
];

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
  const [importingParties, setImportingParties] = useState(false);
  const [importMsg, setImportMsg] = useState("");
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
  // Documentos que soportan la propiedad subidos en el borrador. Es requisito
  // para generar (se puede saltar en el asistente, pero cuenta como pendiente
  // aquí). `null` = aún no consultado.
  const [propertyDocCount, setPropertyDocCount] = useState<number | null>(null);
  const [poderDocCount, setPoderDocCount] = useState<number | null>(null);
  const [propDocType, setPropDocType] = useState<PropertyDocType | "">("");
  // Revisión y cierre PASO A PASO (bento): una sección a la vez. Reúne TODO el
  // contenido de la pantalla en secciones para no apilarlo (antes eran 8 scrolls).
  // Sección inicial: por defecto "revisar", pero si volvemos del pago con
  // `?section=firma` retomamos AUTOMÁTICAMENTE el paso donde iba el usuario.
  const requestedSection = useSearchParams().get("section");
  const [section, setSection] = useState<Section>(
    requestedSection && SECTIONS.some((s) => s.key === requestedSection)
      ? (requestedSection as Section)
      : "revisar",
  );
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

  // Al montar: importa automáticamente lo que ya completaron por su enlace el
  // inquilino y los codeudores, para que sus datos aparezcan en el contrato sin
  // que el dueño tenga que pulsar nada. Corre una sola vez.
  const autoImportRan = useRef(false);
  useEffect(() => {
    if (!user || !activeDraft || autoImportRan.current) return;
    autoImportRan.current = true;
    void importInvitedParties({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeDraft?.id]);

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

  /**
   * Trae al contrato los datos que el inquilino/codeudor completaron por su
   * enlace (invitación) y que aún no se habían importado. Resuelve el caso
   * "invité a la persona pero sus datos no aparecen en la vista previa".
   */
  async function importOne(role: "tenant" | "solidaryCoDebtor", slot: number): Promise<boolean> {
    if (!user) return false;
    const res = await fetch(
      `/api/party-invite/status?contractDraftId=${encodeURIComponent(id)}&role=${role}&codebtorSlot=${slot}`,
      { headers: { ...(await buildAuthHeaders(user)) } },
    );
    const j = (await res.json()) as { success?: boolean; invite?: { status?: string; contribution?: PartyDraft | null } | null };
    const contribution = j?.invite?.contribution;
    if (!(res.ok && j.success && j.invite?.status === "completed" && contribution)) return false;
    updateDraft(id, (d) => {
      if (role === "tenant") return { ...d, tenant: { ...d.tenant, ...contribution } };
      if (slot === 0) return { ...d, hasSolidaryCoDebtor: true, solidaryCoDebtor: { ...d.solidaryCoDebtor, ...contribution } };
      const arr = [...(d.solidaryCoDebtors ?? [])];
      arr[slot - 1] = { ...(arr[slot - 1] ?? {}), ...contribution };
      const consents = [...(d.codebtorConsentsList ?? [])];
      consents[slot - 1] = consents[slot - 1] ?? { dataProcessingConsent: true, electronicSignatureConsent: true, solidaryObligationAcceptance: true };
      return { ...d, hasSolidaryCoDebtor: true, solidaryCoDebtors: arr, codebtorConsentsList: consents };
    });
    return true;
  }

  /**
   * Trae al contrato los datos que completaron por su enlace el inquilino y TODOS
   * los codeudores (principal + adicionales por slot), y que aún no se importaron.
   */
  async function importInvitedParties(opts?: { silent?: boolean }) {
    if (!user) return;
    setImportingParties(true);
    if (!opts?.silent) setImportMsg("");
    try {
      let imported = 0;
      if (await importOne("tenant", 0)) imported += 1;
      // Codeudores: principal (slot 0) + adicionales (1..5).
      for (let slot = 0; slot <= 5; slot += 1) {
        if (await importOne("solidaryCoDebtor", slot)) imported += 1;
      }
      if (imported > 0) {
        const updated = getDraft(id);
        if (updated) await flushDraftToServer(updated).catch(() => {});
        if (!opts?.silent) setImportMsg(`Importé ${imported} parte(s) que completaron por su enlace. Regenerando la vista previa…`);
        void requestPreview();
      } else if (!opts?.silent) {
        setImportMsg("Aún no hay datos completados por invitación para importar. Si invitaste a alguien, espera a que complete su enlace; si no, ingresa los datos en el asistente.");
      }
    } catch {
      if (!opts?.silent) setImportMsg("No se pudo importar. Intenta de nuevo.");
    } finally {
      setImportingParties(false);
    }
  }

  const refreshPropertyDocs = useCallback(async (): Promise<{ property: number; poder: number } | null> => {
    if (!user || !id) return null;
    try {
      const res = await fetch(`/api/contracts/draft-property-docs/list?contractDraftId=${encodeURIComponent(id)}`, {
        headers: { ...(await buildAuthHeaders(user)) },
      });
      const j = (await res.json()) as { success?: boolean; docs?: { docType?: string }[] };
      if (res.ok && j.success) {
        const list = Array.isArray(j.docs) ? j.docs : [];
        const property = list.filter((d) => d.docType !== "poder").length;
        const poder = list.filter((d) => d.docType === "poder").length;
        setPropertyDocCount(property);
        setPoderDocCount(poder);
        return { property, poder };
      }
    } catch {
      /* si falla la consulta, no bloqueamos por esto */
    }
    return null;
  }, [user, id]);

  useEffect(() => {
    void refreshPropertyDocs();
  }, [refreshPropertyDocs]);

  // Semilla del tipo de documento de propiedad desde el borrador (para la casilla).
  useEffect(() => {
    const t = (activeDraft?.property as { propertyDocType?: string } | undefined)?.propertyDocType;
    if (t && !propDocType) setPropDocType(t as PropertyDocType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDraft?.id]);

  // Al guardar por primera vez, avanzamos UNA vez a la sección de firma (fluidez).
  // Después el usuario navega libre con los botones/indicador.
  const savedAdvancedRef = useRef(false);
  useEffect(() => {
    if (savedVersion && !savedAdvancedRef.current) {
      savedAdvancedRef.current = true;
      setSection((s) => (s === "guardar" ? "firma" : s));
    }
  }, [savedVersion]);

  async function requestPreview() {
    if (!activeDraft) return;
    // Releemos el borrador FRESCO de localStorage: tras "Importar datos de
    // invitados" (updateDraft) el estado en memoria `activeDraft` queda viejo, y
    // sin esto la vista previa seguía marcando faltantes ya resueltos.
    const d = getDraft(id) ?? activeDraft;
    setLoadingPreview(true);
    setRenderErrors([]);
    setSaveMessage("");
    auditEvent("contract_preview_requested", { contractDraftId: id });
    try {
      const res = await fetch("/api/contracts/preview", {
        method: "POST",
        headers: { "content-type": "application/json", ...(user ? await buildAuthHeaders(user) : {}) },
        body: JSON.stringify({
          contractPayload: toContractInput(d),
          isDemo: Boolean(d.isDemo),
          isFreeTier: freeTier.enabled && !d.isDemo && !plusActive,
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
    // El documento que soporta la propiedad es requisito para generar (se pudo
    // saltar en el asistente, pero no se puede generar sin él). Refrescamos por si
    // acaba de subirlo aquí mismo.
    const proxy = activeDraft?.actingAs === "proxy";
    if (propertyDocCount === 0 || (proxy && poderDocCount === 0)) {
      const fresh = await refreshPropertyDocs();
      if (fresh && fresh.property === 0) {
        setRenderErrors(["Falta subir el documento que soporta la propiedad del inmueble. Cárgalo en «Documento de propiedad» más arriba para poder generar el contrato."]);
        return null;
      }
      if (fresh && proxy && fresh.poder === 0) {
        setRenderErrors(["Como apoderado, falta subir el PODER que te faculta para arrendar. Cárgalo en «Poder del apoderado» más arriba para poder generar el contrato."]);
        return null;
      }
    }
    // Sin `force`, si ya hay versión no re-guardamos (evita duplicar). Con
    // `force` (botón "Guardar de nuevo"), SÍ re-guardamos para capturar cambios
    // de datos (p. ej. un correo editado) en una versión nueva.
    if (savedVersion && !opts?.force) return savedVersion;
    setSavingVersion(true);
    setSaveMessage("");
    try {
      // Borrador fresco (con lo importado de invitados), no el estado en memoria.
      const d = getDraft(id) ?? activeDraft;
      const res = await fetch("/api/contracts/save-draft-version", {
        method: "POST",
        headers: { "content-type": "application/json", ...(user ? await buildAuthHeaders(user) : {}) },
        body: JSON.stringify({
          contractDraftId: id,
          contractPayload: toContractInput(d),
          html: cleanHtmlForSave || previewHtml,
          documentHash: versionInfo.documentHash,
          hasSolidaryCoDebtor: d.hasSolidaryCoDebtor,
          generatedAt: versionInfo.generatedAt,
          renewalReminderEnabled: d.renewalReminderEnabled ?? true,
          // Ingresos SOLO para validar solvencia (ingreso ≥ canon) en el servidor.
          // No se persisten: el servidor los valida y los descarta.
          solvency: {
            tenantMonthlyIncome: d.tenantMonthlyIncome,
            codebtorMonthlyIncomes: [
              d.solidaryCoDebtor?.economicSupport?.monthlyIncome,
              ...(d.solidaryCoDebtors ?? []).map((c) => c?.economicSupport?.monthlyIncome),
            ].filter((x): x is number => typeof x === "number" && x > 0),
          },
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
          { headers: { ...(user ? await buildAuthHeaders(user) : {}) } },
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
          { headers: { ...(user ? await buildAuthHeaders(user) : {}) } },
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

  // Navegación del sub-flujo bento (una sección a la vez).
  const proxyDraft = activeDraft?.actingAs === "proxy";
  const sectionOrder: Section[] = ["revisar", "documentos", "guardar", "firma", "pdf", "posventa"];
  const goNext = () => setSection(sectionOrder[Math.min(sectionOrder.indexOf(section) + 1, sectionOrder.length - 1)]);
  const goPrev = () => setSection(sectionOrder[Math.max(sectionOrder.indexOf(section) - 1, 0)]);
  const sectionDone = (k: Section): boolean =>
    k === "revisar" ? Boolean(previewHtml)
    : k === "documentos" ? (propertyDocCount !== null && propertyDocCount > 0 && (!proxyDraft || (poderDocCount !== null && poderDocCount > 0)))
    : k === "guardar" ? Boolean(savedVersion)
    : k === "firma" ? hasAllSigned
    : k === "pdf" ? Boolean(pdfInfo)
    : false;
  // Firma/PDF/Posventa requieren haber guardado; Revisar/Documentos/Guardar libres.
  const canGoSection = (k: Section): boolean => (k === "firma" || k === "pdf" || k === "posventa" ? Boolean(savedVersion) : true);

  return (
    <WizardShell title="Revisa y finaliza tu contrato" currentStep={10} contractId={id} hideGuide>
      {/* Navegación: volver a editar (bento) o ver/editar en la vista clásica completa. */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href={`/nuevo?id=${id}`} className="inline-flex items-center gap-1.5 rounded-2xl border-2 border-[#5646E5]/30 bg-white px-4 py-2 text-sm font-bold text-[#5646E5] transition hover:bg-[#ECE9FB]">
          ← Volver a editar
        </Link>
        <Link href={`/nuevo/contratos`} className="inline-flex items-center gap-1.5 rounded-2xl border-2 border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-[#5646E5]">
          Mis contratos
        </Link>
        <details className="group relative">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-2xl border-2 border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-500 transition hover:border-[#5646E5]">
            Editar en bloque ▾
          </summary>
          <div className="absolute z-20 mt-1 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
            <p className="px-2 py-1 text-[11px] text-slate-400">Vista completa, campo por campo. Puedes volver aquí con «Revisión y vista previa» arriba.</p>
            <Link href={`/dashboard/contracts/${id}/contract-type`} className="block rounded-lg px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-100">Abrir edición en bloque →</Link>
          </div>
        </details>
      </div>

      {/* Sub-flujo bento: una sección a la vez (Revisar → Documentos → Guardar → Firma → PDF → Posventa). */}
      <div className="mb-4 rounded-3xl border-2 border-[#5646E5]/15 bg-[#ECE9FB]/40 p-3">
        <div className="flex items-start gap-1 overflow-x-auto">
          {SECTIONS.map((s, i) => {
            const done = sectionDone(s.key);
            const active = section === s.key;
            const can = canGoSection(s.key);
            return (
              <button key={s.key} type="button" disabled={!can} onClick={() => can && setSection(s.key)}
                className={`flex min-w-[54px] flex-1 flex-col items-center gap-1 ${can ? "cursor-pointer" : "cursor-not-allowed"}`}>
                <span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${done ? "bg-[#12B886] text-white" : active ? "bg-[#5646E5] text-white" : "bg-white text-slate-400 ring-1 ring-slate-200"}`}>{done ? "✓" : i + 1}</span>
                <span className={`text-[10px] font-semibold ${active ? "text-[#5646E5]" : done ? "text-[#0B6E4E]" : "text-slate-400"}`}>{s.label}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-center text-[11px] text-slate-500">Vas por «{SECTIONS.find((s) => s.key === section)?.label}». Avanza con «Continuar» abajo o toca un paso.</p>
      </div>
      {section === "revisar" && (
      <p className="mb-4 flex items-start gap-2 text-xs text-slate-500">
        <span aria-hidden="true">👀</span>
        <span>Esta es tu vista previa. Queda listo para firma cuando ambas partes revisen y acepten la versión final.</span>
      </p>
      )}
      {/* Notas del expediente: secundario → plegado para no saturar el cierre. */}
      {section === "revisar" && (
      <details className="group mb-4 rounded-2xl border border-slate-200 bg-white/85 shadow-[0_6px_20px_rgba(86,70,229,0.06)] p-4">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold text-slate-900">
          <span>📝 Anotaciones del expediente (opcional)</span>
          <span className="text-xs font-normal text-slate-500 group-open:hidden">Toca para ver ▾</span>
        </summary>
        <div className="mt-3">
          <ExpedienteNotesCard draftId={id} initialNotes={activeDraft.expedienteNotes ?? ""} variant="banner" />
        </div>
      </details>
      )}
      {/* PRIMERO: completar/importar lo que falta. Sin esto no se puede generar. */}
      {(section === "documentos" || section === "revisar") && renderErrors.length > 0 && (
        <div role="alert" className="mb-4 rounded-3xl border-2 border-amber-300 bg-amber-50/70 p-5 text-sm text-amber-950 shadow-[0_6px_20px_rgba(245,165,36,0.12)]">
          <p className="flex items-center gap-2 text-base font-black">📋 Completa esto para ver, imprimir y firmar</p>
          <p className="mt-0.5 text-xs text-amber-900/80">
            El contrato aún no se puede generar porque faltan datos. Si invitaste al inquilino o al codeudor, pulsa{" "}
            <strong>«Importar datos de invitados»</strong> (deben haber completado su enlace). También puedes ingresarlos
            tú desde el asistente. Al resolverlo, se genera la vista previa y podrás firmar.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {renderErrors.map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => void importInvitedParties()} disabled={importingParties}
              className="inline-flex rounded-xl bg-[#12B886] px-4 py-2 text-sm font-bold text-white transition hover:brightness-105 disabled:opacity-50">
              {importingParties ? "Importando…" : "Importar datos de invitados (inquilino y codeudor)"}
            </button>
            <Link href={`/nuevo?id=${id}`} className="inline-flex rounded-xl bg-[#5646E5] px-4 py-2 text-sm font-bold text-white transition hover:brightness-105">Volver al asistente →</Link>
          </div>
          {importMsg && <p className="mt-2 text-xs font-medium text-amber-950">{importMsg}</p>}
        </div>
      )}
      {/* Documento que soporta la propiedad: se pudo saltar en el asistente, pero
          es requisito para generar. Si falta, se marca pendiente y aquí se sube. */}
      {section === "documentos" && (
      <div className="mb-4">
        {propertyDocCount === 0 && (
          <p className="mb-2 rounded-2xl border-2 border-amber-300 bg-amber-50/70 p-3 text-sm font-medium text-amber-900">
            ⚠️ Pendiente: falta el <b>documento que soporta la propiedad</b> del inmueble. Súbelo aquí para poder generar el contrato.
          </p>
        )}
        {propertyDocCount !== null && propertyDocCount > 0 && (
          <p className="mb-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">✓ Documento de propiedad cargado ({propertyDocCount}).</p>
        )}
        <PropertyDocUpload
          contractDraftId={id}
          docType={propDocType}
          onDocType={(v) => { setPropDocType(v); updateDraft(id, (d) => ({ ...d, property: { ...d.property, propertyDocType: v } as typeof d.property })); }}
          expectedName={activeDraft?.actingAs === "proxy" ? (activeDraft?.grantorFullName ?? "") : (activeDraft?.landlord?.fullName ?? "")}
          expectedAddress={activeDraft?.property?.address ?? ""}
          actingAs={activeDraft?.actingAs === "proxy" ? "proxy" : "owner"}
          onUploaded={() => void refreshPropertyDocs()}
        />
        {activeDraft?.actingAs === "proxy" && (
          <div className="mt-2">
            {poderDocCount === 0 && (
              <p className="mb-2 rounded-2xl border-2 border-amber-300 bg-amber-50/70 p-3 text-sm font-medium text-amber-900">
                ⚠️ Pendiente: como <b>apoderado</b> falta subir el <b>poder</b>. Súbelo aquí para poder generar el contrato.
              </p>
            )}
            {poderDocCount !== null && poderDocCount > 0 && (
              <p className="mb-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">✓ Poder cargado ({poderDocCount}).</p>
            )}
            <PoderUpload contractDraftId={id} onUploaded={() => void refreshPropertyDocs()} />
          </div>
        )}
      </div>
      )}
      {section === "revisar" &&
        activeDraft?.specialClauses?.enabled &&
        activeDraft.specialClauses.selected?.includes("OTRA") && (
          <div className="mb-4">
            <SpecialClauseReviewStatus contractId={activeDraft?.id ?? id} />
          </div>
        )}
      {section === "revisar" && (
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
              : renderErrors.length > 0
                ? "Reintentar vista previa"
                : "Generar vista previa"}
        </button>
        {!previewHtml && !loadingPreview && renderErrors.length === 0 && (
          <span className="text-xs text-slate-600">
            Estamos generando la primera vista previa automáticamente.
          </span>
        )}
      </div>
      )}
      {section === "revisar" && previewHtml && (
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
      {section === "revisar" && versionInfo && (
        <details className="group mt-3 rounded-2xl border border-slate-200 bg-white/85 p-3 text-xs text-slate-600">
          <summary className="cursor-pointer list-none font-medium text-slate-500">🔐 Datos técnicos de la versión (hash) <span className="group-open:hidden">▾</span></summary>
          <div className="mt-2 space-y-0.5 break-all">
            <p>Hash: {versionInfo.documentHash}</p>
            <p>Versión draft: {versionInfo.versionNumber}</p>
            <p>Generado: {new Date(versionInfo.generatedAt).toLocaleString("es-CO")}</p>
          </div>
        </details>
      )}
      {/* Documentos que subieron las partes por su enlace + ingresos declarados. */}
      {section === "documentos" && (() => {
        const canonN = Number(activeDraft?.lease?.monthlyRent ?? activeDraft?.property?.monthlyRentProposed ?? 0) || 0;
        const tInc = activeDraft?.tenantMonthlyIncome ?? 0;
        const cInc = activeDraft?.hasSolidaryCoDebtor ? (activeDraft?.solidaryCoDebtor?.economicSupport?.monthlyIncome ?? 0) : 0;
        const rows = [{ who: "Inquilino", income: tInc }, ...(activeDraft?.hasSolidaryCoDebtor ? [{ who: "Codeudor", income: cInc }] : [])];
        return (
          <div className="mt-4">
            <OwnerIncomeReminder rentReference={canonN} rows={rows} />
          </div>
        );
      })()}
      {section === "documentos" && (
      <div className="mt-4 space-y-2">
        <InviteSupportsOwnerList contractDraftId={id} role="tenant" title="📎 Documentos del inquilino" />
        <InviteSupportsOwnerList contractDraftId={id} role="solidaryCoDebtor" codebtorSlot={0} title="📎 Documentos del codeudor" />
        <InviteSupportsOwnerList contractDraftId={id} role="solidaryCoDebtor" codebtorSlot={1} title="📎 Documentos del codeudor 2" />
        <InviteSupportsOwnerList contractDraftId={id} role="solidaryCoDebtor" codebtorSlot={2} title="📎 Documentos del codeudor 3" />
        <InviteSupportsOwnerList contractDraftId={id} role="solidaryCoDebtor" codebtorSlot={3} title="📎 Documentos del codeudor 4" />
      </div>
      )}

      {/* Autenticación (notaría) — en la sección de firma (opcional). */}
      {section === "firma" && previewHtml && (
        <details className="group mt-4 rounded-2xl border border-slate-200 bg-white/85 shadow-[0_6px_20px_rgba(86,70,229,0.06)] p-4 text-sm text-slate-800">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-semibold text-slate-900">
            <span>🏛️ ¿Autenticar el contrato? (opcional, tras revisar la vista previa)</span>
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
                  Firma y autenticación digital gratuita del Estado (Agencia Nacional Digital, Decreto 620 de 2020). Se
                  hace <strong>uno a uno</strong>, por fuera de la app: cada parte firma el mismo PDF en su turno y el
                  último sube el PDF final en el paso de <strong>Notaría</strong> del expediente. Es opcional y sin costo.
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
                  Las partes acuden a una notaría para autenticar sus firmas o reconocer el contenido del contrato. El
                  costo lo cobra la notaría según sus tarifas vigentes. El PDF autenticado se sube en el paso de{" "}
                  <strong>Notaría</strong> del expediente.
                </span>
              </span>
            </label>

            <p className="mt-3 text-xs text-slate-500">
              Elijas lo que elijas (o nada), continúa abajo para guardar y firmar el contrato. La carga del PDF
              autenticado está en el paso de <strong>Notaría</strong> del expediente.
            </p>
          </div>
        </details>
      )}

      {/* Finalizar — cada paso vive en su sección del sub-flujo bento (stepper arriba). */}
      {(section === "guardar" || section === "firma" || section === "pdf" || section === "posventa") && (
      <section className="mt-6 rounded-3xl border-2 border-[#5646E5]/20 bg-[#ECE9FB]/40 p-5">
        {/* Paso 1 · Guardar */}
        {section === "guardar" && (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-white/95 shadow-[0_6px_20px_rgba(86,70,229,0.06)] p-3">
          <p className="text-sm font-semibold text-slate-900">Paso 1 · Guarda tu contrato</p>
          <p className="mt-0.5 text-xs text-slate-600">
            {savedVersion
              ? "Listo: tu contrato quedó registrado. Ya puedes firmar, descargar el PDF y usar la posventa."
              : "Deja registrada esta versión para poder firmar, descargar el PDF y habilitar la posventa (pagos, novedades, documentos)."}
          </p>
          {savedVersion && (
            <details className="mt-1 rounded-md border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-900">
              <summary className="cursor-pointer font-medium">¿Cambiaste datos de una parte después de guardar?</summary>
              <p className="mt-1">
                Si volviste atrás y cambiaste algo (por ejemplo, el correo del codeudor), pulsa{" "}
                <strong>«Guardar de nuevo»</strong> aquí y luego <strong>reenvía las firmas</strong> para que se use el dato
                actualizado. La firma toma los datos de la última versión guardada.
              </p>
            </details>
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
          {/* Errores del guardado, JUNTO al botón (antes solo se veían arriba, y en
              móvil quedaban fuera de vista: parecía "no pasa nada" y no continuaba). */}
          {renderErrors.length > 0 && (
            <div className="mt-2 rounded-lg border border-rose-300 bg-rose-50 p-2 text-xs text-rose-800" role="alert">
              {renderErrors.map((msg, i) => (
                <p key={i} className="mt-0.5 first:mt-0">• {msg}</p>
              ))}
            </div>
          )}
        </div>
        )}

        {/* Paso 2 · Firmar (Plan Plus) */}
        {section === "firma" && (
        <div className="mt-2 rounded-2xl border border-slate-200 bg-white/95 shadow-[0_6px_20px_rgba(86,70,229,0.06)] p-3">
          <p className="text-sm font-semibold text-slate-900">
            Paso 2 · Firma electrónica <span className="text-emerald-700">(incluida)</span>
          </p>
          {!(plusActive || demoActive) ? (
            <div className="mt-2 rounded-2xl border-2 border-[#FF6B4A]/40 bg-gradient-to-br from-[#FFF4EF] to-[#FFE9DF] p-4">
              <p className="inline-flex items-center gap-2 rounded-full bg-[#FF6B4A]/15 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-[#C7361A]">
                ⏳ Oferta por tiempo limitado
              </p>
              <p className="mt-2 text-sm font-black text-[#C7361A]">🎉 {INTRO_PROMO_TITLE}</p>
              <p className="mt-1 text-[13px] leading-snug text-slate-700">{INTRO_PROMO_MESSAGE}</p>
              <p className="mt-2 text-xs text-slate-600">
                Al activar tu plan podrás <strong>generar tu contrato</strong>, <strong>firmar electrónicamente</strong>{" "}
                (OTP + evidencia de IP/fecha/hash, Ley 527) y acceder a <strong>todos los beneficios</strong>.
              </p>
              {activeDraft?.specialClauses?.enabled &&
                activeDraft.specialClauses.selected?.includes("OTRA") && (
                  <p className="mt-2 text-xs text-amber-800">
                    Este contrato incluye la cláusula «Otra» (con costo): se sumará automáticamente en el carrito al
                    activar tu plan.
                  </p>
                )}
              <Link
                href={`/dashboard/plans?contract=${encodeURIComponent(activeDraft?.id ?? id)}`}
                className="mt-3 flex w-full items-center justify-center rounded-2xl bg-[#FF6B4A] px-6 py-3.5 text-base font-bold text-white shadow-lg shadow-orange-500/30 transition hover:brightness-105 active:scale-95"
              >
                Ir a pago y activar mi plan →
              </Link>
            </div>
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
        )}

        {/* Paso 3 · PDF (disponible para todos; gratis sale con marca de agua) */}
        {section === "pdf" && (
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
        )}

        {section === "posventa" && (
          <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3">
            <p className="text-sm font-semibold text-emerald-900">Paso 5 · Termina tu contrato</p>
            <p className="mt-0.5 text-xs text-slate-700">¡Contrato firmado! Ahora completa lo que falta (documentos, condiciones de pago y alertas), paso a paso. Después podrás administrar tu arriendo (acta, inventario y más).</p>
          </div>
        )}
      </section>
      )}
      {saveMessage && <p className="mt-3 text-sm text-emerald-700">{saveMessage}</p>}
      {pdfFeedback && (
        <p className="mt-2 text-sm text-violet-800" role="status">
          {pdfFeedback}
        </p>
      )}
      {contractStatus && <p className="text-xs text-slate-600">Estado contractual: {contractStatus}</p>}

      {section === "firma" && signatureRoundMessage && (
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
      {section === "firma" && signatureRows.length > 0 && (
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
                    <td className="px-2 py-1">{formatAppDateTime(s.sentAt)}</td>
                    <td className="px-2 py-1">{formatAppDateTime(s.signedAt)}</td>
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
      {section === "pdf" && pdfInfo && (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-white/95 shadow-[0_6px_20px_rgba(86,70,229,0.06)] p-3 text-xs text-slate-700">
          <p>PDF generado: {new Date(pdfInfo.pdfGeneratedAt).toLocaleString("es-CO")}</p>
          <p>Versión: {pdfInfo.versionNumber}</p>
          <p>Hash: {pdfInfo.documentHash}</p>
        </div>
      )}
      {section === "firma" && hasAllSigned && (
        <section className="mt-4 rounded-2xl border border-emerald-500 bg-emerald-50 p-4 text-sm text-emerald-700">
          <p className="font-semibold">Contrato firmado</p>
          <div className="mt-2 flex flex-wrap gap-2">
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
          {/* Evidencia como BLOQUE (no ítem de flex) para que la tabla ancha
              tenga scroll horizontal propio y no desborde la tarjeta. */}
          {evidenceAnnex?.htmlContent && (
            <details className="mt-2 rounded border border-emerald-500 bg-white/60 px-3 py-2 text-xs">
              <summary className="cursor-pointer font-medium">Ver evidencia de firma</summary>
              <div className="mt-2 max-h-64 w-full overflow-auto rounded bg-white p-3 text-slate-900 [&_table]:w-max [&_table]:text-[11px]">
                <div dangerouslySetInnerHTML={{ __html: evidenceAnnex.htmlContent }} />
              </div>
            </details>
          )}
        </section>
      )}
      {section === "posventa" && savedVersion && (
        <details className="group mt-4 rounded-2xl border border-slate-200 bg-white/95 shadow-[0_6px_20px_rgba(86,70,229,0.06)] p-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900">📎 Anexos del contrato</h3>
            <span className="text-xs font-normal text-slate-500 group-open:hidden">Ver ▾</span>
          </summary>
          <p className="mt-1 text-xs text-slate-500">Se generan a medida que avanzas en la posventa (inventario, acta, evidencia de firma, pagos…).</p>
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
        </details>
      )}

      {/* CTA FINAL — Paso 4 (Posventa) del cierre paso a paso. */}
      {section === "posventa" && savedVersion && (
        <section className="mt-4 rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50/90 to-white p-5 shadow-[0_8px_28px_rgba(139,92,246,0.14)]">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Y para terminar</p>
          {plusActive || demoActive ? (
            <>
              <h3 className="mt-1 text-base font-bold text-slate-900">Termina tu contrato, paso a paso</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                Con tu contrato guardado, completa lo que falta —<strong>documentos, condiciones de pago y alertas</strong>—
                una cosa a la vez. Después administras tu arriendo (acta, inventario y más).
              </p>
              <Link
                href={`/nuevo/gestionar/${id}/terminar`}
                className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-[#5646E5] px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition hover:brightness-105 active:scale-95"
              >
                Termina tu contrato →
              </Link>
            </>
          ) : (
            <>
              <h3 className="mt-1 text-base font-bold text-slate-900">
                Tu contrato está listo. ¿Quieres el respaldo completo del arriendo?
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                Con el <strong>plan de introducción</strong> ($49.900, firma incluida) tienes también todo el
                acompañamiento <strong>durante el arriendo</strong>:
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

      {/* Navegación global del sub-flujo bento: una sección a la vez. */}
      <div className="mt-6 flex items-center justify-between gap-2">
        {section !== "revisar" ? (
          <button type="button" onClick={goPrev} className="rounded-2xl border-2 border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-600 transition hover:border-[#5646E5] hover:text-[#5646E5] active:scale-95">← Atrás</button>
        ) : (
          <span />
        )}
        {section !== "posventa" ? (
          <button type="button" onClick={goNext} disabled={!canGoSection(sectionOrder[Math.min(sectionOrder.indexOf(section) + 1, sectionOrder.length - 1)])} className="rounded-2xl bg-[#FF6B4A] px-7 py-3 text-sm font-bold text-white shadow-lg shadow-orange-500/25 transition hover:brightness-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50">
            Continuar →
          </button>
        ) : (
          <Link href={`/nuevo/gestionar/${id}/terminar`} className="rounded-2xl bg-[#12B886] px-7 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition hover:brightness-105 active:scale-95">Termina tu contrato →</Link>
        )}
      </div>
    </WizardShell>
  );
}

