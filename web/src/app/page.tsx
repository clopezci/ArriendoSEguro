import { LandingPublicHeader } from "@/components/landing/landing-public-header";
import { LandingInstallApp } from "@/components/landing/landing-install-app";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contrato de arrendamiento en Colombia | ArriendoSeguro",
  description:
    "Formaliza tu contrato de arrendamiento en Colombia con firma electrónica, inventario fotográfico, registro de pagos y trazabilidad documental para arriendos entre particulares. Te guiamos una pregunta a la vez.",
  keywords: [
    "contrato de arrendamiento",
    "contrato de arriendo",
    "arrendar sin inmobiliaria",
    "arriendo directo",
    "arrendamiento entre particulares",
    "firma electrónica",
    "Colombia",
  ],
  openGraph: {
    title: "Contrato de arrendamiento en Colombia | ArriendoSeguro",
    description:
      "Haz tu contrato de arriendo fácil, una pregunta a la vez: firma electrónica, inventario y registro de pagos, sin inmobiliaria.",
    type: "website",
    locale: "es_CO",
  },
};

// Recorrido real del asistente, presentado como un camino fácil (no un trámite).
const STEPS: { n: number; label: string; icon: string }[] = [
  { n: 1, label: "Tus datos", icon: "📝" },
  { n: 2, label: "Condiciones", icon: "⚙️" },
  { n: 3, label: "Revisión", icon: "🔎" },
  { n: 4, label: "Firma", icon: "✍️" },
  { n: 5, label: "Entrega", icon: "📦" },
];

const FEATURES: { icon: string; title: string; desc: string }[] = [
  { icon: "📝", title: "Contrato paso a paso", desc: "Vivienda urbana conforme a la Ley 820 de 2003." },
  { icon: "⚖️", title: "Canon dentro de la ley", desc: "Validamos el tope legal (1% del valor comercial)." },
  { icon: "👥", title: "Codeudor y cláusulas", desc: "Servicios públicos, codeudor y cláusulas especiales." },
  { icon: "✍️", title: "Firma con evidencia", desc: "Firma electrónica con validez legal (Ley 527 de 1999)." },
  { icon: "📦", title: "Inventario y acta", desc: "Estado del inmueble con fotos y acta de entrega." },
  { icon: "🔔", title: "Posventa completa", desc: "Pagos, novedades, renovación y reputación privada." },
];

const TOOLS: { icon: string; href: string; title: string; desc: string }[] = [
  { icon: "📘", href: "/blog", title: "Blog de arriendo", desc: "Canon, IPC, terminación e inventario, con las leyes citadas." },
  { icon: "🧮", href: "/calculadoras", title: "Calculadoras", desc: "IPC, tope del canon, intereses de mora y preaviso." },
  { icon: "📄", href: "/plantillas", title: "Plantillas gratis", desc: "Preaviso, paz y salvo, acta de entrega y autorización de datos." },
  { icon: "❓", href: "/entiendelo-facil", title: "Cómo funciona", desc: "Guía clara para formalizar tu primer arriendo." },
];

