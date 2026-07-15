"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
import { createContractDraft, updateDraft, getDraft, type ContractDraft } from "@/features/contracts/wizard-state";
import { flushDraftToServer, pullServerDraftsIntoLocal } from "@/features/contracts/draft-server-sync";
import { getAuthClient } from "@/lib/firebase/client";
import { CONSENT_CURRENT_VERSION } from "@/domain/consents/consentVersions";
import { JourneyScene } from "@/components/nuevo/journey-scene";
import { buildWhatsAppUrl } from "@/lib/nuevo/whatsapp";
import { validateStep, type Answers } from "@/lib/nuevo/validation";
import { pesosEnLetras } from "@/lib/nuevo/pesos-en-letras";
import { captureOathEvidence } from "@/lib/nuevo/oath-evidence";
import { OathEvidenceToast } from "@/components/nuevo/oath-evidence-toast";
import { useVoice } from "@/lib/nuevo/useVoice";
import { MicButton } from "@/components/nuevo/mic-button";
import { ExpressRegister } from "@/components/nuevo/express-register";
import { PartyInvitePanel } from "@/components/contracts/party-invite-panel";
import { CodebtorViaTenantPanel } from "@/components/contracts/codebtor-via-tenant-panel";
import { InviteSupportsOwnerList } from "@/components/contracts/invite-supports-owner-list";
import { AdditionalCodebtorsManager } from "@/components/contracts/additional-codebtors-manager";
import { PropertyDocUpload } from "@/components/contracts/property-doc-upload";
import { IncomeSuggestion } from "@/components/contracts/income-suggestion";
import { UtilityGuaranteeSection } from "@/components/contracts/utility-guarantee-section";
import { LegalComplianceSeal } from "@/components/contracts/legal-semaphore";
import { evaluateLegalCompliance, type ComplianceInput } from "@/domain/contracts/legalCompliance";
import { requiredDocCatalogForRole } from "@/domain/party-invite/requiredDocs";
import { OwnerPartyDocSlots } from "@/components/contracts/owner-party-doc-slots";
import { OwnerIncomeReminder } from "@/components/contracts/owner-income-reminder";
import type { PartyDraft } from "@/features/contracts/draft-types";

/**
 * F1+F2 del rediseño "Un paso a la vez" (rama rediseno-frontend-v2).
 * Home bento animado + motor de una pregunta a la vez, cableado al wizard-state
 * real (mismo borrador que el flujo actual). Bloques: dueño → inmueble →
 * inquilino → codeudor. Al terminar entrega la continuación (documentos, firma,
 * juramentos) al asistente actual. Los juramentos NO van aquí: van al firmar,
 * por persona.
 */

const THEMES: [string, string][] = [
  ["#5646E5", "#9B6BFF"], ["#FF6B4A", "#FFB03A"], ["#0FB5AE", "#3FD98A"],
  ["#FF5CA8", "#8B5CF6"], ["#3A7BFF", "#37D0E8"], ["#7C3AED", "#EC4899"],
];
const GREETINGS = ["¿Qué quieres hacer hoy?", "¿Empezamos?", "¿En qué te ayudo hoy?", "¿Listo para formalizar?"];
const SUBPHRASES = [
  "Formalizar un arriendo toma menos de lo que crees.",
  "Un contrato bien hecho evita dolores de cabeza.",
  "Sin filas, sin papeleo, sin intermediarios.",
  "Tú pones los datos; la ley la ponemos nosotros.",
];

type Kind = "ctype" | "text" | "doc" | "contact" | "acting" | "addr" | "registry" | "reqdocs" | "canon" | "lease" | "tenant" | "tenantfull" | "codebtor" | "codebtorfull" | "credit" | "utils" | "clauses" | "docs";

// Catálogo de cláusulas especiales (mismos ids que el dominio) + "Otra".
const CLAUSE_CATALOG: { id: string; title: string }[] = [
  { id: "MASCOTAS", title: "🐾 Mascotas" },
  { id: "FUMADORES", title: "🚭 No fumar" },
  { id: "PARQUEADERO", title: "🚗 Parqueadero" },
  { id: "TELETRABAJO", title: "💻 Teletrabajo" },
  { id: "MOBILIARIO", title: "🛋️ Amoblado" },
  { id: "ZONAS_VERDES", title: "🌿 Zonas verdes" },
  { id: "SEGURIDAD", title: "🔒 Seguridad" },
];

const DOC_TYPES = ["CC", "CE", "NIT", "Pasaporte"];
type Q = { id: string; block: string; prompt: string; hint: string; kind: Kind; ph?: string; basic: boolean; skipWhen?: (a: Answers) => boolean };

// Tramo básico (0-50%): tipo + dueño 4 + inmueble 3 + inquilino 1 = 9.
// Tramo adicional (50-100%): datos del inquilino/codeudor, términos, servicios, cláusulas, documentos.
const QUESTIONS: Q[] = [
  { id: "ctype", block: "¿Qué vas a crear?", prompt: "¿Qué contrato vamos a crear?", hint: "Hoy generamos arrendamiento de vivienda urbana (Ley 820).", kind: "ctype", basic: true },
  { id: "name", block: "Datos del dueño", prompt: "¿Cómo se llama el arrendador?", hint: "Quien entrega el inmueble en arriendo.", kind: "text", ph: "Nombre completo", basic: true },
  { id: "doc", block: "Datos del dueño", prompt: "Su documento", hint: "Tipo y número.", kind: "doc", basic: true },
  { id: "contact", block: "Datos del dueño", prompt: "¿Cómo lo contactamos?", hint: "Celular, correo y ciudad — para notificaciones y firma.", kind: "contact", basic: true },
  { id: "acting", block: "Datos del dueño", prompt: "¿Eres el dueño o su apoderado?", hint: "Si actúas como apoderado, luego subes el poder.", kind: "acting", basic: true },
  { id: "addr", block: "Datos del inmueble", prompt: "¿Dónde queda el inmueble?", hint: "Dirección, ciudad y departamento que irán en el contrato.", kind: "addr", basic: true },
  { id: "registry", block: "Datos del inmueble", prompt: "Tipo del inmueble y soporte de propiedad", hint: "Elige el tipo y sube un documento que soporte la propiedad (tradición, servicios o predial).", kind: "registry", basic: true },
  { id: "canon", block: "Datos del inmueble", prompt: "¿Cuál es el canon mensual?", hint: "Validamos el tope legal (Ley 820).", kind: "canon", ph: "$ 1.500.000", basic: true },
  { id: "reqdocs", block: "Documentos requeridos", prompt: "¿Qué documentos exigirás?", hint: "Elige los documentos que deberá aportar el inquilino y (si aplica) el codeudor. Aparecerán como casillas para subir, ya sea que los cargues tú o cada persona por su enlace.", kind: "reqdocs", basic: false },
  { id: "tenant", block: "Datos del inquilino", prompt: "¿Quién ingresa los datos del arrendatario?", hint: "Elige primero: los ingresas tú, o le envías un enlace para que los complete él mismo.", kind: "tenant", basic: true },
  { id: "tenantfull", block: "Datos del inquilino", prompt: "Datos del arrendatario", hint: "Documento, ciudad y contacto — o el enlace de invitación.", kind: "tenantfull", basic: false },
  { id: "lease", block: "Términos del arriendo", prompt: "¿Cuándo y cómo se paga?", hint: "Inicio, duración y día de pago del canon.", kind: "lease", basic: false },
  { id: "codebtor", block: "¿Codeudor?", prompt: "¿Tendrá codeudor solidario?", hint: "Opcional. Si sí, eliges quién ingresa sus datos.", kind: "codebtor", basic: false },
  { id: "codebtorfull", block: "Codeudor solidario", prompt: "Datos del codeudor", hint: "Documento, ciudad y contacto — o el enlace de invitación.", kind: "codebtorfull", basic: false, skipWhen: (a) => a.hasCodebtor !== "yes" },
  { id: "credit", block: "Verificación (opcional)", prompt: "¿Quieres verificar el historial?", hint: "Herramientas externas para evaluar al inquilino y codeudor. Es opcional.", kind: "credit", basic: false },
  { id: "utils", block: "Servicios y cláusulas", prompt: "¿Quién paga los servicios públicos?", hint: "Agua, luz, gas e internet del inmueble.", kind: "utils", basic: false },
  { id: "clauses", block: "Servicios y cláusulas", prompt: "¿Añades cláusulas especiales?", hint: "Opcional. Toca las que apliquen; puedes seguir sin ninguna.", kind: "clauses", basic: false },
  // El paso separado de "documentos" se eliminó: los documentos se piden dentro
  // del MISMO enlace del inquilino/codeudor (llenan datos y suben documentos), y
  // el dueño los ve en la vista previa. Así no se pide dos veces.
];

/** ¿Este paso se salta según las respuestas? (p. ej. datos del inquilino si es por invitación). */
function isSkipped(q: Q, a: Answers): boolean {
  return Boolean(q.skipWhen?.(a));
}
function nextActiveIndex(from: number, a: Answers): number {
  for (let k = from + 1; k < QUESTIONS.length; k++) if (!isSkipped(QUESTIONS[k], a)) return k;
  return QUESTIONS.length; // no hay más → Revisión
}
function prevActiveIndex(from: number, a: Answers): number {
  for (let k = from - 1; k >= 0; k--) if (!isSkipped(QUESTIONS[k], a)) return k;
  return -1; // inicio
}

const EMPTY: Answers = {
  contractType: "VIVIENDA_URBANA",
  name: "", docType: "CC", docNumber: "", phone: "", email: "", ownerCity: "",
  acting: "", proxyOath: false, poderdanteName: "",
  address: "", city: "", department: "",
  registry: "", propertyType: "", registrySkip: false, propertyDocType: "", propertyOath: false,
  canon: "", commercialValue: "", noCommercialValue: false,
  reqDocsTenant: [], reqDocsCodebtor: [],
  startDate: "", termMonths: "12", paymentDay: "5",
  tenantMode: "self", tenantName: "",
  tenantDocType: "CC", tenantDocNumber: "", tenantCity: "", tenantEmail: "", tenantPhone: "", tenantAuth: false, tenantIncome: "",
  hasCodebtor: "", codebtorName: "", codebtorMode: "self",
  codebtorDocType: "CC", codebtorDocNumber: "", codebtorCity: "", codebtorEmail: "", codebtorPhone: "", codebtorAuth: false, codebtorIncome: "",
  utilitiesParty: "", adminParty: "", clauses: [], clauseOther: "",
  docMethod: "", docPhone: "", docEmail: "",
};

const BASIC_TOTAL = QUESTIONS.filter((q) => q.basic).length;

const GOOGLE_RESUME_KEY = "nuevo_google_resume";
const RESUME_PREFIX = "nuevo_resume_";
/** Id del borrador que el usuario tiene abierto ahora mismo en el recorrido.
 * Sirve para que, si RECARGA la página (o hace pull-to-refresh), vuelva justo
 * donde estaba en vez de irse al inicio. Se limpia al finalizar. */
const ACTIVE_KEY = "nuevo_active_draft";

/** Guarda un snapshot de las respuestas del recorrido para poder RETOMAR el
 * mismo borrador paso a paso (desde "Mis contratos" → Continuar), en vez de
 * saltar a la vista final llena de faltantes. */
function saveResume(id: string | null, answers: Answers, step: number): void {
  if (!id || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RESUME_PREFIX + id, JSON.stringify({ answers, step }));
  } catch {
    /* almacenamiento lleno/no disponible: no rompemos el flujo */
  }
}

function loadResume(id: string): { answers: Answers; step: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(RESUME_PREFIX + id);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { answers?: Partial<Answers>; step?: number };
    if (!parsed?.answers) return null;
    return { answers: { ...EMPTY, ...parsed.answers }, step: typeof parsed.step === "number" ? parsed.step : 0 };
  } catch {
    return null;
  }
}

/** Primer paso ACTIVO (no saltado) que aún está incompleto. Si todo está
 * completo devuelve QUESTIONS.length (→ ir a revisión). */
function firstIncompleteIndex(answers: Answers): number {
  for (let k = 0; k < QUESTIONS.length; k++) {
    const q = QUESTIONS[k];
    if (isSkipped(q, answers)) continue;
    if (validateStep(q.kind, answers)) return k;
  }
  return QUESTIONS.length;
}

/** Reconstruye las respuestas desde un borrador guardado (respaldo cuando no hay
 * snapshot local, p. ej. borrador creado en otro dispositivo). Espeja el mapeo
 * de `persist`. */
