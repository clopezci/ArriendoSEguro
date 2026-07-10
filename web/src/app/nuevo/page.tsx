"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
import { createContractDraft, updateDraft } from "@/features/contracts/wizard-state";
import { JourneyScene } from "@/components/nuevo/journey-scene";
import { buildWhatsAppUrl } from "@/lib/nuevo/whatsapp";
import { validateStep, type Answers } from "@/lib/nuevo/validation";
import { useVoice } from "@/lib/nuevo/useVoice";
import { MicButton } from "@/components/nuevo/mic-button";

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

type Kind = "text" | "doc" | "contact" | "addr" | "canon" | "tenant" | "codebtor" | "docs";
type Q = { id: string; block: string; prompt: string; hint: string; kind: Kind; ph?: string; basic: boolean };

// Tramo básico (0-50%): dueño 3 + inmueble 2 + inquilino 1 = 6.
// Tramo adicional (50-100%): codeudor (y en F3, documentos).
const QUESTIONS: Q[] = [
  { id: "name", block: "Datos del dueño", prompt: "¿Cómo se llama el arrendador?", hint: "Quien entrega el inmueble en arriendo.", kind: "text", ph: "Nombre completo", basic: true },
  { id: "doc", block: "Datos del dueño", prompt: "Su documento", hint: "Tipo y número.", kind: "doc", basic: true },
  { id: "contact", block: "Datos del dueño", prompt: "¿Cómo lo contactamos?", hint: "Celular y correo — para notificaciones y firma.", kind: "contact", basic: true },
  { id: "addr", block: "Datos del inmueble", prompt: "¿Dónde queda el inmueble?", hint: "Dirección y ciudad que irán en el contrato.", kind: "addr", basic: true },
  { id: "canon", block: "Datos del inmueble", prompt: "¿Cuál es el canon mensual?", hint: "Después validamos el tope legal (Ley 820).", kind: "canon", ph: "$ 1.500.000", basic: true },
  { id: "tenant", block: "Datos del inquilino", prompt: "¿Quién será el arrendatario?", hint: "Lo llenas tú o se lo pides a él.", kind: "tenant", basic: true },
  { id: "codebtor", block: "¿Codeudor?", prompt: "¿Tendrá codeudor solidario?", hint: "Opcional. Añade respaldo si lo necesitas.", kind: "codebtor", basic: false },
  { id: "docs", block: "Documentos del inquilino", prompt: "Documentos del inquilino", hint: "Los subes tú, o le pides al inquilino que los cargue por WhatsApp o correo.", kind: "docs", basic: false },
];

const EMPTY: Answers = { name: "", docType: "CC", docNumber: "", phone: "", email: "", address: "", city: "", canon: "", tenantMode: "self", tenantName: "", hasCodebtor: "", codebtorName: "", docMethod: "", docPhone: "", docEmail: "" };

const BASIC_TOTAL = QUESTIONS.filter((q) => q.basic).length;
const EXTRA_TOTAL = QUESTIONS.length - BASIC_TOTAL;

