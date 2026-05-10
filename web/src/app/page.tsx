import { LeadMarketForm } from "@/components/forms/lead-market-form";
import { BrandLockup } from "@/components/brand/brand-lockup";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contrato de arrendamiento en Colombia | ArriendoSeguro",
  description:
    "Formaliza tu contrato de arrendamiento en Colombia con firma electrónica, inventario fotográfico, registro de pagos y trazabilidad documental para arriendos entre particulares.",
  keywords: [
    "contrato de arrendamiento",
    "contrato de arriendo",
    "arrendar sin inmobiliaria",
    "arriendo directo",
    "arrendamiento entre particulares",
    "firma electrónica",
    "inventario fotográfico",
    "registro de pagos",
    "Colombia",
  ],
  openGraph: {
    title: "Contrato de arrendamiento en Colombia | ArriendoSeguro - AS",
    description:
      "Formaliza tu contrato de arriendo con firma electrónica, inventario y registro de pagos, sin inmobiliaria y sin dejarlo informal.",
    type: "website",
    locale: "es_CO",
  },
};

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-900 text-slate-100">
      <header className="shrink-0 border-b border-slate-800/60 bg-slate-950/90 shadow-[0_6px_20px_rgba(139,92,246,0.12)] backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-2 sm:px-6">
          <span className="text-sm font-semibold tracking-tight text-violet-300 sm:text-base">
            <BrandLockup />
          </span>
          <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
            <a
              href="#interes"
              className="rounded-md border border-slate-600 px-2 py-1 text-[11px] font-medium text-slate-200 transition hover:border-violet-500/50 hover:text-slate-100 sm:px-2.5 sm:text-xs"
            >
              Responder encuesta
            </a>
            <Link
              href="/demo"
              className="rounded-md border border-slate-600 px-2 py-1 text-[11px] font-medium text-slate-200 transition hover:border-violet-500/50 hover:text-slate-100 sm:px-2.5 sm:text-xs"
            >
              Ver demo guiado
            </Link>
            <Link
              href="/ingresar"
              className="rounded-md border border-violet-500/60 bg-violet-600/20 px-2 py-1 text-[11px] font-medium text-violet-200 shadow-[0_0_12px_rgba(139,92,246,0.2)] transition hover:bg-violet-600/30 sm:px-2.5 sm:text-xs"
            >
              Acceder al panel
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-6 pt-4 sm:px-6 sm:pb-8 sm:pt-5 lg:min-h-[calc(100vh-3.25rem)] lg:pb-6">
        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start">
          <div className="flex min-h-0 flex-col gap-3 lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto lg:pr-1">
            <section className="space-y-3">
              <h1 className="text-balance text-center text-2xl font-extrabold leading-tight tracking-tight text-slate-50 sm:text-3xl lg:text-left">
                <span className="block">¿Vas a arrendar?</span>
                <span className="mt-0.5 block">¿Necesitas hacer tu contrato de arrendamiento?</span>
              </h1>
              <p className="rounded-xl border border-violet-500/35 bg-violet-950/40 px-4 py-3 text-center text-base font-semibold leading-snug text-violet-100 shadow-[0_0_28px_rgba(139,92,246,0.22)] sm:text-lg sm:leading-snug lg:text-left lg:text-[1.05rem]">
                Si prefieres evitar los costos de una agencia y te preocupa hacer un arriendo
                directo sin suficiente respaldo… llegaste al lugar adecuado.
              </p>
              <div className="space-y-2 text-center text-sm leading-snug text-slate-400 sm:text-[0.95rem] lg:text-left">
                <p className="text-slate-300">
                  ArriendoSeguro es una plataforma digital para arriendos en Colombia que ayuda a
                  formalizar un arrendamiento entre particulares.
                </p>
                <p>
                  Crea tu contrato de arriendo con firma electrónica, inventario fotográfico,
                  registro de pagos, notificaciones, calificación de la experiencia y trazabilidad documental, sin pago de
                  mensualidades. Todo en un solo flujo, pensado para quienes quieren arrendar sin
                  inmobiliaria y sin dejarlo informal.
                </p>
              </div>
              <div className="flex justify-center lg:justify-start">
                <Link
                  href="/entiendelo-facil"
                  className="inline-flex rounded-lg border border-slate-600 px-5 py-2.5 text-sm font-medium text-slate-200 shadow-[0_0_0_1px_rgba(139,92,246,0.2)] transition hover:border-sky-500/60 hover:text-sky-200"
                >
                  Entender cómo funciona
                </Link>
              </div>
            </section>

            <p className="flex flex-wrap items-center justify-center gap-2 text-[11px] leading-snug text-slate-400 lg:justify-start">
              <span className="inline-flex items-center rounded-full border border-violet-500/40 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-200">
                Próximamente
              </span>
              <span>
                Convenios con <strong className="font-semibold text-slate-200">aseguradoras</strong>,{" "}
                <strong className="font-semibold text-slate-200">asesoría legal</strong>,{" "}
                <strong className="font-semibold text-slate-200">agencias de cobranza</strong> y otros
                aliados, por si en algún momento necesitas ir un paso más allá.
              </span>
            </p>

            <section className="space-y-2 rounded-lg border border-slate-800/50 bg-slate-900/25 p-3 sm:p-3.5">
              <h2 className="text-center text-sm font-semibold text-slate-100 lg:text-left sm:text-base">
                Ayúdanos a construir una solución útil para arrendar mejor
              </h2>
              <p className="text-center text-[11px] leading-relaxed text-slate-500 sm:text-xs lg:text-left">
                Estamos validando ArriendoSeguro con propietarios y arrendatarios reales. Responde
                esta encuesta corta y ayúdanos a saber si esta solución te serviría, qué debería
                incluir y cuánto estarías dispuesto a pagar.
              </p>
              <p className="flex flex-wrap items-center justify-center gap-2 rounded-lg border border-violet-500/40 bg-violet-500/10 px-3 py-2 text-[11px] leading-snug text-violet-100 sm:text-xs lg:justify-start">
                <span className="inline-flex items-center rounded-full bg-violet-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm shadow-violet-500/40">
                  ¡Cupos limitados!
                </span>
                <span>
                  Los primeros en inscribirse aseguran{" "}
                  <strong className="font-semibold text-white">50% de descuento</strong> en su{" "}
                  <strong className="font-semibold text-white">primer contrato</strong> cuando
                  abramos la fase inicial.{" "}
                  <strong className="font-semibold text-white">Responde la encuesta y reserva tu beneficio.</strong>
                </span>
              </p>
            </section>
          </div>

          <div
            id="interes"
            className="min-h-0 scroll-mt-20 lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto lg:pr-1"
          >
            <LeadMarketForm sourcePage="landing_fase_inicial" />
          </div>
        </div>

        <footer className="mt-4 border-t border-slate-800/50 pt-4 text-center lg:mt-5 lg:pt-3">
          <p className="mx-auto max-w-3xl text-[10px] leading-relaxed text-slate-500 sm:text-[11px] lg:text-left">
            ArriendoSeguro no reemplaza una inmobiliaria ni una asesoría legal. Es una herramienta
            digital para ayudar a formalizar y documentar arriendos ya acordados entre
            particulares, de modo que cuentes con respaldo escrito y trazable si más adelante
            necesitas acudir por una vía legal o de conciliación.
          </p>
        </footer>
      </main>
    </div>
  );
}
