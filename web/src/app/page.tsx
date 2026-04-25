import { LeadMarketForm } from "@/components/forms/lead-market-form";
import { appConfig } from "@/lib/config";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-900 text-slate-100">
      <header className="border-b border-slate-800/80 bg-slate-950/90 shadow-[0_8px_30px_rgba(139,92,246,0.15)] backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <span className="text-lg font-semibold tracking-tight text-violet-400">
            {appConfig.name}
          </span>
          <div className="flex flex-1 items-center justify-end gap-2 sm:gap-3">
            <span className="hidden text-xs text-slate-400 sm:block sm:max-w-md sm:text-right">
              Dejar en claro un contrato de arrendamiento entre personas, en Colombia, sin enredos.
            </span>
            <Link
              href="/panel"
              className="shrink-0 rounded-lg border border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-200 shadow-[0_0_0_1px_rgba(139,92,246,0.28)] transition hover:border-violet-400 hover:text-violet-300"
            >
              Ir al menú inicio
            </Link>
            <Link
              href="/entiendelo-facil"
              className="shrink-0 rounded-lg border border-violet-500 px-3 py-1.5 text-sm font-medium text-violet-200 shadow-[0_0_14px_rgba(139,92,246,0.35)] transition hover:bg-violet-900/30"
            >
              ¿Primera vez arrendando? Entiéndelo fácil
            </Link>
            <a
              href="#interes"
              className="shrink-0 rounded-lg border border-violet-500 px-3 py-1.5 text-sm font-medium text-violet-200 shadow-[0_0_18px_rgba(139,92,246,0.35)] transition hover:bg-violet-900/30"
            >
              Inscribirse ahora
            </a>
            <Link
              href="/ingresar"
              className="shrink-0 rounded-lg bg-sky-700 px-3 py-1.5 text-sm font-medium text-white shadow-[0_0_18px_rgba(56,189,248,0.35)] transition hover:bg-sky-600"
            >
              Ingresar
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-10 px-4 py-8 sm:px-6 sm:py-10">
        <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-[0_14px_34px_rgba(139,92,246,0.2)]">
          <div className="space-y-3">
            <h1 className="max-w-3xl text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
              {appConfig.tagline}
            </h1>
            <p className="text-sm font-semibold uppercase tracking-wide text-sky-300">
              Menos dudas, más tranquilidad
            </p>
            <p className="max-w-3xl text-sm leading-relaxed text-slate-300 sm:text-base">
              Ayudamos a crear tu contrato con pocos datos y en pocos pasos, guiamos inventario,
              facilitamos firma digital y registro de pagos, entre otros.
            </p>
            <p className="max-w-3xl text-sm leading-relaxed text-slate-400 sm:text-base">
              También puedes sumar opciones con aliados si lo decides o lo requieres: seguro,
              cobranza y apoyo legal. No reemplazamos al abogado cuando haga falta, pero te damos
              un camino fácil y seguro para seguir.
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              <a
                href="#interes"
                className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-medium text-white shadow-[0_0_20px_rgba(139,92,246,0.45)] transition hover:bg-violet-500"
              >
                Inscribirse ahora
              </a>
              <Link
                href="/conocer-mas"
                className="rounded-lg border border-slate-700 px-5 py-2.5 text-sm font-medium text-slate-200 shadow-[0_0_0_1px_rgba(139,92,246,0.28)] transition hover:border-sky-500 hover:text-sky-300"
              >
                Conocer más
              </Link>
              <Link
                href="/entiendelo-facil"
                className="rounded-lg border border-violet-500 px-5 py-2.5 text-sm font-medium text-violet-200 shadow-[0_0_14px_rgba(139,92,246,0.35)] transition hover:bg-violet-900/30"
              >
                ¿Primera vez arrendando? Entiéndelo fácil
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-[0_10px_24px_rgba(139,92,246,0.18)]">
            <h2 className="text-xl font-semibold">Lo que pasa hoy</h2>
            <p className="mt-2 text-slate-300">
              Si hoy quieres arrendar tu propiedad tienes dos caminos: buscas una agencia con los
              costos mensuales que eso implica, o te arriesgas a hacerlo directo con el estrés de no
              tener garantías suficientes.
            </p>
          </article>
          <article className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-[0_10px_24px_rgba(139,92,246,0.18)]">
            <h2 className="text-xl font-semibold">En qué te apoyaremos</h2>
            <p className="mt-2 text-slate-300">
              Una guía fácil de seguir entre las partes, con pocos pasos, que te permitirá tener
              soporte y trazabilidad, y te dará alternativas profesionales adicionales si decides
              elegirlas cuando las necesites.
            </p>
          </article>
        </section>

        <section className="flex flex-col items-start gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-[0_10px_24px_rgba(139,92,246,0.18)]">
          <p className="text-sm text-slate-300">
            ¿Quieres conocer el detalle completo de lo que incluye hoy y lo que viene después?
          </p>
          <Link
            href="/conocer-mas"
            className="inline-flex items-center justify-center rounded-lg bg-sky-700 px-6 py-2.5 text-sm font-medium text-white shadow-[0_0_18px_rgba(56,189,248,0.35)] transition hover:bg-sky-600"
          >
            Conocer más
          </Link>
        </section>

        <section id="interes" className="scroll-mt-8">
          <h2 className="text-2xl font-bold text-slate-100">Tu opinión nos guía</h2>
          <p className="mt-2 max-w-2xl text-slate-300">
            Responde esta encuesta y ayúdanos a simplificar el arriendo para todos.
          </p>
          <LeadMarketForm sourcePage="landing" />
        </section>
      </main>
    </div>
  );
}