function answersFromDraft(d: ContractDraft): Answers {
  const num = (v: unknown) => (typeof v === "number" && v > 0 ? String(v) : "");
  return {
    ...EMPTY,
    contractType: d.contractType || EMPTY.contractType,
    name: d.landlord?.fullName || "",
    docType: d.landlord?.documentType || EMPTY.docType,
    docNumber: d.landlord?.documentNumber || "",
    phone: d.landlord?.phone || "",
    email: d.landlord?.email || "",
    ownerCity: d.landlord?.city || "",
    acting: d.actingAs || "",
    proxyOath: Boolean(d.proxyDeclarationAcceptedAt),
    poderdanteName: d.grantorFullName || "",
    address: d.property?.address || "",
    city: d.property?.city || "",
    department: d.property?.department || "",
    registry: d.property?.registryNumber || "",
    propertyType: d.property?.type || "",
    propertyDocType: ((d.property as { propertyDocType?: string } | undefined)?.propertyDocType as Answers["propertyDocType"]) || "",
    propertyOath: Boolean((d.property as { authorityOathAcceptedAt?: string } | undefined)?.authorityOathAcceptedAt),
    canon: num(d.lease?.monthlyRent ?? d.property?.monthlyRentProposed),
    commercialValue: num(d.property?.commercialValue),
    noCommercialValue: Boolean(d.property?.commercialValueUnknown),
    reqDocsTenant: Array.isArray(d.requiredDocsTenant) ? d.requiredDocsTenant : [],
    reqDocsCodebtor: Array.isArray(d.requiredDocsCodebtor) ? d.requiredDocsCodebtor : [],
    startDate: d.lease?.startDate || "",
    termMonths: d.lease?.termMonths ? String(d.lease.termMonths) : EMPTY.termMonths,
    paymentDay: d.lease?.paymentDueDay ? String(d.lease.paymentDueDay) : EMPTY.paymentDay,
    tenantName: d.tenant?.fullName || "",
    tenantDocType: d.tenant?.documentType || EMPTY.tenantDocType,
    tenantDocNumber: d.tenant?.documentNumber || "",
    tenantCity: d.tenant?.city || "",
    tenantEmail: d.tenant?.email || "",
    tenantPhone: d.tenant?.phone || "",
    hasCodebtor: d.hasSolidaryCoDebtor ? "yes" : "no",
    codebtorName: d.solidaryCoDebtor?.fullName || "",
    codebtorDocType: d.solidaryCoDebtor?.documentType || EMPTY.codebtorDocType,
    codebtorDocNumber: d.solidaryCoDebtor?.documentNumber || "",
    codebtorCity: d.solidaryCoDebtor?.city || "",
    codebtorEmail: d.solidaryCoDebtor?.email || "",
    codebtorPhone: d.solidaryCoDebtor?.phone || "",
    utilitiesParty: (d.utilities?.responsibleParty as Answers["utilitiesParty"]) || "",
    clauses: d.specialClauses?.selected ? [...d.specialClauses.selected] : [],
    clauseOther: d.specialClauses?.freeText || "",
  };
}

