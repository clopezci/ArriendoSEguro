import Link from "next/link";
import type { Metadata } from "next";
import { LandingPublicHeader } from "@/components/landing/landing-public-header";
import { AGENCY_TRIAL_CREDITS } from "@/domain/agencies/types";

export const metadata: Metadata = {
  title: "ArriendoSeguro para agencias e inmobiliarias | Contratos en volumen",
  description:
    "Arrendadoras e inmobiliarias: genera contratos de arrendamiento en lote, recibe solicitudes por un solo enlace, verifica identidad, envía firmas y administra tu cartera. Precio por volumen.",
  keywords: [
    "software para inmobiliarias",
    "contratos de arrendamiento en volumen",
    "gestión de arriendos",
    "inmobiliaria Colombia",
    "contratos masivos de arriendo",
  ],
  openGraph: {
    title: "ArriendoSeguro para agencias e inmobiliarias",
    description: "Contratos de arriendo en volumen, sin teclear: un enlace de captura, generación en lote, firmas y cartera.",
    type: "website",
    locale: "es_CO",
  },
};

const BENTO: { icon: string; title: string; desc: string; span?: boolean }[] = [
  { icon: "🔗", title: "Un solo enlace de captura", desc: "Compártelo por WhatsApp o en tus avisos. Cada interesado llena sus datos solo; tú no tecleas nada.", span: true },
  { icon: "⚡", title: "Genera en lote", desc: "Sube un Excel o genera desde las solicitudes: decenas de contratos en minutos." },
  { icon: "🪪", title: "Verifica al inquilino", desc: "Identidad y cédula validadas antes de firmar. Menos fraude, menos morosos." },
  { icon: "✍️", title: "Firmas en lote", desc: "Envía todas las firmas de un clic; sigue quién firmó desde tu cartera." },
  { icon: "🔄", title: "Renovación en 1 clic", desc: "Clona el contrato anterior con el canon ajustado por IPC. Cero repetir." },
  { icon: "📊", title: "Cartera en un lugar", desc: "Estado de cada contrato: borrador, enviado, firmado. Todo ordenado." },
];

const STEPS: { n: number; title: string; desc: string }[] = [
  { n: 1, title: "Comparte tu enlace", desc: "Los interesados llenan sus datos (y su cédula) solos." },
  { n: 2, title: "Revisa y genera", desc: "Completas arrendador, inmueble y canon; el contrato se arma solo." },
  { n: 3, title: "Envía a firma", desc: "Todas las firmas de un clic; consumes créditos por contrato." },
  { n: 4, title: "Administra tu cartera", desc: "Renueva, verifica y da seguimiento desde un panel." },
];

export default function AgenciasLanding() {
  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[#F5F3EF] text-[#17151F]">
      <div className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full opacity-40 blur-3xl" style={{ background: "radial-gradient(circle,#9B6BFF,#5646E5)" }} />
      <div className="pointer-events-none absolute -bottom-28 -left-24 h-72 w-72 rounded-full opacity-40 blur-3xl" style={{ background: "radial-gradient(circle,#FFB03A,#FF6B4A)" }} />

      <div className="relative z-10 flex min-h-[100dvh] flex-col">
        <LandingPublicHeader />

        <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8">
          {/* Hero */}
          <section className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-[#ECE9FB] px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#5646E5]">
              Para arrendadoras e inmobiliarias
            </span>
            <h1 className="mt-3 text-balance text-3xl font-black leading-[1.05] tracking-tight sm:text-4xl">
              Haz contratos en volumen
              <span className="mt-1 block bg-gradient-to-r from-[#5646E5] to-[#FF6B4A] bg-clip-text text-transparent">sin teclear una fila</span>
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-pretty text-[15px] leading-relaxed text-slate-500">
              Un solo enlace para que tus inquilinos se registren solos, generación de contratos en lote, verificación de identidad, firmas masivas y tu cartera en un lugar. Legal (Ley 820) y con precio por volumen.
            </p>
            <div className="mx-auto mt-5 flex w-full max-w-md flex-col gap-2.5">
              <Link href="/agencias/registro" className="inline-flex min-h-[52px] items-center justify-center rounded-2xl bg-[#FF6B4A] px-6 text-base font-bold text-white shadow-lg shadow-orange-500/30 transition hover:brightness-105 active:scale-95">
                Empezar prueba gratis →
              </Link>
              <Link href="/agency" className="inline-flex min-h-[52px] items-center justify-center rounded-2xl border-2 border-[#5646E5] bg-[#ECE9FB]/50 px-6 text-base font-bold text-[#5646E5] transition hover:bg-[#ECE9FB]">
                Ya tengo cuenta — entrar
              </Link>
            </div>
          </section>

          {/* Bento de beneficios */}
          <section className="mt-10">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {BENTO.map((b) => (
                <div key={b.title} className={`rounded-3xl border border-slate-200 bg-white/70 p-5 backdrop-blur ${b.span ? "sm:col-span-2" : ""}`}>
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-[#5646E5] to-[#8B6BFF] text-lg shadow-[0_4px_12px_rgba(86,70,229,0.35)]" aria-hidden="true">{b.icon}</span>
                  <h3 className="mt-3 text-base font-bold text-[#17151F]">{b.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-500">{b.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Cómo funciona (progresivo) */}
          <section className="mt-10 rounded-3xl border border-slate-200 bg-white/70 p-6 backdrop-blur">
            <p className="text-center text-sm font-bold text-[#17151F]">Así de fácil, paso a paso</p>
            <ol className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s) => (
                <li key={s.n} className="rounded-2xl border border-slate-100 bg-[#F5F3EF]/60 p-4">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-[#5646E5] text-sm font-black text-white">{s.n}</span>
                  <h4 className="mt-2 text-sm font-bold text-slate-700">{s.title}</h4>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{s.desc}</p>
                </li>
              ))}
            </ol>
          </section>

          {/* CTA final */}
          <section className="mt-10 rounded-3xl bg-gradient-to-r from-[#5646E5] to-[#8B6BFF] p-6 text-center text-white">
            <h2 className="text-xl font-black">¿Manejas varios arriendos?</h2>
            <p className="mx-auto mt-1 max-w-xl text-sm text-white/85">Crea tu agencia y arranca con {`${AGENCY_TRIAL_CREDITS}`} contratos gratis. Sin tarjeta, sin esperas.</p>
            <div className="mx-auto mt-4 flex w-full max-w-md flex-col gap-2.5 sm:flex-row sm:justify-center">
              <Link href="/agencias/registro" className="inline-flex min-h-[48px] items-center justify-center rounded-2xl bg-white px-6 text-sm font-bold text-[#5646E5] transition hover:brightness-95">Empezar prueba gratis</Link>
              <Link href="/contacto?motivo=agencia" className="inline-flex min-h-[48px] items-center justify-center rounded-2xl border-2 border-white/70 px-6 text-sm font-bold text-white transition hover:bg-white/10">Hablar con nosotros</Link>
            </div>
          </section>

          <p className="mt-6 text-center text-xs text-slate-400">
            ¿Buscas hacer un solo contrato? <Link href="/" className="font-semibold text-[#5646E5] hover:underline">Ir a la versión personal</Link>
          </p>
        </main>
      </div>
    </div>
  );
}
