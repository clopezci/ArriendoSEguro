import { LeadMarketForm } from "@/components/forms/lead-market-form";
import { appConfig } from "@/lib/config";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-900 text-slate-100">
      <header className="border-b border-slate-800/80 bg-slate-950/90 shadow-[0_8px_30px_rgba(139,92,246,0.15)] backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <span className="text-lg font-semibold tracking-tight text-violet-400">{appConfig.name}</span>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link
              href="/entiendelo-facil"
              className="rounded-lg border border-violet-500 px-3 py-1.5 text-xs font-medium text-violet-200 shadow-[0_0_14px_rgba(139,92,246,0.35)] transition hover:bg-violet-900/30 sm:text-sm"
            >
              ¿Primera vez arrendando?
            </Link>
            <Link
              href="/ingresar"
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-100 shadow-[0_0_0_1px_rgba(139,92,246,0.28)] transition hover:border-slate-500 sm:text-sm"
            >
              Ingresar
            </Link>
            <a
              href="#interes"
              className="rounded-lg border border-slate-600 px-2.5 py-1 text-[11px] font-medium text-slate-400 shadow-[0_0_0_1px_rgba(139,92,246,0.15)] transition hover:border-violet-500/50 hover:text-violet-200"
            >
              Responder encuesta
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-10 px-4 py-10 sm:space-y-12 sm:px-6 sm:py-14">
        <section className="space-y-6 text-center sm:space-y-8">
          <h1 className="mx-auto max-w-2xl text-balance text-2xl font-extrabold leading-tight tracking-tight text-slate-50 sm:text-4xl">
            ¿Vas a arrendar tu propiedad, pero los costos de una agencia son altos y hacerlo
            directo no te da tranquilidad?
            <span className="mt-3 block text-violet-300">Llegaste al lugar adecuado.</span>
          </h1>
          <div className="mx-auto max-w-xl space-y-3 text-left text-sm leading-relaxed text-slate-300 sm:text-base">
            <p>
              Si ya encontraste arrendador o arrendatario, Arriendo Seguro te ayuda a crear
              contrato, firmar digitalmente, inventariar el inmueble y dejar soportes de pago y del
              acuerdo.
            </p>
            <p className="text-slate-400">
              A futuro podrás sumar, si quieres, alianzas con expertos en seguros, asesoría jurídica
              y cobranza.
            </p>
          </div>
          <p className="text-sm font-semibold text-violet-300 sm:text-base">
            Una guía digital para arrendar directo con más claridad y respaldo.
          </p>
          <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
            <a
              href="#interes"
              className="rounded-lg bg-violet-600 px-6 py-3 text-center text-sm font-semibold text-white shadow-[0_0_22px_rgba(139,92,246,0.45)] transition hover:bg-violet-500"
            >
              Responder encuesta
            </a>
            <Link
              href="/conocer-mas"
              className="rounded-lg border border-slate-600 px-6 py-3 text-center text-sm font-medium text-slate-200 shadow-[0_0_0_1px_rgba(139,92,246,0.25)] transition hover:border-sky-500 hover:text-sky-300"
            >
              Entender cómo funciona
            </Link>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-center text-lg font-semibold text-slate-100 sm:text-xl">
            Hoy, arrendar directo suele tener dos caminos
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <article className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-left shadow-[0_8px_22px_rgba(139,92,246,0.12)]">
              <h3 className="font-semibold text-sky-300">Pagar una inmobiliaria</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                Puede darte acompañamiento completo, pero no siempre es necesario si ya encontraste
                a la otra parte.
              </p>
            </article>
            <article className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-left shadow-[0_8px_22px_rgba(139,92,246,0.12)]">
              <h3 className="font-semibold text-sky-300">Hacerlo informal</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                Puede parecer más fácil, pero muchas veces deja contratos incompletos, pagos sin
                soporte o problemas al entregar el inmueble.
              </p>
            </article>
          </div>
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900/45 p-5 shadow-[0_10px_24px_rgba(139,92,246,0.14)] sm:p-6">
          <h2 className="text-lg font-semibold text-slate-100 sm:text-xl">
            Arriendo Seguro propone una tercera opción
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-300 sm:text-base">
            Una plataforma sencilla para formalizar un arriendo ya acordado entre particulares,
            con contrato, firma electrónica, inventario y registro de pagos.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-slate-200">
            <li className="flex gap-2">
              <span className="text-violet-400">·</span>
              Contrato más claro.
            </li>
            <li className="flex gap-2">
              <span className="text-violet-400">·</span>
              Inventario con evidencias.
            </li>
            <li className="flex gap-2">
              <span className="text-violet-400">·</span>
              Firma electrónica simple.
            </li>
            <li className="flex gap-2">
              <span className="text-violet-400">·</span>
              Soportes de pagos y acuerdos.
            </li>
          </ul>
        </section>

        <section className="space-y-4 rounded-xl border border-violet-500/30 bg-slate-900/55 p-5 text-center shadow-[0_12px_28px_rgba(139,92,246,0.18)] sm:p-6">
          <h2 className="text-lg font-semibold text-slate-50 sm:text-xl">Ayúdanos a construirlo bien</h2>
          <p className="mx-auto max-w-xl text-sm leading-relaxed text-slate-300 sm:text-base">
            Estamos validando esta idea con propietarios y arrendatarios reales. Responde una
            encuesta corta y ayúdanos a saber si esta solución te serviría, qué debería incluir y
            cuánto estarías dispuesto a pagar.
          </p>
          <p className="mx-auto max-w-lg text-xs font-medium text-violet-300 sm:text-sm">
            Los primeros inscritos podrán recibir acceso anticipado y beneficio de lanzamiento
            cuando abramos la prueba del MVP.
          </p>
          <a
            href="#interes"
            className="inline-flex rounded-lg bg-violet-600 px-8 py-3 text-sm font-semibold text-white shadow-[0_0_24px_rgba(139,92,246,0.45)] transition hover:bg-violet-500"
          >
            Responder encuesta
          </a>
        </section>

        <section id="interes" className="scroll-mt-6 space-y-3">
          <LeadMarketForm sourcePage="landing_mvp" />
        </section>

        <footer className="space-y-4 border-t border-slate-800/80 pt-8 text-center">
          <p className="mx-auto max-w-xl text-xs leading-relaxed text-slate-500 sm:text-sm">
            Arriendo Seguro no reemplaza una inmobiliaria ni una asesoría legal. Es una herramienta
            digital para ayudar a formalizar y documentar arriendos ya acordados entre particulares.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <a
              href="#interes"
              className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-medium text-white shadow-[0_0_18px_rgba(139,92,246,0.4)] transition hover:bg-violet-500"
            >
              Responder encuesta
            </a>
            <Link
              href="/entiendelo-facil"
              className="rounded-lg border border-violet-500 px-5 py-2.5 text-sm font-medium text-violet-200 shadow-[0_0_12px_rgba(139,92,246,0.25)] transition hover:bg-violet-900/30"
            >
              ¿Primera vez arrendando? Entiéndelo fácil
            </Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