export default function NuevoPage() {
  const { user, signInWithGoogleRedirect, consumeGoogleRedirect } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"home" | "flow" | "review" | "done">("home");
  const [reviewOath, setReviewOath] = useState(false); // juramento del inmueble
  const [themes, setThemes] = useState<[[string, string], [string, string]]>([THEMES[0], THEMES[1]]);
  const [greeting, setGreeting] = useState(GREETINGS[0]);
  const [subIdx, setSubIdx] = useState(0);

  const [draftId, setDraftId] = useState<string | null>(null);
  const [i, setI] = useState(0);
  const [a, setARaw] = useState<Answers>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  // F7 — registro exprés al 50%: cuando alguien sin sesión termina lo básico,
  // pedimos crear cuenta + consentimiento antes de seguir con lo adicional.
  const [gate, setGate] = useState<"register" | null>(null);
  const userRef = useRef(user); userRef.current = user;

  // Al editar cualquier campo, limpiamos el error visible.
  function setA(n: Answers) { setARaw(n); if (error) setError(null); }

  useEffect(() => {
    const x = Math.floor(Math.random() * THEMES.length);
    let y = x;
    while (y === x) y = Math.floor(Math.random() * THEMES.length);
    setThemes([THEMES[x], THEMES[y]]);
    setGreeting(GREETINGS[Math.floor(Math.random() * GREETINGS.length)]);
    setSubIdx(Math.floor(Math.random() * SUBPHRASES.length));
  }, []);
  useEffect(() => {
    if (mode !== "home") return;
    const t = setInterval(() => setSubIdx((s) => (s + 1) % SUBPHRASES.length), 3800);
    return () => clearInterval(t);
  }, [mode]);

  const pct = useMemo(() => {
    const db = QUESTIONS.slice(0, i).filter((q) => q.basic).length;
    // El tramo adicional cuenta solo los pasos ACTIVOS (no saltados) para que la
    // barra sea coherente cuando se omiten pasos condicionales (p. ej. inquilino
    // por invitación o sin codeudor).
    const extraActive = QUESTIONS.filter((q) => !q.basic && !isSkipped(q, a));
    const de = QUESTIONS.slice(0, i).filter((q) => !q.basic && !isSkipped(q, a)).length;
    return Math.round((db / BASIC_TOTAL) * 50 + (extraActive.length ? de / extraActive.length : 1) * 50);
  }, [i, a]);

  // --- Modo voz / accesibilidad ---
  const { canSpeak, canListen, listening, speak, listen, stop, requestMic } = useVoice();
  const [voiceMode, setVoiceMode] = useState(false);
  const aRef = useRef(a); aRef.current = a;
  const iRef = useRef(i); iRef.current = i;
  const modeRef = useRef(mode); modeRef.current = mode;
  const gateRef = useRef(gate); gateRef.current = gate;
  const voiceModeRef = useRef(voiceMode); voiceModeRef.current = voiceMode;
  const draftIdRef = useRef<string | null>(null);
  const onTranscriptRef = useRef<(t: string) => void>(() => {});

  function start() {
    const draft = createContractDraft({ userId: user?.uid ?? "invitado", accessStatus: "free", isDemo: false });
    setDraftId(draft.id);
    draftIdRef.current = draft.id;
    setARaw(EMPTY);
    setError(null);
    setReviewOath(false);
    setGate(null);
    setI(0);
    setMode("flow");
  }

  const persist = useCallback((n: Answers) => {
    const draftId = draftIdRef.current;
    if (!draftId) return;
    const canonNum = Number(n.canon.replace(/[^\d]/g, "")) || 0;
    const cvNum = Number(n.commercialValue.replace(/[^\d]/g, "")) || 0;
    const tenantIncomeNum = Number((n.tenantIncome || "").replace(/[^\d]/g, "")) || 0;
    const codebtorIncomeNum = Number((n.codebtorIncome || "").replace(/[^\d]/g, "")) || 0;
    const months = Number(n.termMonths) || 0;
    // Fecha de fin = inicio + duración en meses (el contrato exige endDate).
    let endDate = "";
    if (n.startDate && months > 0) {
      const d0 = new Date(`${n.startDate}T00:00:00`);
      if (!Number.isNaN(d0.getTime())) {
        d0.setMonth(d0.getMonth() + months);
        endDate = d0.toISOString().slice(0, 10);
      }
    }
    // Detalle de servicios y administración (el contrato los exige): se derivan
    // del responsable elegido para no pedir texto libre.
    const utilsLabel = n.utilitiesParty === "arrendatario" ? "el arrendatario" : n.utilitiesParty === "arrendador" ? "el arrendador" : "las partes según lo acordado";
    const adminLabel = n.adminParty === "arrendatario" ? "el arrendatario" : n.adminParty === "arrendador" ? "el arrendador" : "";
    updateDraft(draftId, (d) => ({
      ...d,
      contractType: (n.contractType || d.contractType) as typeof d.contractType,
      actingAs: n.acting === "owner" || n.acting === "proxy" ? n.acting : d.actingAs,
      grantorFullName: n.acting === "proxy" ? (n.poderdanteName.trim() || d.grantorFullName) : n.acting === "owner" ? undefined : d.grantorFullName,
      proxyDeclarationAcceptedAt:
        n.acting === "proxy" && n.proxyOath
          ? (d.proxyDeclarationAcceptedAt ?? new Date().toISOString())
          : n.acting === "owner" ? undefined : d.proxyDeclarationAcceptedAt,
      hasSolidaryCoDebtor: n.hasCodebtor === "yes" ? true : n.hasCodebtor === "no" ? false : d.hasSolidaryCoDebtor,
      requiredDocsTenant: n.reqDocsTenant,
      requiredDocsCodebtor: n.reqDocsCodebtor,
      ...(tenantIncomeNum > 0 ? { tenantMonthlyIncome: tenantIncomeNum } : {}),
      landlord: {
        ...d.landlord,
        fullName: n.name.trim() || d.landlord.fullName,
        documentType: n.docType || d.landlord.documentType,
        documentNumber: n.docNumber.trim() || d.landlord.documentNumber,
        phone: n.phone.trim() || d.landlord.phone,
        email: n.email.trim() || d.landlord.email,
        city: n.ownerCity.trim() || d.landlord.city,
      },
      property: {
        ...d.property,
        address: n.address.trim() || d.property.address,
        city: n.city.trim() || d.property.city,
        department: n.department.trim() || d.property.department,
        type: n.propertyType || d.property.type,
        registryNumber: n.registry.trim() || d.property.registryNumber,
        ...(canonNum > 0 ? { monthlyRentProposed: canonNum } : {}),
        ...(cvNum > 0 ? { commercialValue: cvNum, legalRentCap: Math.round(cvNum * 0.01) } : {}),
        commercialValueUnknown: n.noCommercialValue,
        noCapAcknowledgement: n.noCommercialValue,
        // Tipo de documento que soporta la propiedad (reemplazo de la matrícula).
        ...(n.propertyDocType ? ({ propertyDocType: n.propertyDocType } as { propertyDocType: string }) : {}),
        // Juramento de facultad/responsabilidad del dueño (fecha de aceptación como
        // sello; la evidencia con IP/dispositivo queda en `oath_evidence`).
        ...(n.propertyOath
          ? ({ authorityOathAcceptedAt: (d.property as { authorityOathAcceptedAt?: string }).authorityOathAcceptedAt ?? new Date().toISOString() } as { authorityOathAcceptedAt: string })
          : {}),
      },
      lease: {
        ...d.lease,
        ...(canonNum > 0 ? { monthlyRent: canonNum, monthlyRentText: pesosEnLetras(canonNum) } : {}),
        ...(n.startDate ? { startDate: n.startDate } : {}),
        ...(endDate ? { endDate } : {}),
        ...(months > 0 ? { termMonths: months } : {}),
        ...(Number(n.paymentDay) >= 1 ? { paymentDueDay: Number(n.paymentDay) } : {}),
      },
      tenant: {
        ...d.tenant,
        // En invitación, el propio inquilino da su nombre real al completar; no lo
        // pisamos con el nombre tentativo que puso el dueño.
        fullName: n.tenantMode === "invite" ? (d.tenant.fullName || n.tenantName.trim()) : (n.tenantName.trim() || d.tenant.fullName),
        ...(n.tenantMode === "self"
          ? {
              documentType: n.tenantDocType || d.tenant.documentType,
              documentNumber: n.tenantDocNumber.trim() || d.tenant.documentNumber,
              city: n.tenantCity.trim() || d.tenant.city,
              email: n.tenantEmail.trim() || d.tenant.email,
              phone: n.tenantPhone.trim() || d.tenant.phone,
            }
          : {
              // Por invitación: el contacto del invitado sale del canal elegido.
              phone: (n.docMethod === "whatsapp" ? n.docPhone.trim() : "") || d.tenant.phone,
              email: (n.docMethod === "email" ? n.docEmail.trim() : "") || d.tenant.email,
            }),
      },
      solidaryCoDebtor: n.hasCodebtor === "yes"
        ? {
            ...d.solidaryCoDebtor,
            fullName: n.codebtorMode !== "self" ? (d.solidaryCoDebtor.fullName || n.codebtorName.trim()) : (n.codebtorName.trim() || d.solidaryCoDebtor.fullName),
            // Por invitación o gestión del inquilino, los datos vienen importados;
            // aquí solo escribimos si el dueño los ingresó (self).
            ...(n.codebtorMode === "self" ? {
              documentType: n.codebtorDocType || d.solidaryCoDebtor.documentType,
              documentNumber: n.codebtorDocNumber.trim() || d.solidaryCoDebtor.documentNumber,
              city: n.codebtorCity.trim() || d.solidaryCoDebtor.city,
              email: n.codebtorEmail.trim() || d.solidaryCoDebtor.email,
              phone: n.codebtorPhone.trim() || d.solidaryCoDebtor.phone,
              ...(codebtorIncomeNum > 0 ? { economicSupport: { ...d.solidaryCoDebtor.economicSupport, monthlyIncome: codebtorIncomeNum } } : {}),
            } : {}),
          }
        : d.solidaryCoDebtor,
      utilities: {
        ...d.utilities,
        responsibleParty: n.utilitiesParty || d.utilities.responsibleParty,
        ...(n.utilitiesParty ? { details: `Los servicios públicos los paga ${utilsLabel}.` } : {}),
        ...(n.adminParty ? { adminFeesDetails: n.adminParty === "no_aplica" ? "El inmueble no tiene cuota de administración." : `La administración y expensas las paga ${adminLabel}.` } : {}),
      },
      specialClauses: n.clauses.length > 0
        ? {
            enabled: true,
            selected: n.clauses,
            freeText: n.clauses.includes("OTRA") ? n.clauseOther.trim() || undefined : undefined,
            costNotified: n.clauses.includes("OTRA"),
          }
        : { enabled: false, selected: [], freeText: undefined, costNotified: false },
    }));
  }, []);

  const relisten = useCallback(() => {
    if (voiceModeRef.current && canListen) listen((t) => onTranscriptRef.current(t));
  }, [listen, canListen]);

  // Cuando el invitado (inquilino/codeudor) completa sus datos por su enlace y el
  // dueño los importa, se escriben en el borrador con su attestation/evidencia.
  const onImportParty = useCallback((role: "tenant" | "solidaryCoDebtor", party: PartyDraft) => {
    const id = draftIdRef.current;
    if (!id) return;
    const updated = updateDraft(id, (d) => role === "tenant"
      ? { ...d, tenant: { ...d.tenant, ...party } }
      : { ...d, hasSolidaryCoDebtor: true, solidaryCoDebtor: { ...d.solidaryCoDebtor, ...party } });
    if (updated) void flushDraftToServer(updated);
  }, []);

  const next = useCallback(() => {
    const cq = QUESTIONS[iRef.current];
    const e = validateStep(cq.kind, aRef.current);
    if (e) { setError(e); if (voiceModeRef.current) speak(e, relisten); return; } // no avanza con datos inválidos/en blanco
    setError(null);
    persist(aRef.current);
    // Guarda un snapshot para poder RETOMAR este borrador paso a paso luego.
    saveResume(draftIdRef.current, aRef.current, iRef.current);
    // Al terminar lo básico (50%), si no hay sesión, exigimos crear cuenta.
    if (iRef.current === BASIC_TOTAL - 1 && !userRef.current) { setGate("register"); return; }
    const ni = nextActiveIndex(iRef.current, aRef.current);
    if (ni >= QUESTIONS.length) { setMode("review"); return; }
    setI(ni);
  }, [persist, speak, relisten]);

  // Confirmación final: registra el juramento del inmueble (con su fecha para la
  // evidencia) y guarda en la cuenta AHORA (sin esperar el debounce) antes de cerrar.
  const confirmReview = useCallback(() => {
    const id = draftIdRef.current;
    if (id) {
      const updated = updateDraft(id, (d) => ({
        ...d,
        property: { ...d.property, propertyOwnershipOath: true, propertyOwnershipOathAt: new Date().toISOString() },
      }));
      if (updated) void flushDraftToServer(updated);
    }
    // Terminó: soltamos el puntero activo (una recarga ya no reingresa aquí).
    try { window.localStorage.removeItem(ACTIVE_KEY); } catch { /* noop */ }
    setMode("done");
  }, []);

  // Tras crear cuenta / iniciar sesión en el registro exprés: re-asocia el
  // borrador al usuario real, lo GUARDA en el servidor de inmediato (para que
  // no dependa del debounce y no se pierdan los datos ya diligenciados) y trae
  // lo que hubiera del servidor. Luego continúa con el tramo adicional.
  const onRegistered = useCallback((uid: string) => {
    const id = draftIdRef.current;
    if (id) {
      const updated = updateDraft(id, (d) => ({ ...d, userId: uid }));
      if (updated) void flushDraftToServer(updated).then(() => void pullServerDraftsIntoLocal());
    }
    setGate(null);
    setI(nextActiveIndex(BASIC_TOTAL - 1, aRef.current)); // primer paso adicional activo
  }, []);

  // Google en móvil por REDIRECT: guardamos el avance (borrador + respuestas)
  // antes de navegar a Google, para restaurarlo intacto al volver.
  const startGoogleRedirect = useCallback(async () => {
    try {
      sessionStorage.setItem(GOOGLE_RESUME_KEY, JSON.stringify({ draftId: draftIdRef.current, answers: aRef.current }));
      await signInWithGoogleRedirect();
    } catch {
      sessionStorage.removeItem(GOOGLE_RESUME_KEY);
      throw new Error("google-redirect-failed");
    }
  }, [signInWithGoogleRedirect]);

  // Al montar: si volvemos de Google (redirect), rehidratamos el recorrido y
  // continuamos exactamente donde estábamos, con la sesión ya activa.
  useEffect(() => {
    const raw = typeof window !== "undefined" ? sessionStorage.getItem(GOOGLE_RESUME_KEY) : null;
    if (!raw) return;
    (async () => {
      const uid = await consumeGoogleRedirect();
      sessionStorage.removeItem(GOOGLE_RESUME_KEY);
      if (!uid) return; // redirect no completado / falló → se queda en inicio
      let saved: { draftId: string | null; answers: Answers } | null = null;
      try { saved = JSON.parse(raw); } catch { saved = null; }
      if (!saved?.draftId) return;
      setDraftId(saved.draftId);
      draftIdRef.current = saved.draftId;
      setARaw(saved.answers);
      // Consentimiento Habeas Data (aceptado antes de irse a Google).
      try {
        const cu = getAuthClient().currentUser;
        if (cu) await fetch("/api/consents/register", {
          method: "POST",
          headers: { "content-type": "application/json", ...(await buildAuthHeaders(cu)) },
          body: JSON.stringify({ version: CONSENT_CURRENT_VERSION, surface: "REGISTRATION" }),
        });
      } catch { /* el wizard lo reintenta */ }
      const updated = updateDraft(saved.draftId, (d) => ({ ...d, userId: uid }));
      if (updated) void flushDraftToServer(updated).then(() => void pullServerDraftsIntoLocal());
      setGate(null);
      setMode("flow");
      setI(nextActiveIndex(BASIC_TOTAL - 1, saved.answers));
    })();
  }, [consumeGoogleRedirect]);

  // Restaura un borrador en el recorrido. Con snapshot usa el paso EXACTO donde
  // quedó (para "Continuar" y para recargas); sin snapshot reconstruye desde el
  // borrador y salta al primer dato incompleto.
  const restoreDraft = useCallback((id: string): boolean => {
    const draft = getDraft(id);
    if (!draft) return false; // el borrador ya no existe localmente
    const snap = loadResume(id);
    const answers = snap?.answers ?? answersFromDraft(draft);
    setDraftId(id);
    draftIdRef.current = id;
    setARaw(answers);
    const step = snap && typeof snap.step === "number" ? snap.step : firstIncompleteIndex(answers);
    if (step >= QUESTIONS.length) { setI(Math.max(0, QUESTIONS.length - 1)); setMode("review"); }
    else { setI(Math.max(0, step)); setMode("flow"); }
    try { window.localStorage.setItem(ACTIVE_KEY, id); } catch { /* noop */ }
    return true;
  }, []);

  // Persistencia ENTRE EQUIPOS: al montar, si hay sesión, traemos del servidor los
  // borradores del usuario a localStorage. Así un borrador creado en el computador
  // se puede continuar en el celular (y viceversa). Sin esto, la restauración por
  // ?id= o "borrador activo" solo veía lo local del equipo.
  const [serverSynced, setServerSynced] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (userRef.current) { try { await pullServerDraftsIntoLocal(); } catch { /* seguimos con lo local */ } }
      if (!cancelled) setServerSynced(true);
    })();
    return () => { cancelled = true; };
  }, [user]);

  // Al montar (tras sincronizar con el servidor): (1) si venimos con ?id=... (desde
  // "Mis contratos" → Continuar), retomamos ese borrador; (2) si NO hay ?id= pero
  // había un borrador activo (recarga), lo restauramos donde estaba.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!serverSynced) return; // esperamos el pull del servidor primero
    if (sessionStorage.getItem(GOOGLE_RESUME_KEY)) return; // Google tiene prioridad
    const id = new URLSearchParams(window.location.search).get("id");
    if (id) { restoreDraft(id); return; }
    const active = window.localStorage.getItem(ACTIVE_KEY);
    if (active) restoreDraft(active);
  }, [restoreDraft, serverSynced]);

  // Mientras el usuario avanza (o edita), guardamos snapshot + puntero activo en
  // CADA cambio, para que una recarga lo devuelva al paso exacto.
  useEffect(() => {
    if (mode !== "flow" && mode !== "review") return;
    if (!draftId) return;
    saveResume(draftId, a, mode === "review" ? QUESTIONS.length : i);
    try { window.localStorage.setItem(ACTIVE_KEY, draftId); } catch { /* noop */ }
  }, [mode, a, i, draftId]);

  const back = useCallback(() => {
    setError(null);
    const pi = prevActiveIndex(iRef.current, aRef.current);
    if (pi < 0) {
      // Salió al inicio a propósito: soltamos el puntero activo para que una
      // recarga se quede en el inicio (no lo reingrese al recorrido).
      try { window.localStorage.removeItem(ACTIVE_KEY); } catch { /* noop */ }
      setMode("home");
      return;
    }
    setI(pi);
  }, []);

  // Botón/gesto "atrás" del celular: retrocede UN paso del recorrido en vez de
  // salir de la app (el flujo es una sola URL, así que sin esto el atrás nativo
  // te sacaba al inicio y perdías el avance). Cada pantalla del recorrido empuja
  // un estado en el historial; al tocar atrás lo "consumimos" como paso atrás.
  useEffect(() => {
    if (mode === "flow" || mode === "review") {
      window.history.pushState({ asNuevoStep: true }, "");
    }
  }, [mode, i, gate]);

  useEffect(() => {
    const onPop = () => {
      // Estamos en el recorrido → interceptamos el atrás nativo.
      if (modeRef.current === "review") { setMode("flow"); setI(prevActiveIndex(QUESTIONS.length, aRef.current)); return; }
      if (modeRef.current === "flow") {
        if (gateRef.current === "register") { setGate(null); return; }
        back(); // un paso atrás (o a inicio si es el primero)
        return;
      }
      // en "home"/"done": dejamos que el atrás navegue normalmente (no re-empujamos)
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [back]);

  // Rellena por voz según el tipo de paso.
  const fillByVoice = useCallback((kind: string, s: string, raw: string) => {
    const digits = raw.replace(/\D/g, "");
    setError(null);
    setARaw((p) => {
      switch (kind) {
        case "ctype": return { ...p, contractType: "VIVIENDA_URBANA" };
        case "acting":
          if (/due[ñn]o|propietario|dueno/.test(s)) return { ...p, acting: "owner", proxyOath: false };
          if (/apoderado|poder|represent/.test(s)) return { ...p, acting: "proxy", proxyOath: true };
          return p;
        case "registry": {
          if (/no la tengo|no tengo|saltar|sin matr|despu[eé]s/.test(s)) return { ...p, registrySkip: true, registry: "" };
          if (/apartamento|apto/.test(s)) return { ...p, propertyType: "Apartamento" };
          if (/casa/.test(s)) return { ...p, propertyType: "Casa" };
          if (/habitaci/.test(s)) return { ...p, propertyType: "Habitación" };
          if (/local/.test(s)) return { ...p, propertyType: "Local" };
          if (/oficina/.test(s)) return { ...p, propertyType: "Oficina" };
          if (raw.trim()) return { ...p, registry: raw.trim() };
          return p;
        }
        case "text": return { ...p, name: raw };
        case "doc":
          if (/c[eé]dula|\bc c\b|\bcc\b/.test(s)) return { ...p, docType: "CC" };
          if (/extranjer[ií]a|\bce\b/.test(s)) return { ...p, docType: "CE" };
          if (/\bnit\b/.test(s)) return { ...p, docType: "NIT" };
          if (/pasaporte/.test(s)) return { ...p, docType: "Pasaporte" };
          return { ...p, docNumber: digits || p.docNumber };
        case "contact": return digits.length >= 7 ? { ...p, phone: digits } : p;
        case "addr": return { ...p, address: raw };
        case "canon": return { ...p, canon: digits || p.canon };
        case "tenant": return { ...p, tenantName: raw };
        case "codebtor":
          if (/\bno\b|sin codeudor/.test(s)) return { ...p, hasCodebtor: "no" };
          if (/\bs[ií]\b|con codeudor/.test(s)) return { ...p, hasCodebtor: "yes" };
          return p;
        case "utils":
          if (/inquilino|arrendatario/.test(s)) return { ...p, utilitiesParty: "arrendatario" };
          if (/due[ñn]o|arrendador/.test(s)) return { ...p, utilitiesParty: "arrendador" };
          if (/reparte|comparti|mixto|ambos/.test(s)) return { ...p, utilitiesParty: "compartido" };
          return p;
        case "clauses":
          return p; // selección por toque; opcional
        case "docs":
          if (/whatsapp|wasap/.test(s)) return { ...p, docMethod: "whatsapp" };
          if (/correo|email|mail/.test(s)) return { ...p, docMethod: "email" };
          if (/yo|subo|mismo/.test(s)) return { ...p, docMethod: "self" };
          if (digits.length >= 7) return { ...p, docPhone: digits };
          return p;
        default: return p;
      }
    });
  }, []);

  const speakStep = useCallback(() => {
    const cq = QUESTIONS[iRef.current];
    let text = `${cq.prompt}. ${cq.hint}`;
    if (cq.kind === "ctype") text += " Es vivienda urbana. Di: continuar.";
    if (cq.kind === "doc") text += " Di el tipo: cédula, extranjería, nit o pasaporte, y luego el número.";
    if (cq.kind === "acting") text += " Di: soy dueño, o soy apoderado.";
    if (cq.kind === "registry") text += " Di el tipo de inmueble y la matrícula; o di: no la tengo, para seguir sin ella.";
    if (cq.kind === "codebtor") text += " Responde sí o no.";
    if (cq.kind === "utils") text += " Di: los paga el inquilino, el dueño, o se reparten.";
    if (cq.kind === "clauses") text += " Es opcional. Toca las que apliquen, o di: continuar.";
    if (cq.kind === "docs") text += " Di: yo, whatsapp, o correo.";
    text += canListen ? " Cuando termines, di: continuar. Para volver, di: atrás." : " Escribe tu respuesta y toca Continuar.";
    speak(text, relisten);
  }, [speak, relisten, canListen]);

  const onTranscript = useCallback((t: string) => {
    const s = t.toLowerCase().trim();
    if (/\b(continuar|contin[uú]a|siguiente|adelante|listo)\b/.test(s)) { next(); return; }
    if (/\b(atr[aá]s|anterior|volver|regresar)\b/.test(s)) { back(); return; }
    if (/\b(repetir|repite|rep[ií]telo|otra vez)\b/.test(s)) { speakStep(); return; }
    fillByVoice(QUESTIONS[iRef.current].kind, s, t);
    speak("Anotado. Di continuar cuando termines, o corrige.", relisten);
  }, [next, back, speakStep, fillByVoice, speak, relisten]);
  onTranscriptRef.current = onTranscript;

  // Al entrar a un paso en modo voz, lee la pregunta y escucha.
  useEffect(() => {
    if (!voiceMode || mode !== "flow" || !canSpeak) return;
    speakStep();
    return () => stop();
  }, [voiceMode, mode, i, canSpeak, speakStep, stop]);

  // Al terminar, lo anuncia por voz.
  useEffect(() => {
    if (voiceMode && mode === "done" && canSpeak) {
      speak("Lo básico está listo. Continúa con documentos y firma en el asistente.");
    }
  }, [voiceMode, mode, canSpeak, speak]);

  async function toggleVoice() {
    const nv = !voiceMode;
    // Pide el permiso de micrófono DENTRO del gesto del clic (si el navegador
    // escucha), para que salga el diálogo y luego el reconocimiento funcione.
    if (nv && canListen) await requestMic();
    setVoiceMode(nv);
    if (!nv) { stop(); return; }
    if (mode === "home") {
      speak(canListen
        ? "Modo voz activado. Elige: crear un contrato, o gestionar mis contratos."
        : "Modo lectura activado. Leeré cada pregunta en voz alta; escribe tu respuesta con el teclado.");
    }
  }

  // --- Asistente IA (opcional) ---
  const [aiOpen, setAiOpen] = useState(false);
  const [aiText, setAiText] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [askText, setAskText] = useState("");
  const [askAns, setAskAns] = useState<string | null>(null);
  const [askBusy, setAskBusy] = useState(false);
  // Precio vigente de la cláusula «Otra» (administrable desde /admin). Se muestra
  // en el aviso de costo adicional del paso de cláusulas.
  const [clausePriceCop, setClausePriceCop] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/contracts/special-clause");
        const j = (await res.json()) as { success?: boolean; priceCop?: number };
        if (!cancelled && res.ok && j.success && typeof j.priceCop === "number") setClausePriceCop(j.priceCop);
      } catch { /* si falla, mostramos el aviso sin cifra */ }
    })();
    return () => { cancelled = true; };
  }, []);

  async function callAssist(mode: "extract" | "ask", text: string) {
    const res = await fetch("/api/nuevo/assist", {
      method: "POST",
      headers: { "content-type": "application/json", ...(user ? await buildAuthHeaders(user) : {}) },
      body: JSON.stringify({ mode, text }),
    });
    return (await res.json()) as { success?: boolean; available?: boolean; data?: Record<string, unknown>; answer?: string; error?: string; detail?: string };
  }

  async function prefillFromAI() {
    const t = aiText.trim();
    if (t.length < 10) { setAiNote("Cuéntame un poco más (mínimo 10 caracteres)."); return; }
    setAiBusy(true); setAiNote(null);
    try {
      const j = await callAssist("extract", t);
      if (j.available === false) { setAiNote("El asistente IA aún no está configurado (falta la API key)."); return; }
      if (!j.success || !j.data) {
        setAiNote(j.detail || j.error ? `Falló la IA (${j.error ?? "error"}): ${j.detail ?? ""}` : "No pude leer los datos; intenta reformular con nombres y valores claros.");
        return;
      }
      const d = j.data;
      const dt = String(d.docType ?? "").toUpperCase();
      const docType = dt === "CE" ? "CE" : dt === "NIT" ? "NIT" : dt.startsWith("PAS") ? "Pasaporte" : "CC";
      const has = String(d.hasCodebtor ?? "");
      const prefilled: Answers = {
        ...EMPTY,
        name: String(d.name ?? ""), docType, docNumber: String(d.docNumber ?? ""),
        phone: String(d.phone ?? "").replace(/\D/g, ""), email: String(d.email ?? ""),
        address: String(d.address ?? ""), city: String(d.city ?? ""), canon: String(d.canon ?? "").replace(/[^\d]/g, ""),
        tenantName: String(d.tenantName ?? ""), hasCodebtor: has === "yes" ? "yes" : has === "no" ? "no" : "",
        codebtorName: String(d.codebtorName ?? ""),
      };
      const draft = createContractDraft({ userId: user?.uid ?? "invitado", accessStatus: "free", isDemo: false });
      setDraftId(draft.id); draftIdRef.current = draft.id;
      setARaw(prefilled); setError(null); setI(0); setAiOpen(false); setMode("flow");
    } catch {
      setAiNote("Error de red al consultar el asistente.");
    } finally {
      setAiBusy(false);
    }
  }

  async function askAI() {
    const t = askText.trim();
    if (!t) return;
    setAskBusy(true); setAskAns(null);
    try {
      const j = await callAssist("ask", t);
      if (j.available === false) { setAskAns("El asistente IA aún no está configurado (falta la API key)."); return; }
      const ans = j.answer || "No tengo una respuesta ahora.";
      setAskAns(ans);
      if (voiceModeRef.current) speak(ans);
    } catch {
      setAskAns("Error de red.");
    } finally {
      setAskBusy(false);
    }
  }

  // --- Envío del enlace de documentos al inquilino (token real por contrato) ---
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);
  const [inviteWaUrl, setInviteWaUrl] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  async function sendInvite(method: "whatsapp" | "email") {
    const draftId = draftIdRef.current;
    if (!draftId) { setInviteStatus("Primero empieza el contrato."); return; }
    setInviteBusy(true); setInviteStatus(null); setInviteWaUrl(null); setInviteLink(null);
    try {
      const res = await fetch("/api/nuevo/invite", {
        method: "POST",
        headers: { "content-type": "application/json", ...(user ? await buildAuthHeaders(user) : {}) },
        // Solo enviamos el canal correspondiente: mandar email:"" en modo
        // WhatsApp hacía que el validador (.email()) devolviera "Invalid Email".
        body: JSON.stringify({
          contractDraftId: draftId,
          method,
          phone: method === "whatsapp" ? aRef.current.docPhone : undefined,
          email: method === "email" ? aRef.current.docEmail : undefined,
          name: aRef.current.tenantName || undefined,
          monthlyRent: Number((aRef.current.canon || "").replace(/[^\d]/g, "")) || undefined,
        }),
      });
      if (res.status === 401) { setInviteStatus("Inicia sesión para enviar el enlace al inquilino."); return; }
      const j = (await res.json()) as { success?: boolean; invitationUrl?: string; emailStatus?: string; errors?: { message?: string }[] };
      if (!j.success || !j.invitationUrl) { setInviteStatus(j.errors?.[0]?.message ?? "No se pudo generar el enlace."); return; }
      setInviteLink(j.invitationUrl);
      if (method === "whatsapp") {
        // NO abrimos ventana automática: tras el await el navegador móvil la
        // bloquea (pierde el gesto). Mostramos un enlace tocable que sí abre
        // WhatsApp con el mensaje listo (el usuario solo pulsa Enviar).
        setInviteWaUrl(buildWhatsAppUrl(aRef.current.docPhone, `Hola 👋 Te comparto el enlace para completar tus datos y subir tus documentos del contrato de arriendo en ArriendoSeguro: ${j.invitationUrl}`));
        setInviteStatus("Enlace listo. Toca “Abrir WhatsApp” y pulsa Enviar.");
      } else {
        setInviteStatus(j.emailStatus === "sent" ? "Correo con el enlace enviado ✓" : "Enlace generado (correo en modo prueba).");
      }
    } catch {
      setInviteStatus("Error de red al generar el enlace.");
    } finally {
      setInviteBusy(false);
    }
  }

  const q = QUESTIONS[i];

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#F5F3EF] text-[#17151F]">
      <OathEvidenceToast />
      <div className="pointer-events-none absolute -right-20 -top-28 h-80 w-80 rounded-full opacity-50 blur-3xl" style={{ background: "radial-gradient(circle,#9B6BFF,#5646E5)" }} />
      <div className="pointer-events-none absolute -bottom-28 -left-24 h-72 w-72 rounded-full opacity-50 blur-3xl" style={{ background: "radial-gradient(circle,#FFB03A,#FF6B4A)" }} />

      <div className="relative z-10 mx-auto max-w-3xl px-6 py-8">
        <div className="mb-9 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <Link href="/" className="flex min-w-0 items-center gap-2 font-bold tracking-tight">
            <span className="h-7 w-7 flex-none rounded-[9px] bg-gradient-to-br from-[#5646E5] to-[#8B6BFF] shadow-lg shadow-violet-500/40" />
            <span className="truncate">ArriendoSeguro</span>
          </Link>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {canSpeak && (
              <button type="button" onClick={() => void toggleVoice()} aria-pressed={voiceMode}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${voiceMode ? "bg-[#5646E5] text-white" : "border border-slate-200 bg-white/70 text-slate-600 hover:border-[#5646E5]"}`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" /><path d="M19 10a7 7 0 0 1-14 0M12 17v4" /></svg>
                {voiceMode ? (canListen ? (listening ? "Escuchando…" : "Voz activa") : "Leyendo") : (canListen ? "Modo voz" : "Modo lectura")}
              </button>
            )}
            <span className="rounded-full border border-slate-200 bg-white/70 px-3 py-1.5 text-xs text-slate-500">Vista nueva (beta)</span>
          </div>
        </div>

        {/* Anuncio para lectores de pantalla (pregunta actual y errores). */}
        <div className="sr-only" role="status" aria-live="polite">
          {mode === "flow" ? `${q.block}. ${q.prompt}. ${q.hint}` : ""}{error ? `. Error: ${error}` : ""}
        </div>

        {/* Sin mode="wait": si la animación de SALIDA de una sección se cuelga
            (renderizadores lentos/pestañas en segundo plano), el siguiente bloque
            debe montar igual. Antes, el flujo no aparecía al tocar "Empezar". */}
        <AnimatePresence>
          {mode === "home" && (
            <motion.section key="home" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#5646E5]">Hola 👋</p>
              <h1 className="mt-3 text-balance text-4xl font-extrabold leading-none tracking-tight sm:text-5xl">{greeting}</h1>
              <p className="mt-3 h-7 text-lg text-slate-500">{SUBPHRASES[subIdx]}</p>
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <BentoCard theme={themes[0]} title="Crear un contrato" sub="Te guío una pregunta a la vez. Sin formularios eternos." cta="Empezar" onClick={start} icon={<path d="M8 3h6l4 4v14H6V5M14 3v4h4M9 13h6M9 17h4" />} />
                <BentoCard theme={themes[1]} title="Gestionar mis contratos" sub="Firmas, pagos, inventario y alertas de los que ya creaste." cta="Ver mis contratos" onClick={() => router.push("/nuevo/contratos")} icon={<path d="M3 7h6l2 2h10v11H3zM3 7V5h5l2 2" />} />
                <div className="col-span-full flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white/70 p-3 text-sm text-slate-500 backdrop-blur">
                  🔒 <b className="text-[#17151F]">Tranquilo:</b> puedes pausar y seguir después; tus datos quedan guardados.
                </div>
                <div className="col-span-full">
                  {!aiOpen ? (
                    <button type="button" onClick={() => setAiOpen(true)} className="w-full rounded-2xl border-2 border-dashed border-violet-300 py-3 text-sm font-semibold text-violet-700 transition hover:bg-violet-50">
                      ✨ Pre-llenar con IA — cuéntame tu caso y lleno los datos
                    </button>
                  ) : (
                    <div className="rounded-2xl border border-violet-200 bg-white/85 p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-800">Cuéntame tu caso en tus palabras</p>
                        <MicButton label="Dictar tu caso" onResult={(t) => setAiText((prev) => (prev ? `${prev} ${t}` : t))} />
                      </div>
                      <p className="mt-1 flex items-start gap-1.5 rounded-xl bg-[#ECE9FB]/60 px-3 py-2 text-[12px] text-[#5646E5]">
                        <span aria-hidden="true">🎙️</span>
                        <span>Si lo <b>dictas por voz</b>, hazlo <b>por partes</b> (una frase corta a la vez): el micrófono entiende mejor. Ve completando el texto y toca <b>“Analizar”</b> solo cuando termines todo.</span>
                      </p>
                      <textarea value={aiText} onChange={(e) => setAiText(e.target.value)} rows={6}
                        placeholder={"Ej.: Soy Juan Pérez, cédula 79000000, celular 3001112233, correo juan@correo.com, de Bogotá.\nArriendo mi apartamento en la Calle 1 # 2-3, Bogotá, Cundinamarca, matrícula 050-123456, por $1.500.000 al mes, desde el 1 de agosto por 12 meses, pago el día 5.\nEl arrendatario es María López, cédula 52000000, celular 3004445566, correo maria@correo.com.\nEl codeudor es Pedro Gómez, cédula 80000000, celular 3007778899, correo pedro@correo.com.\nLos servicios públicos los paga el inquilino."}
                        className="mt-2 w-full rounded-xl border-2 border-slate-200 p-3 text-sm outline-none transition focus:border-violet-500" />
                      {aiNote && <p className="mt-1 text-xs text-rose-600">{aiNote}</p>}
                      <div className="mt-2 flex items-center gap-2">
                        <button type="button" onClick={() => void prefillFromAI()} disabled={aiBusy} className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white transition hover:brightness-105 disabled:opacity-50">
                          {aiBusy ? "Analizando…" : "Analizar y llenar"}
                        </button>
                        <button type="button" onClick={() => setAiOpen(false)} className="px-3 py-2.5 text-sm text-slate-500">Cancelar</button>
                      </div>
                      <p className="mt-2 text-[11px] text-slate-400">Revisas cada dato antes de continuar; la validación por paso sigue activa.</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.section>
          )}

          {mode === "flow" && gate === "register" && (
            <motion.section key="gate" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
              <ProgressBar pct={50} />
              <p className="mt-4 text-center text-sm font-semibold text-[#5646E5]">¡Lo básico está listo! 🎉</p>
              <div className="mt-4">
                <ExpressRegister defaultEmail={a.email} onAuthenticated={onRegistered} onGoogleRedirect={startGoogleRedirect} />
              </div>
              <div className="mt-4 text-center">
                <button onClick={() => setGate(null)} className="text-sm font-bold text-slate-500 hover:text-[#17151F]">← Volver a revisar lo básico</button>
              </div>
            </motion.section>
          )}

          {mode === "flow" && gate !== "register" && (
            <motion.section key="flow" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
              <ProgressBar pct={pct} />
              <span className="inline-flex items-center gap-2 rounded-full bg-[#5646E5] px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white">{q.block}</span>

              <div className="relative mt-4 min-h-[240px]">
                {/* Sin mode="wait" ni animación de salida: al cambiar de pregunta
                    el paso nuevo entra de inmediato (la salida no puede colgar el
                    avance en equipos lentos / pestañas en segundo plano). */}
                <AnimatePresence initial={false}>
                  <motion.div key={q.id} initial={{ opacity: 0, x: 28 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
                    <h2 className="text-balance text-3xl font-extrabold tracking-tight">{q.prompt}</h2>
                    <p className="mt-1.5 mb-5 text-slate-500">{q.hint}</p>
                    <Field q={q} a={a} setA={setA} clausePriceCop={clausePriceCop} docs={{ send: sendInvite, status: inviteStatus, busy: inviteBusy, waUrl: inviteWaUrl, link: inviteLink }} party={{ draftId: draftId ?? "", inviterName: a.name.trim() || user?.email || "El arrendador", onImport: onImportParty }} />
                    {error && (
                      <p className="mt-3 flex items-center gap-1.5 rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16.5v.01" /></svg>
                        {error}
                      </p>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="mt-6 flex items-center gap-3">
                <button onClick={next} className="rounded-2xl bg-[#FF6B4A] px-7 py-4 text-base font-bold text-white shadow-lg shadow-orange-500/30 transition hover:brightness-105 active:scale-95">
                  {i >= QUESTIONS.length - 1 ? "Finalizar →" : i === BASIC_TOTAL - 1 ? "Terminar lo básico →" : "Continuar"}
                </button>
                <button onClick={back} className="rounded-2xl border-2 border-slate-200 bg-white px-5 py-4 text-base font-bold text-slate-600 transition hover:border-[#5646E5] hover:text-[#5646E5] active:scale-95">← Atrás</button>
              </div>

              <JourneyScene pct={pct} stepIndex={i} />

              {/* Termómetro de cumplimiento: se llena a medida que se incluye cada punto. */}
              <LawThermometer a={a} draft={draftId ? getDraft(draftId) : null} />

              <div className="mt-5 rounded-2xl border border-slate-200 bg-white/70 p-3">
                <div className="flex items-center gap-2">
                  <span className="text-violet-600">✨</span>
                  <input value={askText} onChange={(e) => setAskText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") void askAI(); }}
                    placeholder="¿Dudas de este paso? Pregúntame…"
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" />
                  <MicButton label="Dictar tu pregunta" onResult={(t) => setAskText((prev) => (prev ? `${prev} ${t}` : t))} />
                  <button type="button" onClick={() => void askAI()} disabled={askBusy || !askText.trim()} className="rounded-lg bg-violet-100 px-3 py-1.5 text-xs font-semibold text-violet-700 disabled:opacity-50">
                    {askBusy ? "…" : "Preguntar"}
                  </button>
                </div>
                {askAns && <p className="mt-2 border-t border-slate-100 pt-2 text-sm text-slate-700">{askAns}</p>}
              </div>
            </motion.section>
          )}

          {mode === "review" && (
            <motion.section key="review" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
              <ProgressBar pct={100} />
              <h2 className="text-3xl font-extrabold tracking-tight">Revisa antes de continuar</h2>
              <p className="mt-1.5 text-slate-500">Confirma lo esencial. Puedes volver a cualquier paso para corregir.</p>

              <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
                <ReviewItem label="Contrato" value="Vivienda urbana (Ley 820)" />
                <ReviewItem label="Arrendador" value={`${a.name || "—"} · ${a.docType} ${a.docNumber || ""}`.trim()} />
                <ReviewItem label="Calidad" value={a.acting === "proxy" ? "Apoderado" : a.acting === "owner" ? "Dueño" : "—"} />
                <ReviewItem label="Inmueble" value={`${a.propertyType || "—"} · ${a.address || "—"}${a.city ? ", " + a.city : ""}`} />
                <ReviewItem label="Soporte de propiedad" value={`${a.propertyDocType === "tradicion" ? "Certificado de tradición" : a.propertyDocType === "servicios" ? "Servicios públicos" : a.propertyDocType === "predial" ? "Impuesto predial" : a.propertyDocType === "escritura" ? "Escritura pública" : a.propertyDocType === "otro" ? "Otro documento" : "—"}${a.propertyOath ? " · declaración de facultad aceptada ✓" : ""}`} />
                <ReviewItem label="Canon" value={a.canon ? `$ ${Number(a.canon.replace(/[^\d]/g, "")).toLocaleString("es-CO")}` : "—"} />
                <ReviewItem label="Arrendatario" value={a.tenantName ? `${a.tenantName}${a.tenantMode === "invite" ? " (completa por invitación)" : ""}` : "—"} />
                <ReviewItem label="Términos" value={a.startDate ? `Desde ${a.startDate} · ${a.termMonths} meses · pago día ${a.paymentDay}` : "—"} />
                <ReviewItem label="Codeudor" value={a.hasCodebtor === "yes" ? `${a.codebtorName || "Sí"}${a.codebtorMode === "invite" ? " (completa por invitación)" : a.codebtorMode === "tenant" ? " (lo gestiona el inquilino)" : ""}` : "No"} />
                <ReviewItem label="Servicios públicos" value={a.utilitiesParty === "arrendatario" ? "Los paga el inquilino" : a.utilitiesParty === "arrendador" ? "Los paga el dueño" : a.utilitiesParty === "compartido" ? "Se reparten" : "—"} />
                <ReviewItem label="Administración" value={a.adminParty === "arrendatario" ? "La paga el inquilino" : a.adminParty === "arrendador" ? "La paga el dueño" : a.adminParty === "no_aplica" ? "No aplica" : "—"} />
                <ReviewItem label="Cláusulas especiales" value={a.clauses.length ? `${a.clauses.length} seleccionada(s)${a.clauses.includes("OTRA") ? " · incluye Otra" : ""}` : "Ninguna"} />
                <ReviewItem label="Documentos requeridos" value={`Inquilino: ${a.reqDocsTenant.length || "—"}${a.hasCodebtor === "yes" ? ` · Codeudor: ${a.reqDocsCodebtor.length || "—"}` : ""}`} />
              </div>

              {(() => {
                const extra = draftId ? (getDraft(draftId)?.solidaryCoDebtors ?? []) : [];
                return extra.length > 0 ? (
                  <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Codeudores adicionales ({extra.length})</p>
                    <ul className="mt-1 space-y-0.5">
                      {extra.map((c, i) => (
                        <li key={`${c.documentNumber}-${i}`} className="text-[14px] font-medium text-slate-800">
                          Codeudor {i + 2}: {c.fullName || "—"}{c.documentNumber ? ` · ${c.documentType} ${c.documentNumber}` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null;
              })()}

              {(() => {
                const d = draftId ? getDraft(draftId) : null;
                const canonN = Number((a.canon || "").replace(/[^\d]/g, "")) || 0;
                const tInc = (Number(a.tenantIncome.replace(/[^\d]/g, "")) || 0) || (d?.tenantMonthlyIncome ?? 0);
                const cInc = a.hasCodebtor === "yes" ? ((Number(a.codebtorIncome.replace(/[^\d]/g, "")) || 0) || (d?.solidaryCoDebtor?.economicSupport?.monthlyIncome ?? 0)) : 0;
                const rows = [{ who: "Inquilino", income: tInc }, ...(a.hasCodebtor === "yes" ? [{ who: "Codeudor", income: cInc }] : [])];
                return (
                  <div className="mt-5">
                    <OwnerIncomeReminder rentReference={canonN} rows={rows} />
                  </div>
                );
              })()}

              <div className="mt-5">
                <LegalComplianceSeal checks={evaluateLegalCompliance(complianceFromAnswers(a, draftId ? getDraft(draftId) : null))} />
              </div>

              {a.tenantMode === "invite" && (
                <p className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">✉️ El arrendatario completará sus datos por invitación; el contrato se podrá generar cuando los envíe.</p>
              )}

              {a.acting === "proxy" && (
                <p className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">📎 Recuerda: como apoderado deberás <b>subir el poder</b> para la firma.</p>
              )}

              {/* Juramento del inmueble (obligatorio) */}
              <label className="mt-5 flex cursor-pointer items-start gap-2.5 rounded-2xl border-2 border-slate-200 bg-white p-4 text-sm text-slate-700">
                <input type="checkbox" checked={reviewOath} onChange={(e) => { const v = e.target.checked; if (v && !reviewOath) void captureOathEvidence("property_ownership_oath", draftId ?? undefined); setReviewOath(v); }} className="mt-0.5 h-5 w-5 flex-none accent-[#5646E5]" />
                <span>Declaro <b>bajo la gravedad de juramento</b> que los datos del inmueble son correctos y que soy el propietario o cuento con poder vigente para arrendarlo.
                  <span className="mt-1 block text-[11px] font-normal text-slate-400">🔒 Al aceptar, queda registrada la evidencia (fecha, IP y dispositivo) como soporte del expediente.</span>
                </span>
              </label>

              <div className="mt-6 flex items-center gap-3">
                <button
                  onClick={confirmReview}
                  disabled={!reviewOath}
                  className="rounded-2xl bg-[#FF6B4A] px-7 py-4 text-base font-bold text-white shadow-lg shadow-orange-500/30 transition hover:brightness-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50">
                  Confirmar y continuar →
                </button>
                <button onClick={() => { setMode("flow"); setI(prevActiveIndex(QUESTIONS.length, a)); }} className="rounded-2xl border-2 border-slate-200 bg-white px-5 py-4 text-base font-bold text-slate-600 transition hover:border-[#5646E5] hover:text-[#5646E5] active:scale-95">← Atrás</button>
              </div>
            </motion.section>
          )}

          {mode === "done" && (
            <motion.section key="done" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
              <ProgressBar pct={100} />
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 12 }} className="mx-auto mt-4 grid h-20 w-20 place-items-center rounded-full bg-[#12B886] shadow-xl shadow-emerald-500/40">
                <svg width="38" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><path d="M5 13l4 4L19 7" /></svg>
              </motion.div>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight">¡Tu expediente está listo!</h2>
              <p className="mx-auto mt-2 max-w-md text-slate-500">
                Guardamos todo: tipo, dueño, inmueble, canon, inquilino, servicios y cláusulas. Ahora revisa tu contrato y fírmalo — cada parte acepta sus juramentos al firmar.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <button onClick={() => draftId && router.push(`/dashboard/contracts/${draftId}/preview`)} className="rounded-2xl bg-[#5646E5] px-7 py-4 text-base font-bold text-white shadow-lg shadow-violet-500/30 transition hover:brightness-105 active:scale-95">
                  Ver y firmar mi contrato →
                </button>
                <button onClick={() => router.push("/nuevo/contratos")} className="rounded-2xl border border-slate-300 px-5 py-4 text-base font-semibold text-slate-600">Mis contratos</button>
              </div>
              <JourneyScene pct={100} stepIndex={QUESTIONS.length} />
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

const inputCls = "w-full rounded-2xl border-2 border-slate-200 bg-white px-[18px] py-4 text-lg outline-none transition focus:border-[#5646E5] focus:ring-4 focus:ring-[#ECE9FB]";

function InputMic({ voice, className, ...props }: { voice: (t: string) => void } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex gap-2">
      <input className={`${inputCls} min-w-0 flex-1 ${className ?? ""}`} {...props} />
      <MicButton onResult={voice} />
    </div>
  );
}

const onlyDigits = (t: string) => t.replace(/\D/g, "");
const cleanEmail = (t: string) => t.replace(/\s/g, "").toLowerCase();

const PROPERTY_TYPES = ["Apartamento", "Casa", "Habitación", "Local", "Oficina", "Otro"];

function Field({ q, a, setA, clausePriceCop, docs, party }: { q: Q; a: Answers; setA: (a: Answers) => void; clausePriceCop: number | null; docs: { send: (m: "whatsapp" | "email") => void; status: string | null; busy: boolean; waUrl: string | null; link: string | null }; party: { draftId: string; inviterName: string; onImport: (role: "tenant" | "solidaryCoDebtor", p: PartyDraft) => void } }) {
  switch (q.kind) {
    case "ctype":
      return (
        <div className="flex flex-col gap-2.5">
          <button type="button" onClick={() => setA({ ...a, contractType: "VIVIENDA_URBANA" })}
            className={`flex items-center gap-3.5 rounded-2xl border-2 p-4 text-left transition ${a.contractType === "VIVIENDA_URBANA" ? "border-[#5646E5] bg-[#ECE9FB]" : "border-slate-200 bg-white hover:border-[#5646E5]"}`}>
            <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-[#ECE9FB] text-[#5646E5] text-xl">🏠</span>
            <span><b className="block text-[16px]">Arrendamiento de vivienda urbana</b><small className="text-[13.5px] text-slate-500">Casa, apartamento o habitación. Régimen de la Ley 820 de 2003.</small></span>
          </button>
          <div className="mt-1 grid grid-cols-3 gap-2">
            {[
              { icon: "🚪", label: "Habitación" },
              { icon: "🌾", label: "Rural" },
              { icon: "🏢", label: "Comercial" },
            ].map((t) => (
              <button
                key={t.label}
                type="button"
                disabled
                aria-disabled="true"
                title="Próximamente"
                className="flex cursor-not-allowed flex-col items-center gap-1 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-2.5 text-center opacity-60"
              >
                <span className="text-lg">{t.icon}</span>
                <span className="text-[12.5px] font-semibold text-slate-500">{t.label}</span>
                <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Próximamente</span>
              </button>
            ))}
          </div>
        </div>
      );
    case "acting":
      return (
        <>
          <div className="mb-3 flex flex-wrap gap-2.5">
            <button type="button" onClick={() => setA({ ...a, acting: "owner", proxyOath: false })} className={chip(a.acting === "owner")}>Soy el dueño</button>
            <button type="button" onClick={() => setA({ ...a, acting: "proxy" })} className={chip(a.acting === "proxy")}>Soy apoderado</button>
          </div>
          {a.acting === "proxy" && (
            <div className="flex flex-col gap-2.5">
              <div>
                <p className="mb-1.5 text-sm font-medium text-slate-600">Nombre completo del propietario que te da el poder</p>
                <InputMic autoFocus autoComplete="name" placeholder="Nombre del dueño (poderdante)" value={a.poderdanteName} onChange={(e) => setA({ ...a, poderdanteName: e.target.value })} voice={(t) => setA({ ...a, poderdanteName: t })} />
                <p className="mt-1 text-xs text-slate-500">Usamos este nombre para cotejar el documento de propiedad. El poder lo subirás para la firma.</p>
              </div>
              <label className="flex cursor-pointer items-start gap-2.5 rounded-2xl border-2 border-amber-200 bg-amber-50/60 p-4 text-sm text-slate-700">
                <input type="checkbox" checked={a.proxyOath} onChange={(e) => { const v = e.target.checked; if (v && !a.proxyOath) void captureOathEvidence("proxy_declaration", party.draftId); setA({ ...a, proxyOath: v }); }} className="mt-0.5 h-5 w-5 flex-none accent-[#5646E5]" />
                <span>Declaro que cuento con <b>poder vigente y facultad</b> para arrendar este inmueble a nombre de <b>{a.poderdanteName.trim() || "el propietario"}</b>. Sé que deberé subir el poder para la firma.</span>
              </label>
            </div>
          )}
        </>
      );
    case "registry":
      return (
        <div className="flex flex-col gap-3">
          <div>
            <p className="mb-2 text-sm font-medium text-slate-600">Tipo de inmueble</p>
            <div className="flex flex-wrap gap-2.5">
              {PROPERTY_TYPES.map((t) => (
                <button key={t} type="button" onClick={() => setA({ ...a, propertyType: t })} className={chip(a.propertyType === t)}>{t}</button>
              ))}
            </div>
          </div>
          <PropertyDocUpload contractDraftId={party.draftId} docType={a.propertyDocType} onDocType={(v) => setA({ ...a, propertyDocType: v })} expectedName={a.acting === "proxy" ? a.poderdanteName : a.name} actingAs={a.acting} />
          <p className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-500">💡 Puedes subir el documento <b>ahora o más tarde</b> (antes de generar el contrato). Si lo saltas, quedará como <b>pendiente</b> y no podrás generar el contrato hasta cargarlo.</p>
          <label className="flex cursor-pointer items-start gap-2.5 rounded-2xl border-2 border-amber-200 bg-amber-50/60 p-4 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={a.propertyOath}
              onChange={(e) => { const v = e.target.checked; if (v && !a.propertyOath) void captureOathEvidence("property_authority_oath", party.draftId); setA({ ...a, propertyOath: v }); }}
              className="mt-0.5 h-5 w-5 flex-none accent-[#5646E5]"
            />
            <span>
              <b>Declaro bajo la gravedad de juramento</b> que soy el {a.acting === "proxy" ? <b>apoderado con facultades vigentes</b> : <b>propietario</b>} del inmueble
              {a.acting === "proxy" ? " y que estoy facultado para arrendarlo a nombre del propietario" : " o que estoy debidamente facultado para arrendarlo"};
              que el documento adjunto soporta dicha titularidad y que la información es <b>verídica, completa y actual</b>. Me hago
              <b> plenamente responsable</b> de su veracidad. Entiendo y acepto que ArriendoSeguro <b>no verifica ni certifica</b> la
              propiedad ni la titularidad (no es notaría, oficina de registro ni catastro), que cualquier revisión automática es
              <b> orientativa y no vinculante</b>, y <b>exonero y mantengo indemne</b> a ArriendoSeguro de toda reclamación derivada de
              la titularidad, la facultad para arrendar o la autenticidad del documento. Queda registrado con evidencia (fecha e IP).
            </span>
          </label>
        </div>
      );
    case "text":
      return <InputMic autoFocus autoComplete="name" placeholder={q.ph} value={a.name} onChange={(e) => setA({ ...a, name: e.target.value })} voice={(t) => setA({ ...a, name: t })} />;
    case "doc":
      return (
        <>
          <div className="mb-3 flex flex-wrap gap-2.5">
            {["CC", "CE", "NIT", "Pasaporte"].map((t) => (
              <button key={t} type="button" onClick={() => setA({ ...a, docType: t })} className={chip(a.docType === t)}>{t}</button>
            ))}
          </div>
          <InputMic autoFocus placeholder="Número de documento" value={a.docNumber} onChange={(e) => setA({ ...a, docNumber: e.target.value })} voice={(t) => setA({ ...a, docNumber: onlyDigits(t) || t })} />
        </>
      );
    case "contact":
      return (
        <div className="flex flex-col gap-2.5">
          <InputMic autoFocus type="tel" autoComplete="tel" placeholder="📱 Celular" value={a.phone} onChange={(e) => setA({ ...a, phone: e.target.value })} voice={(t) => setA({ ...a, phone: onlyDigits(t) })} />
          <InputMic type="email" autoComplete="email" placeholder="✉️ Correo" value={a.email} onChange={(e) => setA({ ...a, email: e.target.value })} voice={(t) => setA({ ...a, email: cleanEmail(t) })} />
          <InputMic autoComplete="address-level2" placeholder="🏙️ Ciudad del arrendador" value={a.ownerCity} onChange={(e) => setA({ ...a, ownerCity: e.target.value })} voice={(t) => setA({ ...a, ownerCity: t })} />
        </div>
      );
    case "addr":
      return (
        <div className="flex flex-col gap-2.5">
          <InputMic autoFocus autoComplete="street-address" placeholder="Calle 00 # 00-00" value={a.address} onChange={(e) => setA({ ...a, address: e.target.value })} voice={(t) => setA({ ...a, address: t })} />
          <InputMic autoComplete="address-level2" placeholder="Ciudad" value={a.city} onChange={(e) => setA({ ...a, city: e.target.value })} voice={(t) => setA({ ...a, city: t })} />
          <InputMic placeholder="Departamento (ej. Antioquia)" value={a.department} onChange={(e) => setA({ ...a, department: e.target.value })} voice={(t) => setA({ ...a, department: t })} />
        </div>
      );
    case "reqdocs": {
      const toggle = (list: string[], key: string): string[] => (list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);
      const Section = ({ role, list, onToggle, title, icon }: { role: "tenant" | "codebtor"; list: string[]; onToggle: (key: string) => void; title: string; icon: string }) => (
        <div className="rounded-2xl border-2 border-slate-200 bg-white/70 p-3">
          <p className="text-sm font-semibold text-slate-700">{icon} {title}</p>
          <p className="mt-0.5 text-xs text-slate-500">Toca los que exigirás ({list.length} seleccionado{list.length === 1 ? "" : "s"}).</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {requiredDocCatalogForRole(role).map((d) => (
              <button key={d.key} type="button" onClick={() => onToggle(d.key)}
                className={`rounded-2xl border-2 px-3 py-1.5 text-xs font-medium transition ${list.includes(d.key) ? "border-[#5646E5] bg-[#ECE9FB] text-[#5646E5]" : "border-slate-200 bg-white text-slate-700 hover:border-[#5646E5]"}`}>
                {list.includes(d.key) ? "✓ " : ""}{d.label}
              </button>
            ))}
          </div>
        </div>
      );
      return (
        <div className="flex flex-col gap-3">
          <Section role="tenant" list={a.reqDocsTenant} onToggle={(k) => setA({ ...a, reqDocsTenant: toggle(a.reqDocsTenant, k) })} title="Documentos del arrendatario" icon="🧑" />
          <Section role="codebtor" list={a.reqDocsCodebtor} onToggle={(k) => setA({ ...a, reqDocsCodebtor: toggle(a.reqDocsCodebtor, k) })} title="Documentos del codeudor (si aplica)" icon="🤝" />
          <p className="text-xs text-slate-500">Es opcional: puedes continuar sin exigir ninguno. Cada documento elegido aparecerá como una casilla nombrada para subir — la sube el dueño o cada persona por su enlace.</p>
        </div>
      );
    }
    case "canon": {
      const canonN = Number((a.canon || "").replace(/[^\d]/g, "")) || 0;
      const cvN = Number((a.commercialValue || "").replace(/[^\d]/g, "")) || 0;
      const cap = cvN > 0 ? Math.round(cvN * 0.01) : 0;
      const over = cap > 0 && canonN > cap;
      return (
        <div className="flex flex-col gap-2.5">
          <div>
            <p className="mb-1.5 text-sm font-medium text-slate-600">Canon mensual</p>
            <InputMic autoFocus inputMode="numeric" placeholder={q.ph} value={a.canon} onChange={(e) => setA({ ...a, canon: e.target.value })} voice={(t) => setA({ ...a, canon: onlyDigits(t) })} />
          </div>
          {!a.noCommercialValue && (
            <div>
              <p className="mb-1.5 text-sm font-medium text-slate-600">Valor comercial del inmueble</p>
              <InputMic inputMode="numeric" placeholder="$ 200.000.000" value={a.commercialValue} onChange={(e) => setA({ ...a, commercialValue: e.target.value })} voice={(t) => setA({ ...a, commercialValue: onlyDigits(t) })} />
              {cap > 0 && (
                <p className={`mt-1.5 text-sm font-medium ${over ? "text-rose-700" : "text-emerald-700"}`}>
                  {over ? "⚠️ " : "✓ "}Tope legal (1%, Ley 820): ${cap.toLocaleString("es-CO")} máx.{over ? " — el canon lo supera." : ""}
                </p>
              )}
            </div>
          )}
          <label className="flex cursor-pointer items-start gap-2.5 rounded-2xl border-2 border-amber-200 bg-amber-50/60 p-4 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={a.noCommercialValue}
              onChange={(e) => { const v = e.target.checked; if (v && !a.noCommercialValue) void captureOathEvidence("property_no_cap_acknowledgement", party.draftId); setA({ ...a, noCommercialValue: v }); }}
              className="mt-0.5 h-5 w-5 flex-none accent-[#5646E5]"
            />
            <span>
              No conozco el valor comercial del inmueble. <b>Declaro bajo mi responsabilidad</b> que el canon no supera el
              <b> 1% del valor comercial real</b> (Ley 820 de 2003) y asumo las consecuencias de excederlo; ArriendoSeguro
              no valida el tope en este caso. Queda registrado con evidencia (fecha e IP).
            </span>
          </label>
        </div>
      );
    }
    case "tenant":
      return (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2.5">
            <button type="button" onClick={() => setA({ ...a, tenantMode: "self" })} className={chip(a.tenantMode === "self")}>Los ingreso yo</button>
            <button type="button" onClick={() => setA({ ...a, tenantMode: "invite" })} className={chip(a.tenantMode === "invite")}>Se lo pido a él/ella</button>
          </div>
          {a.tenantMode === "self" ? (
            <>
              <InputMic autoFocus placeholder="Nombre del arrendatario" value={a.tenantName} onChange={(e) => setA({ ...a, tenantName: e.target.value })} voice={(t) => setA({ ...a, tenantName: t })} />
              <p className="text-xs text-slate-500">En el siguiente paso completas su documento y contacto.</p>
            </>
          ) : (
            <div className="rounded-2xl border border-[#5646E5]/20 bg-[#ECE9FB]/40 p-3 text-xs text-slate-600">
              <p>En el siguiente paso le envías el <b>enlace</b> (correo o WhatsApp): en el mismo enlace la persona completa sus datos <b>y sube sus documentos</b>, con su firma y evidencia.</p>
              <p className="mt-1">💡 <b>Puedes seguir avanzando</b> mientras la otra persona completa, o cerrar y <b>retomar después</b> — sus datos y documentos se importan solos en la vista previa cuando termine.</p>
            </div>
          )}
        </div>
      );
    case "tenantfull":
      return a.tenantMode === "self" ? (
        <div className="flex flex-col gap-3">
          <PartyFields
            docType={a.tenantDocType} docNumber={a.tenantDocNumber} city={a.tenantCity} email={a.tenantEmail} phone={a.tenantPhone} auth={a.tenantAuth}
            income={a.tenantIncome} onIncome={(v) => setA({ ...a, tenantIncome: v })} rentReference={Number((a.canon || "").replace(/[^\d]/g, "")) || 0} who="el inquilino"
            authLabel="Declaro que tengo autorización del arrendatario para ingresar sus datos personales (Ley 1581 de 2012)."
            onChange={(patch) => { if (patch.auth && !a.tenantAuth) void captureOathEvidence("tenant_third_party_authorization", party.draftId); setA({ ...a, tenantDocType: patch.docType, tenantDocNumber: patch.docNumber, tenantCity: patch.city, tenantEmail: patch.email, tenantPhone: patch.phone, tenantAuth: patch.auth }); }}
          />
          <OwnerPartyDocSlots contractDraftId={party.draftId} role="tenant" requiredDocs={a.reqDocsTenant} />
        </div>
      ) : (
        <PartyInvitePanel contractDraftId={party.draftId} role="tenant" roleLabel="Arrendatario (inquilino)" inviterName={party.inviterName}
          monthlyRent={Number((a.canon || "").replace(/[^\d]/g, "")) || 0}
          requiredDocs={a.reqDocsTenant} codebtorRequiredDocs={a.reqDocsCodebtor}
          onImport={(p) => party.onImport("tenant", p)} />
      );
    case "lease": {
      const canonN = Number((a.canon || "").replace(/[^\d]/g, "")) || 0;
      return (
        <div className="flex flex-col gap-2.5">
          <div>
            <p className="mb-1.5 text-sm font-medium text-slate-600">Fecha de inicio</p>
            <input type="date" value={a.startDate} onChange={(e) => setA({ ...a, startDate: e.target.value })} className={inputCls} />
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium text-slate-600">Duración</p>
            <div className="flex flex-wrap gap-2.5">
              {["6", "12", "24", "36"].map((m) => (
                <button key={m} type="button" onClick={() => setA({ ...a, termMonths: m })} className={chip(a.termMonths === m)}>{m} meses</button>
              ))}
              <input inputMode="numeric" value={["6", "12", "24", "36"].includes(a.termMonths) ? "" : a.termMonths} onChange={(e) => setA({ ...a, termMonths: onlyDigits(e.target.value) })} className={`w-28 rounded-2xl border-2 px-3 py-3 text-center text-[15px] outline-none focus:border-[#5646E5] ${!["6", "12", "24", "36"].includes(a.termMonths) && a.termMonths ? "border-[#5646E5] bg-[#ECE9FB]" : "border-slate-200"}`} placeholder="Otro (meses)" />
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium text-slate-600">Día de pago del canon (1–31)</p>
            <input inputMode="numeric" value={a.paymentDay} onChange={(e) => setA({ ...a, paymentDay: onlyDigits(e.target.value).slice(0, 2) })} className={inputCls} placeholder="Ej. 5" />
          </div>
          {canonN > 0 && <p className="text-xs text-slate-500">Canon: <b>${canonN.toLocaleString("es-CO")}</b> — {pesosEnLetras(canonN)}.</p>}
        </div>
      );
    }
    case "codebtor":
      return (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2.5">
            <button type="button" onClick={() => setA({ ...a, hasCodebtor: "yes" })} className={chip(a.hasCodebtor === "yes")}>Sí, con codeudor</button>
            <button type="button" onClick={() => setA({ ...a, hasCodebtor: "no" })} className={chip(a.hasCodebtor === "no")}>No</button>
          </div>
          {a.hasCodebtor === "yes" && (
            <>
              <p className="text-sm font-medium text-slate-600">¿Quién ingresa sus datos?</p>
              <div className="flex flex-wrap gap-2.5">
                <button type="button" onClick={() => setA({ ...a, codebtorMode: "self" })} className={chip(a.codebtorMode === "self")}>Los ingreso yo</button>
                <button type="button" onClick={() => setA({ ...a, codebtorMode: "invite" })} className={chip(a.codebtorMode === "invite")}>Se lo pido a él/ella</button>
                <button type="button" onClick={() => setA({ ...a, codebtorMode: "tenant" })} className={chip(a.codebtorMode === "tenant")}>Lo gestiona el inquilino</button>
              </div>
              <p className="text-xs text-slate-500">
                {a.codebtorMode === "self"
                  ? "En el siguiente paso ingresas su nombre, documento y contacto."
                  : a.codebtorMode === "tenant"
                  ? "El inquilino lo gestionará desde su invitación; tú solo esperas a que quede listo."
                  : "En el siguiente paso le envías el enlace: completa sus datos y sube documentos por ahí. Puedes seguir avanzando y sus datos se importan solos en la vista previa cuando termine."}
              </p>
            </>
          )}
        </div>
      );
    case "codebtorfull":
      return (
        <div className="flex flex-col gap-4">
          {a.codebtorMode === "self" ? (
            <div className="flex flex-col gap-3">
              <InputMic autoFocus placeholder="Nombre del codeudor" value={a.codebtorName} onChange={(e) => setA({ ...a, codebtorName: e.target.value })} voice={(t) => setA({ ...a, codebtorName: t })} />
              <PartyFields
                docType={a.codebtorDocType} docNumber={a.codebtorDocNumber} city={a.codebtorCity} email={a.codebtorEmail} phone={a.codebtorPhone} auth={a.codebtorAuth}
                income={a.codebtorIncome} onIncome={(v) => setA({ ...a, codebtorIncome: v })} rentReference={Number((a.canon || "").replace(/[^\d]/g, "")) || 0} who="el codeudor"
                authLabel="Declaro que tengo autorización del codeudor para ingresar sus datos personales (Ley 1581 de 2012)."
                onChange={(patch) => { if (patch.auth && !a.codebtorAuth) void captureOathEvidence("codebtor_third_party_authorization", party.draftId); setA({ ...a, codebtorDocType: patch.docType, codebtorDocNumber: patch.docNumber, codebtorCity: patch.city, codebtorEmail: patch.email, codebtorPhone: patch.phone, codebtorAuth: patch.auth }); }}
              />
              <OwnerPartyDocSlots contractDraftId={party.draftId} role="solidaryCoDebtor" requiredDocs={a.reqDocsCodebtor} />
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {a.codebtorMode === "tenant" ? (
                <CodebtorViaTenantPanel contractDraftId={party.draftId} tenantInvited={a.tenantMode === "invite"}
                  onImport={(p) => party.onImport("solidaryCoDebtor", p)} />
              ) : (
                <PartyInvitePanel contractDraftId={party.draftId} role="solidaryCoDebtor" roleLabel="Codeudor solidario" inviterName={party.inviterName}
                  monthlyRent={Number((a.canon || "").replace(/[^\d]/g, "")) || 0}
                  requiredDocs={a.reqDocsCodebtor}
                  onImport={(p) => party.onImport("solidaryCoDebtor", p)} />
              )}
              {/* El dueño ve los documentos que el codeudor subió por su enlace. */}
              <InviteSupportsOwnerList contractDraftId={party.draftId} role="solidaryCoDebtor" title="Documentos que subió el codeudor" />
            </div>
          )}
          {/* Codeudores ADICIONALES (2º, 3º…): misma lógica y presentación bento. */}
          <AdditionalCodebtorsManager contractId={party.draftId} />
        </div>
      );
    case "credit":
      return (
        <div className="flex flex-col gap-2.5">
          <a href="https://www.midatacredito.com/" target="_blank" rel="noopener noreferrer"
            className="flex items-start gap-3.5 rounded-2xl border-2 border-slate-200 bg-white p-4 text-left transition hover:border-[#5646E5]">
            <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-[#ECE9FB] text-xl">📊</span>
            <span><b className="block text-[15px]">Historial crediticio (MiDataCrédito)</b><small className="text-[13px] text-slate-500">La consulta es personal: la hace el titular (o con su autorización) y te comparte el reporte por un canal privado.</small></span>
          </a>
          <a href="https://eris.contaduria.gov.co/BDME/" target="_blank" rel="noopener noreferrer"
            className="flex items-start gap-3.5 rounded-2xl border-2 border-slate-200 bg-white p-4 text-left transition hover:border-[#5646E5]">
            <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-[#ECE9FB] text-xl">🏛️</span>
            <span><b className="block text-[15px]">Deudas con el Estado (BDME)</b><small className="text-[13px] text-slate-500">Boletín de Deudores Morosos del Estado (Contaduría). Úsalo solo para evaluar el arriendo.</small></span>
          </a>
          <p className="text-xs text-slate-500">ArriendoSeguro no ejecuta la consulta ni guarda reportes: son herramientas de terceros. Trata cualquier dato con confidencialidad (Ley 1581). Es un paso <b>opcional</b>: puedes continuar.</p>
        </div>
      );
    case "utils":
      return (
        <div className="flex flex-col gap-4">
          <div>
            <p className="mb-1.5 text-sm font-medium text-slate-600">¿Quién paga los servicios públicos? (agua, luz, gas, internet)</p>
            <div className="flex flex-wrap gap-2.5">
              <button type="button" onClick={() => setA({ ...a, utilitiesParty: "arrendatario" })} className={chip(a.utilitiesParty === "arrendatario")}>Los paga el inquilino</button>
              <button type="button" onClick={() => setA({ ...a, utilitiesParty: "arrendador" })} className={chip(a.utilitiesParty === "arrendador")}>Los paga el dueño</button>
              <button type="button" onClick={() => setA({ ...a, utilitiesParty: "compartido" })} className={chip(a.utilitiesParty === "compartido")}>Se reparten</button>
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium text-slate-600">¿Quién paga la administración? (cuota de la copropiedad)</p>
            <div className="flex flex-wrap gap-2.5">
              <button type="button" onClick={() => setA({ ...a, adminParty: "arrendatario" })} className={chip(a.adminParty === "arrendatario")}>La paga el inquilino</button>
              <button type="button" onClick={() => setA({ ...a, adminParty: "arrendador" })} className={chip(a.adminParty === "arrendador")}>La paga el dueño</button>
              <button type="button" onClick={() => setA({ ...a, adminParty: "no_aplica" })} className={chip(a.adminParty === "no_aplica")}>No aplica</button>
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium text-slate-600">Garantía de servicios públicos (opcional, Ley 820 art. 15)</p>
            <UtilityGuaranteeSection contractId={party.draftId} initial={getDraft(party.draftId)?.utilityServicesGuarantee} />
          </div>
        </div>
      );
    case "clauses": {
      const toggle = (id: string) => {
        const has = a.clauses.includes(id);
        setA({ ...a, clauses: has ? a.clauses.filter((c) => c !== id) : [...a.clauses, id] });
      };
      const otraOn = a.clauses.includes("OTRA");
      return (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2.5">
            {CLAUSE_CATALOG.map((c) => (
              <button key={c.id} type="button" onClick={() => toggle(c.id)} className={chip(a.clauses.includes(c.id))}>{c.title}</button>
            ))}
            <button type="button" onClick={() => toggle("OTRA")} className={chip(otraOn)}>✍️ Otra…</button>
          </div>
          {otraOn && (
            <div className="rounded-2xl border-2 border-amber-200 bg-amber-50/60 p-4">
              <textarea value={a.clauseOther} onChange={(e) => setA({ ...a, clauseOther: e.target.value })} rows={3}
                placeholder="Describe la cláusula acordada entre las partes…"
                className="w-full rounded-xl border-2 border-slate-200 p-3 text-sm outline-none transition focus:border-[#5646E5]" />
              <p className="mt-2 text-xs font-medium text-amber-800">
                La cláusula «Otra» (texto libre) tiene un <b>costo adicional que se suma al Plan Plus</b>
                {clausePriceCop != null ? <> de <b>${clausePriceCop.toLocaleString("es-CO")}</b></> : null}
                {" "}(la revisa un abogado). Se confirma al pagar.
              </p>
            </div>
          )}
          <p className="text-xs text-slate-500">Puedes continuar sin cláusulas especiales. Las que elijas se redactan con texto legal en el contrato.</p>
        </div>
      );
    }
    case "docs":
      return (
        <div className="flex flex-col gap-2.5">
          <DocOption sel={a.docMethod === "self"} onClick={() => setA({ ...a, docMethod: "self" })} tone="me" title="Los subo yo ahora" desc="Cargo los documentos del inquilino directamente." icon={mailIcon} />
          <DocOption sel={a.docMethod === "whatsapp"} onClick={() => setA({ ...a, docMethod: "whatsapp" })} tone="wa" title="Enviar por WhatsApp" desc="Le llega un enlace real para completar sus datos y subir documentos." icon={waIcon} />
          <DocOption sel={a.docMethod === "email"} onClick={() => setA({ ...a, docMethod: "email" })} tone="em" title="Enviar por correo" desc="El mismo enlace, por email." icon={mailIcon} />
          {a.docMethod === "whatsapp" && (
            <div className="mt-1 flex flex-col gap-2 sm:flex-row">
              <InputMic inputMode="tel" placeholder="📱 Celular del inquilino" value={a.docPhone} onChange={(e) => setA({ ...a, docPhone: e.target.value })} voice={(t) => setA({ ...a, docPhone: onlyDigits(t) })} />
              <button type="button" disabled={docs.busy || a.docPhone.replace(/\D/g, "").length < 7} onClick={() => docs.send("whatsapp")}
                className="whitespace-nowrap rounded-2xl bg-[#25D366] px-5 py-4 text-base font-bold text-white transition hover:brightness-105 active:scale-95 disabled:opacity-50">
                {docs.busy ? "Generando…" : "Enviar por WhatsApp"}
              </button>
            </div>
          )}
          {a.docMethod === "email" && (
            <div className="mt-1 flex flex-col gap-2 sm:flex-row">
              <InputMic inputMode="email" placeholder="✉️ Correo del inquilino" value={a.docEmail} onChange={(e) => setA({ ...a, docEmail: e.target.value })} voice={(t) => setA({ ...a, docEmail: cleanEmail(t) })} />
              <button type="button" disabled={docs.busy || !a.docEmail.trim()} onClick={() => docs.send("email")}
                className="whitespace-nowrap rounded-2xl bg-[#5646E5] px-5 py-4 text-base font-bold text-white transition hover:brightness-105 active:scale-95 disabled:opacity-50">
                {docs.busy ? "Enviando…" : "Enviar por correo"}
              </button>
            </div>
          )}
          {docs.status && <p className="text-sm font-medium text-emerald-700">{docs.status}</p>}
          {docs.waUrl && (
            <a href={docs.waUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-5 py-4 text-base font-bold text-white transition hover:brightness-105 active:scale-95">
              <span>Abrir WhatsApp con el enlace →</span>
            </a>
          )}
          {docs.link && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-medium text-slate-500">Enlace del inquilino (por si quieres copiarlo y enviarlo tú mismo):</p>
              <div className="mt-1 flex items-center gap-2">
                <input readOnly value={docs.link} className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700" onFocus={(e) => e.currentTarget.select()} />
                <button type="button" onClick={() => { void navigator.clipboard?.writeText(docs.link ?? ""); }} className="rounded-lg bg-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-300">Copiar</button>
              </div>
            </div>
          )}
          <p className="mt-1 text-xs text-slate-500">El enlace es único de este contrato: el inquilino completa sus datos y sube documentos. También puedes elegir “los subo yo”.</p>
          {/* El dueño ve aquí lo que el inquilino ya subió por su enlace (se actualiza solo). */}
          <InviteSupportsOwnerList contractDraftId={party.draftId} role="tenant" title="Documentos que subió el inquilino" />
        </div>
      );
  }
}

const mailIcon = <svg viewBox="0 0 24 24" width="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 5h16v14H4z" /><path d="M4 7l8 6 8-6" /></svg>;
const waIcon = <svg viewBox="0 0 24 24" width="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3a9 9 0 0 0-7.7 13.6L3 21l4.5-1.2A9 9 0 1 0 12 3z" /></svg>;

function DocOption({ sel, onClick, tone, title, desc, icon }: { sel: boolean; onClick: () => void; tone: "me" | "wa" | "em"; title: string; desc: string; icon: ReactNode }) {
  const toneCls = tone === "wa" ? "bg-[#25D36622] text-[#128C4B]" : tone === "em" ? "bg-[#ECE9FB] text-[#5646E5]" : "bg-[#FFEDE7] text-[#C7361A]";
  return (
    <button type="button" onClick={onClick} className={`flex items-center gap-3.5 rounded-2xl border-2 p-4 text-left transition ${sel ? "border-[#5646E5] bg-[#ECE9FB]" : "border-slate-200 bg-white hover:border-[#5646E5]"}`}>
      <span className={`grid h-10 w-10 flex-none place-items-center rounded-xl ${toneCls}`}>{icon}</span>
      <span><b className="block text-[16px]">{title}</b><small className="text-[13.5px] text-slate-500">{desc}</small></span>
    </button>
  );
}

function chip(sel: boolean) {
  return `rounded-2xl border-2 px-4 py-3 text-[15px] font-medium transition ${sel ? "border-[#5646E5] bg-[#ECE9FB] text-[#5646E5]" : "border-slate-200 bg-white hover:border-[#5646E5]"}`;
}

type PartyPatch = { docType: string; docNumber: string; city: string; email: string; phone: string; auth: boolean };
function PartyFields({ docType, docNumber, city, email, phone, auth, authLabel, income, onIncome, rentReference, who, onChange }: PartyPatch & { authLabel: string; income: string; onIncome: (v: string) => void; rentReference: number; who: "el inquilino" | "el codeudor"; onChange: (p: PartyPatch) => void }) {
  const base = { docType, docNumber, city, email, phone, auth };
  const incomeNum = Number((income || "").replace(/[^\d]/g, "")) || 0;
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap gap-2.5">
        {DOC_TYPES.map((t) => (
          <button key={t} type="button" onClick={() => onChange({ ...base, docType: t })} className={chip(docType === t)}>{t}</button>
        ))}
      </div>
      <InputMic placeholder="Número de documento" value={docNumber} onChange={(e) => onChange({ ...base, docNumber: e.target.value })} voice={(t) => onChange({ ...base, docNumber: onlyDigits(t) || t })} />
      <InputMic autoComplete="address-level2" placeholder="Ciudad" value={city} onChange={(e) => onChange({ ...base, city: e.target.value })} voice={(t) => onChange({ ...base, city: t })} />
      <InputMic type="email" autoComplete="email" placeholder="✉️ Correo" value={email} onChange={(e) => onChange({ ...base, email: e.target.value })} voice={(t) => onChange({ ...base, email: cleanEmail(t) })} />
      <InputMic type="tel" autoComplete="tel" placeholder="📱 Celular" value={phone} onChange={(e) => onChange({ ...base, phone: e.target.value })} voice={(t) => onChange({ ...base, phone: onlyDigits(t) })} />
      <div>
        <InputMic inputMode="numeric" placeholder="💵 Ingreso mensual aproximado" value={income} onChange={(e) => onIncome(onlyDigits(e.target.value))} voice={(t) => onIncome(onlyDigits(t))} />
        <IncomeSuggestion rentReference={rentReference} income={incomeNum} who={who} />
      </div>
      <label className="flex cursor-pointer items-start gap-2.5 rounded-2xl border-2 border-amber-200 bg-amber-50/60 p-4 text-sm text-slate-700">
        <input type="checkbox" checked={auth} onChange={(e) => onChange({ ...base, auth: e.target.checked })} className="mt-0.5 h-5 w-5 flex-none accent-[#5646E5]" />
        <span>{authLabel}</span>
      </label>
    </div>
  );
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 break-words text-[15px] font-medium text-slate-800">{value}</p>
    </div>
  );
}

