"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/contexts/auth-context";
import { createContractDraft, updateDraft } from "@/features/contracts/wizard-state";
import { JourneyScene } from "@/components/nuevo/journey-scene";
import { buildWhatsAppUrl } from "@/lib/nuevo/whatsapp";

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

type Answers = {
  name: string; docType: string; docNumber: string; phone: string; email: string;
  address: string; city: string; canon: string;
  tenantMode: "self" | "invite"; tenantName: string;
  hasCodebtor: "" | "yes" | "no"; codebtorName: string;
  docMethod: "" | "self" | "whatsapp" | "email"; docPhone: string; docEmail: string;
};
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
  const [a, setA] = useState<Answers>(EMPTY);

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

  function start() {
    const draft = createContractDraft({ userId: user?.uid ?? "invitado", accessStatus: "free", isDemo: false });
    setDraftId(draft.id);
    setA(EMPTY);
    setI(0);
    setMode("flow");
  }

  function persist(n: Answers) {
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
  }

  function next() {
    persist(a);
    if (i >= QUESTIONS.length - 1) { setMode("done"); return; }
    setI(i + 1);
  }
  function back() {
    if (i === 0) { setMode("home"); return; }
    setI(i - 1);
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
          <span className="rounded-full border border-slate-200 bg-white/70 px-3 py-1.5 text-xs text-slate-500">Vista nueva (beta)</span>
        </div>

        <AnimatePresence mode="wait">
          {mode === "home" && (
            <motion.section key="home" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#5646E5]">Hola 👋</p>
              <h1 className="mt-3 text-balance text-4xl font-extrabold leading-none tracking-tight sm:text-5xl">{greeting}</h1>
              <p className="mt-3 h-7 text-lg text-slate-500">{SUBPHRASES[subIdx]}</p>
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <BentoCard theme={themes[0]} title="Crear un contrato" sub="Te guío una pregunta a la vez. Sin formularios eternos." cta="Empezar" onClick={start} icon={<path d="M8 3h6l4 4v14H6V5M14 3v4h4M9 13h6M9 17h4" />} />
                <BentoCard theme={themes[1]} title="Gestionar mis contratos" sub="Firmas, pagos, inventario y alertas de los que ya creaste." cta="Ver mis contratos" onClick={() => router.push("/dashboard/leases")} icon={<path d="M3 7h6l2 2h10v11H3zM3 7V5h5l2 2" />} />
                <div className="col-span-full flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white/70 p-3 text-sm text-slate-500 backdrop-blur">
                  🔒 <b className="text-[#17151F]">Tranquilo:</b> puedes pausar y seguir después; tus datos quedan guardados.
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
                    <Field q={q} a={a} setA={setA} />
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

function Field({ q, a, setA }: { q: Q; a: Answers; setA: (a: Answers) => void }) {
  switch (q.kind) {
    case "text":
      return <input autoFocus className={inputCls} placeholder={q.ph} value={a.name} onChange={(e) => setA({ ...a, name: e.target.value })} />;
    case "doc":
      return (
        <>
          <div className="mb-3 flex flex-wrap gap-2.5">
            {["CC", "CE", "NIT", "Pasaporte"].map((t) => (
              <button key={t} type="button" onClick={() => setA({ ...a, docType: t })} className={chip(a.docType === t)}>{t}</button>
            ))}
          </div>
          <input autoFocus className={inputCls} placeholder="Número de documento" value={a.docNumber} onChange={(e) => setA({ ...a, docNumber: e.target.value })} />
        </>
      );
    case "contact":
      return (
        <div className="flex flex-col gap-2.5 sm:flex-row">
          <input autoFocus className={inputCls} placeholder="📱 Celular" value={a.phone} onChange={(e) => setA({ ...a, phone: e.target.value })} />
          <input className={inputCls} placeholder="✉️ Correo" value={a.email} onChange={(e) => setA({ ...a, email: e.target.value })} />
        </div>
      );
    case "addr":
      return (
        <div className="flex flex-col gap-2.5">
          <input autoFocus className={inputCls} placeholder="Calle 00 # 00-00" value={a.address} onChange={(e) => setA({ ...a, address: e.target.value })} />
          <input className={inputCls} placeholder="Ciudad" value={a.city} onChange={(e) => setA({ ...a, city: e.target.value })} />
        </div>
      );
    case "canon":
      return <input autoFocus inputMode="numeric" className={inputCls} placeholder={q.ph} value={a.canon} onChange={(e) => setA({ ...a, canon: e.target.value })} />;
    case "tenant":
      return (
        <>
          <div className="mb-3 flex flex-wrap gap-2.5">
            <button type="button" onClick={() => setA({ ...a, tenantMode: "self" })} className={chip(a.tenantMode === "self")}>Lo lleno yo</button>
            <button type="button" onClick={() => setA({ ...a, tenantMode: "invite" })} className={chip(a.tenantMode === "invite")}>Se lo pido a él</button>
          </div>
          <input autoFocus className={inputCls} placeholder="Nombre del arrendatario" value={a.tenantName} onChange={(e) => setA({ ...a, tenantName: e.target.value })} />
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
            <input autoFocus className={inputCls} placeholder="Nombre del codeudor" value={a.codebtorName} onChange={(e) => setA({ ...a, codebtorName: e.target.value })} />
          )}
        </>
      );
    case "docs":
      return (
        <div className="flex flex-col gap-2.5">
          <DocOption sel={a.docMethod === "self"} onClick={() => setA({ ...a, docMethod: "self" })} tone="me" title="Los subo yo ahora" desc="Cargo los documentos del inquilino directamente." icon={mailIcon} />
          <DocOption sel={a.docMethod === "whatsapp"} onClick={() => setA({ ...a, docMethod: "whatsapp" })} tone="wa" title="Enviar por WhatsApp" desc="Le llega un mensaje para que suba sus documentos." icon={waIcon} />
          <DocOption sel={a.docMethod === "email"} onClick={() => setA({ ...a, docMethod: "email" })} tone="em" title="Enviar por correo" desc="El mismo enlace, por email." icon={mailIcon} />
          {a.docMethod === "whatsapp" && (
            <div className="mt-1 flex flex-col gap-2 sm:flex-row">
              <input className={inputCls} inputMode="tel" placeholder="📱 Celular del inquilino" value={a.docPhone} onChange={(e) => setA({ ...a, docPhone: e.target.value })} />
              <button type="button" disabled={a.docPhone.replace(/\D/g, "").length < 7}
                onClick={() => window.open(buildWhatsAppUrl(a.docPhone, "Hola 👋 Te invito a subir tus documentos para el contrato de arriendo en ArriendoSeguro. El enlace específico te llegará al finalizar el contrato. Más info: https://arriendoseguro.app"), "_blank")}
                className="whitespace-nowrap rounded-2xl bg-[#25D366] px-5 py-4 text-base font-bold text-white transition hover:brightness-105 active:scale-95 disabled:opacity-50">
                Abrir WhatsApp
              </button>
            </div>
          )}
          {a.docMethod === "email" && (
            <input className={inputCls} inputMode="email" placeholder="✉️ Correo del inquilino" value={a.docEmail} onChange={(e) => setA({ ...a, docEmail: e.target.value })} />
          )}
          <p className="mt-1 text-xs text-slate-500">El enlace específico para subir documentos se genera al crear el contrato en el asistente; aquí dejamos listo el método y el contacto.</p>
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