export default function NuevoPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"home" | "flow" | "done">("home");
  const [themes, setThemes] = useState<[[string, string], [string, string]]>([THEMES[0], THEMES[1]]);
  const [greeting, setGreeting] = useState(GREETINGS[0]);
  const [subIdx, setSubIdx] = useState(0);

  const [draftId, setDraftId] = useState<string | null>(null);
  const [i, setI] = useState(0);
  const [a, setARaw] = useState<Answers>(EMPTY);
  const [error, setError] = useState<string | null>(null);

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
    const de = QUESTIONS.slice(0, i).filter((q) => !q.basic).length;
    return Math.round((db / BASIC_TOTAL) * 50 + (EXTRA_TOTAL ? de / EXTRA_TOTAL : 0) * 50);
  }, [i]);

  // --- Modo voz / accesibilidad ---
  const { canSpeak, canListen, listening, speak, listen, stop } = useVoice();
  const [voiceMode, setVoiceMode] = useState(false);
  const aRef = useRef(a); aRef.current = a;
  const iRef = useRef(i); iRef.current = i;
  const voiceModeRef = useRef(voiceMode); voiceModeRef.current = voiceMode;
  const draftIdRef = useRef<string | null>(null);
  const onTranscriptRef = useRef<(t: string) => void>(() => {});

  function start() {
    const draft = createContractDraft({ userId: user?.uid ?? "invitado", accessStatus: "free", isDemo: false });
    setDraftId(draft.id);
    draftIdRef.current = draft.id;
    setARaw(EMPTY);
    setError(null);
    setI(0);
    setMode("flow");
  }

  const persist = useCallback((n: Answers) => {
    const draftId = draftIdRef.current;
    if (!draftId) return;
    const canonNum = Number(n.canon.replace(/[^\d]/g, "")) || 0;
    updateDraft(draftId, (d) => ({
      ...d,
      hasSolidaryCoDebtor: n.hasCodebtor === "yes" ? true : n.hasCodebtor === "no" ? false : d.hasSolidaryCoDebtor,
      landlord: {
        ...d.landlord,
        fullName: n.name.trim() || d.landlord.fullName,
        documentType: n.docType || d.landlord.documentType,
        documentNumber: n.docNumber.trim() || d.landlord.documentNumber,
        phone: n.phone.trim() || d.landlord.phone,
        email: n.email.trim() || d.landlord.email,
      },
      property: {
        ...d.property,
        address: n.address.trim() || d.property.address,
        city: n.city.trim() || d.property.city,
        ...(canonNum > 0 ? { monthlyRentProposed: canonNum } : {}),
      },
      tenant: {
        ...d.tenant,
        fullName: n.tenantName.trim() || d.tenant.fullName,
        phone: (n.docMethod === "whatsapp" ? n.docPhone.trim() : "") || d.tenant.phone,
        email: (n.docMethod === "email" ? n.docEmail.trim() : "") || d.tenant.email,
      },
      solidaryCoDebtor: n.hasCodebtor === "yes"
        ? { ...d.solidaryCoDebtor, fullName: n.codebtorName.trim() || d.solidaryCoDebtor.fullName }
        : d.solidaryCoDebtor,
    }));
  }, []);

  const relisten = useCallback(() => {
    if (voiceModeRef.current && canListen) listen((t) => onTranscriptRef.current(t));
  }, [listen, canListen]);

  const next = useCallback(() => {
    const cq = QUESTIONS[iRef.current];
    const e = validateStep(cq.kind, aRef.current);
    if (e) { setError(e); if (voiceModeRef.current) speak(e, relisten); return; } // no avanza con datos inválidos/en blanco
    setError(null);
    persist(aRef.current);
    if (iRef.current >= QUESTIONS.length - 1) { setMode("done"); return; }
    setI(iRef.current + 1);
  }, [persist, speak, relisten]);

  const back = useCallback(() => {
    setError(null);
    if (iRef.current === 0) { setMode("home"); return; }
    setI(iRef.current - 1);
  }, []);

  // Rellena por voz según el tipo de paso.
  const fillByVoice = useCallback((kind: string, s: string, raw: string) => {
    const digits = raw.replace(/\D/g, "");
    setError(null);
    setARaw((p) => {
      switch (kind) {
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
    if (cq.kind === "doc") text += " Di el tipo: cédula, extranjería, nit o pasaporte, y luego el número.";
    if (cq.kind === "codebtor") text += " Responde sí o no.";
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

  function toggleVoice() {
    const nv = !voiceMode;
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

  async function sendInvite(method: "whatsapp" | "email") {
    const draftId = draftIdRef.current;
    if (!draftId) { setInviteStatus("Primero empieza el contrato."); return; }
    setInviteBusy(true); setInviteStatus(null);
    try {
      const res = await fetch("/api/nuevo/invite", {
        method: "POST",
        headers: { "content-type": "application/json", ...(user ? await buildAuthHeaders(user) : {}) },
        body: JSON.stringify({ contractDraftId: draftId, method, phone: aRef.current.docPhone, email: aRef.current.docEmail, name: aRef.current.tenantName }),
      });
      if (res.status === 401) { setInviteStatus("Inicia sesión para enviar el enlace al inquilino."); return; }
      const j = (await res.json()) as { success?: boolean; invitationUrl?: string; emailStatus?: string; errors?: { message?: string }[] };
      if (!j.success || !j.invitationUrl) { setInviteStatus(j.errors?.[0]?.message ?? "No se pudo generar el enlace."); return; }
      if (method === "whatsapp") {
        window.open(buildWhatsAppUrl(aRef.current.docPhone, `Hola 👋 Te comparto el enlace para completar tus datos y subir tus documentos del contrato de arriendo en ArriendoSeguro: ${j.invitationUrl}`), "_blank");
        setInviteStatus("WhatsApp abierto con el enlace real ✓");
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
      <div className="pointer-events-none absolute -right-20 -top-28 h-80 w-80 rounded-full opacity-50 blur-3xl" style={{ background: "radial-gradient(circle,#9B6BFF,#5646E5)" }} />
      <div className="pointer-events-none absolute -bottom-28 -left-24 h-72 w-72 rounded-full opacity-50 blur-3xl" style={{ background: "radial-gradient(circle,#FFB03A,#FF6B4A)" }} />

      <div className="relative z-10 mx-auto max-w-3xl px-6 py-8">
        <div className="mb-9 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
            <span className="h-7 w-7 rounded-[9px] bg-gradient-to-br from-[#5646E5] to-[#8B6BFF] shadow-lg shadow-violet-500/40" />
            ArriendoSeguro
          </Link>
          <div className="flex items-center gap-2">
            {canSpeak && (
              <button type="button" onClick={toggleVoice} aria-pressed={voiceMode}
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

        <AnimatePresence mode="wait">
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
                      <p className="text-sm font-semibold text-slate-800">Cuéntame tu caso en tus palabras</p>
                      <textarea value={aiText} onChange={(e) => setAiText(e.target.value)} rows={3}
                        placeholder="Ej.: Soy Juan Pérez, cédula 79000000, arriendo mi apartamento en la Calle 1 #2-3 de Bogotá por 1.500.000 a María López, con codeudor Pedro Gómez."
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

          {mode === "flow" && (
            <motion.section key="flow" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
              <ProgressBar pct={pct} />
              <span className="inline-flex items-center gap-2 rounded-full bg-[#5646E5] px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white">{q.block}</span>

              <div className="relative mt-4 min-h-[240px]">
                <AnimatePresence mode="wait">
                  <motion.div key={q.id} initial={{ opacity: 0, x: 28 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.35 }}>
                    <h2 className="text-balance text-3xl font-extrabold tracking-tight">{q.prompt}</h2>
                    <p className="mt-1.5 mb-5 text-slate-500">{q.hint}</p>
                    <Field q={q} a={a} setA={setA} docs={{ send: sendInvite, status: inviteStatus, busy: inviteBusy }} />
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
                <button onClick={back} className="px-3 py-4 text-base font-bold text-slate-500 hover:text-[#17151F]">Atrás</button>
              </div>

              <JourneyScene pct={pct} stepIndex={i} />

              <div className="mt-5 rounded-2xl border border-slate-200 bg-white/70 p-3">
                <div className="flex items-center gap-2">
                  <span className="text-violet-600">✨</span>
                  <input value={askText} onChange={(e) => setAskText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") void askAI(); }}
                    placeholder="¿Dudas de este paso? Pregúntame…"
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" />
                  <button type="button" onClick={() => void askAI()} disabled={askBusy || !askText.trim()} className="rounded-lg bg-violet-100 px-3 py-1.5 text-xs font-semibold text-violet-700 disabled:opacity-50">
                    {askBusy ? "…" : "Preguntar"}
                  </button>
                </div>
                {askAns && <p className="mt-2 border-t border-slate-100 pt-2 text-sm text-slate-700">{askAns}</p>}
              </div>
            </motion.section>
          )}

          {mode === "done" && (
            <motion.section key="done" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
              <ProgressBar pct={100} />
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 12 }} className="mx-auto mt-4 grid h-20 w-20 place-items-center rounded-full bg-[#12B886] shadow-xl shadow-emerald-500/40">
                <svg width="38" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><path d="M5 13l4 4L19 7" /></svg>
              </motion.div>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight">¡Lo básico está listo!</h2>
              <p className="mx-auto mt-2 max-w-md text-slate-500">
                Guardamos dueño, inmueble, inquilino y codeudor en tu expediente. Continúa con documentos y firma en el asistente — cada parte acepta sus juramentos al firmar.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <button onClick={() => draftId && router.push(`/dashboard/contracts/${draftId}/contract-type`)} className="rounded-2xl bg-[#5646E5] px-7 py-4 text-base font-bold text-white shadow-lg shadow-violet-500/30 transition hover:brightness-105 active:scale-95">
                  Continuar en el asistente →
                </button>
                <button onClick={() => setMode("home")} className="rounded-2xl border border-slate-300 px-5 py-4 text-base font-semibold text-slate-600">Inicio</button>
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

function Field({ q, a, setA, docs }: { q: Q; a: Answers; setA: (a: Answers) => void; docs: { send: (m: "whatsapp" | "email") => void; status: string | null; busy: boolean } }) {
  switch (q.kind) {
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
        </div>
      );
    case "addr":
      return (
        <div className="flex flex-col gap-2.5">
          <InputMic autoFocus autoComplete="street-address" placeholder="Calle 00 # 00-00" value={a.address} onChange={(e) => setA({ ...a, address: e.target.value })} voice={(t) => setA({ ...a, address: t })} />
          <InputMic autoComplete="address-level2" placeholder="Ciudad" value={a.city} onChange={(e) => setA({ ...a, city: e.target.value })} voice={(t) => setA({ ...a, city: t })} />
        </div>
      );
    case "canon":
      return <InputMic autoFocus inputMode="numeric" placeholder={q.ph} value={a.canon} onChange={(e) => setA({ ...a, canon: e.target.value })} voice={(t) => setA({ ...a, canon: onlyDigits(t) })} />;
    case "tenant":
      return (
        <>
          <div className="mb-3 flex flex-wrap gap-2.5">
            <button type="button" onClick={() => setA({ ...a, tenantMode: "self" })} className={chip(a.tenantMode === "self")}>Lo lleno yo</button>
            <button type="button" onClick={() => setA({ ...a, tenantMode: "invite" })} className={chip(a.tenantMode === "invite")}>Se lo pido a él</button>
          </div>
          <InputMic autoFocus placeholder="Nombre del arrendatario" value={a.tenantName} onChange={(e) => setA({ ...a, tenantName: e.target.value })} voice={(t) => setA({ ...a, tenantName: t })} />
        </>
      );
    case "codebtor":
      return (
        <>
          <div className="mb-3 flex flex-wrap gap-2.5">
            <button type="button" onClick={() => setA({ ...a, hasCodebtor: "yes" })} className={chip(a.hasCodebtor === "yes")}>Sí, con codeudor</button>
            <button type="button" onClick={() => setA({ ...a, hasCodebtor: "no" })} className={chip(a.hasCodebtor === "no")}>No</button>
          </div>
          {a.hasCodebtor === "yes" && (
            <InputMic autoFocus placeholder="Nombre del codeudor" value={a.codebtorName} onChange={(e) => setA({ ...a, codebtorName: e.target.value })} voice={(t) => setA({ ...a, codebtorName: t })} />
          )}
        </>
      );
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
          <p className="mt-1 text-xs text-slate-500">El enlace es único de este contrato: el inquilino completa sus datos y sube documentos. También puedes elegir “los subo yo”.</p>
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