/** Construye la entrada del semáforo legal desde las respuestas + el borrador. */
function complianceFromAnswers(a: Answers, draft: ContractDraft | null): ComplianceInput {
  const canonN = Number((a.canon || "").replace(/[^\d]/g, "")) || 0;
  const cvN = Number((a.commercialValue || "").replace(/[^\d]/g, "")) || 0;
  const g = draft?.utilityServicesGuarantee;
  return {
    property: {
      commercialValue: cvN,
      legalRentCap: cvN > 0 ? Math.round(cvN * 0.01) : 0,
      monthlyRentProposed: canonN,
      commercialValueUnknown: a.noCommercialValue,
    },
    lease: {
      monthlyRent: canonN,
      latePaymentMonthsThreshold: draft?.lease?.latePaymentMonthsThreshold ?? 2,
    },
    utilityServicesGuarantee: g
      ? { enabled: g.enabled, acceptedAt: g.acceptedAt, agreedAmountCop: g.agreedAmountCop, maxAllowedCop: g.maxAllowedCop }
      : undefined,
  };
}

/**
 * Progreso REAL de los puntos que el usuario va incluyendo (no los cumplimientos
 * "por diseño" que siempre están verdes). Arranca en 0 y se llena paso a paso:
 * canon dentro del tope, responsable de servicios, administración, y términos del
 * arriendo. Detecta incumplimientos que dependen de datos (canon sobre el tope,
 * garantía de servicios sobre el máximo).
 */