export default function Home() {
  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[#F5F3EF] text-[#17151F]">
      <div className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full opacity-40 blur-3xl" style={{ background: "radial-gradient(circle,#9B6BFF,#5646E5)" }} />
      <div className="pointer-events-none absolute -bottom-28 -left-24 h-72 w-72 rounded-full opacity-40 blur-3xl" style={{ background: "radial-gradient(circle,#FFB03A,#FF6B4A)" }} />

      <div className="relative z-10 flex min-h-[100dvh] flex-col">
        <LandingPublicHeader />

        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 px-5 py-8 text-center">
          {/* Hero */}
          <div className="space-y-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-[#ECE9FB] px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#5646E5]">
              Sin inmobiliaria · pago único por contrato
            </span>
            <h1 className="text-balance text-3xl font-black leading-[1.05] tracking-tight sm:text-4xl">
              Haz tu contrato de arriendo
              <span className="mt-1 block bg-gradient-to-r from-[#5646E5] to-[#FF6B4A] bg-clip-text text-transparent">
                fácil, una pregunta a la vez
              </span>
            </h1>
            <p className="text-pretty text-[15px] leading-relaxed text-slate-500">
              Nada de formularios eternos: te guiamos con una sola pregunta en cada paso. Por un{" "}
              <strong className="font-semibold text-emerald-700">precio de introducción de{" "}
              <span className="font-normal text-slate-400 line-through">$89.900</span> $49.900</strong>{" "}
              <strong className="font-semibold text-slate-700">(un solo pago por TODO el contrato, no es mensual)</strong>{" "}
              tienes: <strong className="font-semibold text-slate-700">firma electrónica</strong> con validez legal (Ley 527),
              inventario con fotos y acta de entrega, registro de pagos con recordatorios, novedades y mantenimiento,
              historial de reputación y el paquete de evidencia descargable.
            </p>
          </div>

          {/* CTAs */}
          <div className="mx-auto flex w-full max-w-md flex-col gap-2.5">
            <Link
              href="/nuevo"
              className="inline-flex min-h-[52px] items-center justify-center rounded-2xl bg-[#FF6B4A] px-6 text-base font-bold text-white shadow-lg shadow-orange-500/30 transition hover:brightness-105 active:scale-95"
            >
              Crear mi contrato →
            </Link>
            <Link
              href="/ingresar?redirect=%2Fnuevo%3Fmenu%3D1"
              className="inline-flex min-h-[52px] items-center justify-center rounded-2xl border-2 border-slate-200 bg-white/80 px-6 text-base font-bold text-slate-700 transition hover:border-[#5646E5]"
            >
              Ya tengo cuenta
            </Link>
            <Link
              href="/funcionalidades"
              className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border-2 border-[#5646E5] bg-[#ECE9FB]/50 px-6 text-base font-bold text-[#5646E5] transition hover:bg-[#ECE9FB]"
            >
              🔊 Ver todo lo que puedes hacer
            </Link>
          </div>

          {/* Recorrido fácil (los 5 pasos, como un camino, no un trámite) */}
          <div className="rounded-3xl border border-slate-200 bg-white/70 p-4 backdrop-blur">
            <p className="text-sm font-bold text-[#17151F]">Así de fácil, de principio a fin</p>
            <p className="mt-0.5 text-xs text-slate-500">Avanzas a tu ritmo; puedes pausar y seguir después.</p>
            <ol className="mt-3 flex items-start justify-between gap-1">
              {STEPS.map((s) => (
                <li key={s.n} className="flex flex-1 flex-col items-center gap-1.5">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-[#5646E5] to-[#8B6BFF] text-lg shadow-[0_4px_12px_rgba(86,70,229,0.35)]">
                    <span aria-hidden="true">{s.icon}</span>
                  </span>
                  <span className="text-[11px] font-semibold leading-tight text-slate-600">{s.label}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-slate-500">
            <Link href="/herramientas" className="font-medium hover:text-[#5646E5] hover:underline">Herramientas gratis</Link>
            <Link href="/entiendelo-facil" className="font-medium hover:text-[#5646E5] hover:underline">Cómo funciona</Link>
            <LandingInstallApp
              className="!min-h-0 !border-0 !bg-transparent !px-0 !py-0 !text-xs !font-medium !text-slate-500 !shadow-none hover:!bg-transparent hover:!text-[#5646E5] hover:!underline"
              label="Instalar app"
            />
          </div>
        </main>

        {/* Qué puedes hacer — tarjetas bento */}
        <section className="mx-auto w-full max-w-4xl px-5 py-10">
          <h2 className="text-center text-2xl font-black tracking-tight">Todo tu arriendo, en un solo lugar</h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-sm text-slate-500">
            De crear el contrato a la entrega y el día a día del arriendo — con evidencia y sin dejarlo informal.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-[0_10px_30px_rgba(86,70,229,0.08)]">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#ECE9FB] text-xl">{f.icon}</span>
                <p className="mt-3 text-[15px] font-bold">{f.title}</p>
                <p className="mt-1 text-[13px] leading-snug text-slate-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Aprende y herramientas gratis — tarjetas */}
        <section className="mx-auto w-full max-w-4xl px-5 pb-10">
          <h2 className="text-center text-xl font-black tracking-tight">Aprende y usa nuestras herramientas gratis</h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-sm text-slate-500">Guías con fuentes legales reales y herramientas de acceso libre.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {TOOLS.map((t) => (
              <Link key={t.href} href={t.href} className="flex items-start gap-3.5 rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-[0_10px_30px_rgba(86,70,229,0.08)] transition hover:border-[#5646E5]">
                <span className="grid h-11 w-11 flex-none place-items-center rounded-2xl bg-[#ECE9FB] text-xl">{t.icon}</span>
                <span className="min-w-0">
                  <span className="block text-[15px] font-bold text-[#17151F]">{t.title}</span>
                  <span className="mt-0.5 block text-[13px] leading-snug text-slate-500">{t.desc}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* Texto informativo (SEO) — original y útil */}
        <section className="border-t border-slate-200/70 bg-white/60">
          <div className="mx-auto w-full max-w-3xl px-5 py-10 text-left text-slate-600">
            <h2 className="text-xl font-bold text-[#17151F]">Contratos de arriendo entre particulares en Colombia, bien hechos</h2>
            <p className="mt-3 text-sm leading-relaxed">
              ArriendoSeguro es una herramienta para que <strong>arrendadores e inquilinos</strong> que ya acordaron un
              arriendo lo <strong>formalicen y documenten</strong> sin depender de una inmobiliaria. Te guiamos, una
              pregunta a la vez, para armar el contrato conforme a la <strong>Ley 820 de 2003</strong> (arrendamiento de
              vivienda urbana), firmarlo con <strong>firma electrónica</strong> con validez legal (
              <strong>Ley 527 de 1999</strong>), registrar el <strong>inventario de entrega</strong> con fotos y llevar
              el control de <strong>pagos, novedades y renovación</strong>.
            </p>
            <p className="mt-3 text-sm leading-relaxed">
              No somos inmobiliaria ni asesoría jurídica: te ayudamos a dejar por escrito y con evidencia lo que las
              partes acuerdan, para reducir conflictos. El contrato tiene un <strong>precio de introducción de{" "}
              <span className="font-normal text-slate-400 line-through">$89.900</span> $49.900</strong> —{" "}
              <strong>un solo pago por todo el contrato (no es mensual)</strong>, que incluye la firma electrónica, el
              inventario con acta, el registro de pagos con recordatorios, novedades y mantenimiento, la reputación y el
              paquete de evidencia; y tu <strong>segundo contrato puede ser gratis</strong> si lo compartes con 3 personas
              y al menos 2 de ellas lo usan.
            </p>
            <p className="mt-4 text-xs text-slate-400">
              Información general orientada a Colombia; no sustituye asesoría legal. Consulta siempre las normas vigentes
              y, ante dudas, a un profesional.
            </p>
          </div>
        </section>

        <footer className="mx-auto w-full max-w-2xl px-5 pb-4 pt-6">
          <p className="text-center text-[10px] leading-relaxed text-slate-400">
            ArriendoSeguro no reemplaza una inmobiliaria ni una asesoría legal. Ayuda a formalizar y documentar arriendos
            entre particulares.
          </p>
        </footer>
      </div>
    </div>
  );
}