function lawProgressFromAnswers(a: Answers, draft: ContractDraft | null): { done: number; total: number; failLabel: string | null } {
  const canonN = Number((a.canon || "").replace(/[^\d]/g, "")) || 0;
  const cvN = Number((a.commercialValue || "").replace(/[^\d]/g, "")) || 0;
  const cap = cvN > 0 ? Math.round(cvN * 0.01) : 0;
  const canonOverCap = canonN > 0 && cvN > 0 && canonN > cap;
  // Canon definido y dentro del tope (o con la declaración de "no conozco el valor").
  const canonDone = canonN > 0 && (a.noCommercialValue || (cvN > 0 && !canonOverCap));
  const utilsDone = Boolean(a.utilitiesParty);
  const adminDone = Boolean(a.adminParty);
  const payDay = Number(a.paymentDay);
  const termsDone = Boolean(a.startDate) && (Number(a.termMonths) || 0) > 0 && payDay >= 1 && payDay <= 31;

  // Garantía de servicios (opcional): si se activó y supera el máximo, incumple.
  const g = draft?.utilityServicesGuarantee;
  const guaranteeOver =
    Boolean(g?.enabled) && Number(g?.agreedAmountCop) > 0 && Number(g?.maxAllowedCop) > 0 && Number(g?.agreedAmountCop) > Number(g?.maxAllowedCop);

  const milestones = [canonDone, utilsDone, adminDone, termsDone];
  const done = milestones.filter(Boolean).length;
  const failLabel = canonOverCap
    ? "El canon supera el tope legal (1%)"
    : guaranteeOver
      ? "La garantía supera el máximo (2 períodos)"
      : null;
  return { done, total: milestones.length, failLabel };
}

/** Termómetro compacto: se llena a medida que el usuario COMPLETA cada punto de la Ley 820. */
function LawThermometer({ a, draft }: { a: Answers; draft: ContractDraft | null }) {
  const { done, total, failLabel } = lawProgressFromAnswers(a, draft);
  const pct = Math.round((done / total) * 100);
  const complete = done === total;
  const color = failLabel ? "#E11D48" : complete ? "#12B886" : "#F59E0B";
  const label = failLabel ?? (complete ? "Cumple los puntos de la Ley 820" : "Completa cada punto");
  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-white/70 p-3">
      <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
        <span className="inline-flex items-center gap-1.5">⚖️ Cumplimiento Ley 820</span>
        <span style={{ color }}>{done}/{total} · {label}</span>
      </div>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#EAE6DF]">
        <motion.div className="h-full rounded-full" style={{ backgroundColor: color }} animate={{ width: `${pct}%` }} transition={{ duration: 0.5 }} />
      </div>
    </div>
  );
}

function ProgressBar({ pct }: { pct: number }) {
  const basic = Math.min(50, pct);
  const extra = Math.max(0, pct - 50);
  return (
    <div className="mb-6 flex items-center gap-2">
      <div className="flex h-[11px] flex-1 overflow-hidden rounded-full bg-[#EAE6DF]">
        <motion.div className="h-full bg-gradient-to-r from-[#5646E5] to-[#8B6BFF]" animate={{ width: `${basic}%` }} transition={{ duration: 0.5 }} />
        <motion.div className="h-full bg-gradient-to-r from-[#12B886] to-[#43DDA6]" animate={{ width: `${extra}%` }} transition={{ duration: 0.5 }} />
      </div>
      <span className="w-11 text-right text-sm font-bold tabular-nums">{pct}%</span>
    </div>
  );
}

function BentoCard({ theme, title, sub, cta, onClick, icon }: { theme: [string, string]; title: string; sub: string; cta: string; onClick: () => void; icon: ReactNode }) {
  return (
    <motion.button type="button" onClick={onClick} whileHover={{ y: -6, rotate: -0.6 }} whileTap={{ scale: 0.99 }} className="relative flex min-h-[210px] flex-col justify-between overflow-hidden rounded-3xl p-6 text-left text-white shadow-2xl" style={{ background: `linear-gradient(155deg, ${theme[0]}, ${theme[1]})` }}>
      <span className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(120deg, rgba(255,255,255,.28), transparent 42%)" }} />
      <div>
        <span className="mb-3.5 grid h-12 w-12 place-items-center rounded-[15px] bg-white/20">
          <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">{icon}</svg>
        </span>
        <h3 className="text-[23px] font-bold tracking-tight">{title}</h3>
        <p className="mt-1 text-[14.5px] opacity-90">{sub}</p>
      </div>
      <span className="mt-4 inline-flex items-center gap-1.5 text-[14.5px] font-bold">
        {cta} <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
      </span>
    </motion.button>
  );
}
