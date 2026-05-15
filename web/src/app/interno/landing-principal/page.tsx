/**
 * Landing comercial (no enlazada desde el sitio público).
 * Ver instrucciones en README del equipo o pedir la URL a quien administra el proyecto.
 */
import { LeadMarketForm } from "@/components/forms/lead-market-form";
import { appConfig } from "@/lib/config";
import Link from "next/link";

export default function LandingPrincipalInterna() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-300 bg-slate-100/90 shadow-[0_8px_30px_rgba(139,92,246,0.15)] backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <span className="text-lg font-semibold tracking-tight text-violet-400">
            {appConfig.name}
          </span>
          <div className="flex items-center justify-end gap-2 sm:gap-3">
            <Link
              href="/entiendelo-facil"
              className="shrink-0 rounded-lg border border-violet-500 px-3 py-1.5 text-sm font-medium text-violet-700 shadow-[0_0_14px_rgba(139,92,246,0.35)] transition hover:bg-violet-100/30 sm:px-4"
            >
              ¿Primera vez arrendando?
            </Link>
            <Link
              href="/ingresar"
              className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-900 shadow-[0_0_0_1px_rgba(139,92,246,0.28)] transition hover:border-slate-500 sm:px-4"
            >
              Ingresar
            </Link>
            <Link
              href="/registro"
              className="shrink-0 rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white shadow-[0_0_18px_rgba(139,92,246,0.35)] transition hover:bg-violet-500 sm:px-4"
            >
              Inscribirme
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:space-y-10 sm:px-6 sm:py-10">
        <section className="space-y-5 rounded-2xl border border-slate-300 bg-white/95 p-6 shadow-[0_14px_34px_rgba(139,92,246,0.2)] sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">
            Arriendos entre particulares en Colombia
          </p>
          <h1 className="max-w-4xl text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            Formaliza tu arriendo sin inmobiliaria y sin hacerlo informal
          </h1>
          <p className="max-w-3xl text-base leading-relaxed text-slate-700 sm:text-lg">
            Si ya encontraste arrendador o arrendatario, Arriendo Seguro te guía para crear
            contrato, firmar, inventariar el inmueble y dejar soportes del acuerdo.
          </p>
          <p className="text-sm font-semibold text-violet-700 sm:text-base">
            Contrato + firma + inventario + pagos, en un solo flujo.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Link
              href="/registro"
              className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-medium text-white shadow-[0_0_20px_rgba(139,92,246,0.45)] transition hover:bg-violet-500"
            >
              Quiero acceso temprano
            </Link>
            <Link
              href="/conocer-mas"
              className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-800 shadow-[0_0_0_1px_rgba(139,92,246,0.28)] transition hover:border-sky-500 hover:text-sky-700"
            >
              Ver cómo funciona
            </Link>
            <Link
              href="/entiendelo-facil"
              className="rounded-lg border border-violet-500 px-5 py-2.5 text-sm font-medium text-violet-700 shadow-[0_0_14px_rgba(139,92,246,0.35)] transition hover:bg-violet-100/30"
            >
              Soy nuevo arrendando
            </Link>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-300 bg-white/95 p-5 shadow-[0_10px_24px_rgba(139,92,246,0.18)] sm:p-6">
          <h2 className="text-xl font-semibold sm:text-2xl">
            Arrendar directo puede salir bien… si queda bien documentado
          </h2>
          <p className="mt-2 max-w-4xl text-slate-700">
            Muchas personas arriendan directamente para evitar costos altos, pero terminan con
            contratos incompletos, acuerdos verbales, pagos sin soporte o problemas al entregar el
            inmueble.
          </p>
          <ul className="mt-4 grid gap-2 text-sm text-slate-800 sm:grid-cols-2">
            <li className="rounded-lg border border-slate-300 bg-slate-100/60 px-3 py-2">
              Contratos incompletos.
            </li>
            <li className="rounded-lg border border-slate-300 bg-slate-100/60 px-3 py-2">
              Falta de inventario.
            </li>
            <li className="rounded-lg border border-slate-300 bg-slate-100/60 px-3 py-2">
              Pagos sin trazabilidad.
            </li>
            <li className="rounded-lg border border-slate-300 bg-slate-100/60 px-3 py-2">
              Dudas sobre servicios públicos.
            </li>
            <li className="rounded-lg border border-slate-300 bg-slate-100/60 px-3 py-2 sm:col-span-2">
              Riesgos al finalizar el contrato.
            </li>
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-300 bg-white/95 p-5 shadow-[0_10px_24px_rgba(139,92,246,0.18)] sm:p-6">
          <h2 className="text-xl font-semibold sm:text-2xl">Nosotros te guiamos paso a paso</h2>
          <p className="mt-2 max-w-4xl text-slate-700">
            Con pocos datos, la plataforma te ayuda a formalizar el arriendo con documentos,
            evidencias y controles básicos para reducir riesgos.
          </p>
          <ul className="mt-4 grid gap-2 text-sm text-slate-800 sm:grid-cols-2 lg:grid-cols-3">
            <li className="rounded-lg border border-slate-300 bg-slate-100/60 px-3 py-2">
              Contrato automático.
            </li>
            <li className="rounded-lg border border-slate-300 bg-slate-100/60 px-3 py-2">
              Opción con o sin codeudor.
            </li>
            <li className="rounded-lg border border-slate-300 bg-slate-100/60 px-3 py-2">
              Firma electrónica simple.
            </li>
            <li className="rounded-lg border border-slate-300 bg-slate-100/60 px-3 py-2">
              Inventario guiado con fotos.
            </li>
            <li className="rounded-lg border border-slate-300 bg-slate-100/60 px-3 py-2">
              Registro de pagos con soporte.
            </li>
            <li className="rounded-lg border border-slate-300 bg-slate-100/60 px-3 py-2">
              Recordatorios de vencimiento.
            </li>
            <li className="rounded-lg border border-slate-300 bg-slate-100/60 px-3 py-2 sm:col-span-2 lg:col-span-3">
              Evaluación estructurada de la experiencia.
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold sm:text-2xl">
            Una tercera opción entre inmobiliaria e informalidad
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            <article className="rounded-2xl border border-slate-300 bg-white/95 p-5 shadow-[0_10px_24px_rgba(139,92,246,0.18)]">
              <h3 className="text-lg font-semibold text-sky-700">Inmobiliaria</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">
                Acompañamiento completo, pero con costos asociados y servicios que no siempre
                necesitas si ya encontraste a la otra parte.
              </p>
            </article>
            <article className="rounded-2xl border border-slate-300 bg-white/95 p-5 shadow-[0_10px_24px_rgba(139,92,246,0.18)]">
              <h3 className="text-lg font-semibold text-sky-700">Informal</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">
                Más rápido y barato al inicio, pero con menos soportes si aparece un problema.
              </p>
            </article>
            <article className="rounded-2xl border border-violet-500 bg-white/95 p-5 shadow-[0_10px_26px_rgba(139,92,246,0.25)]">
              <h3 className="text-lg font-semibold text-violet-700">Arriendo Seguro</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-800">
                Una guía digital de bajo costo para formalizar el acuerdo que ya hiciste, con
                contrato, firma, inventario y trazabilidad.
              </p>
            </article>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-300 bg-white/95 p-5 shadow-[0_10px_24px_rgba(139,92,246,0.18)] sm:p-6">
          <h2 className="text-xl font-semibold sm:text-2xl">
            Ayúdanos a construir la primera versión
          </h2>
          <p className="mt-2 max-w-4xl text-slate-700">
            Estamos validando Arriendo Seguro con propietarios y arrendatarios reales. Tu opinión
            nos ayuda a ajustar el producto, el precio y las funciones más importantes.
          </p>
          <p className="mt-2 text-sm font-medium text-violet-700">
            Los primeros usuarios registrados podrán recibir acceso preferencial y beneficios de
            lanzamiento cuando activemos el Plan Plus.
          </p>
          <a
            href="#interes"
            className="mt-4 inline-flex rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-medium text-white shadow-[0_0_20px_rgba(139,92,246,0.45)] transition hover:bg-violet-500"
          >
            Responder encuesta
          </a>
        </section>

        <section
          id="interes"
          className="scroll-mt-8 rounded-2xl border border-slate-300 bg-white/95 p-5 shadow-[0_10px_24px_rgba(139,92,246,0.18)] sm:p-6"
        >
          <h2 className="text-2xl font-bold text-slate-900">Tu opinión nos guía</h2>
          <p className="mt-2 max-w-2xl text-slate-700">
            Responde estas preguntas en menos de 2 minutos y ayúdanos a simplificar el arriendo
            entre particulares.
          </p>
          <div className="mt-4">
            <LeadMarketForm sourcePage="landing_comercial_interno" />
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold sm:text-2xl">Planes</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <article className="rounded-2xl border border-slate-300 bg-white/65 p-4 shadow-[0_10px_24px_rgba(139,92,246,0.18)]">
              <h3 className="text-lg font-semibold">Plan Básico Demo</h3>
              <p className="mt-1 text-violet-700">Gratis</p>
              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                <li>Explora cómo funciona.</li>
                <li>Documentos de ejemplo con marca de agua.</li>
                <li>No genera contratos reales.</li>
              </ul>
              <Link
                href="/dashboard/plans"
                className="mt-3 inline-flex rounded bg-violet-600 px-3 py-2 text-sm text-white shadow-[0_0_16px_rgba(139,92,246,0.35)] transition hover:bg-violet-500"
              >
                Probar demo
              </Link>
            </article>
            <article className="rounded-2xl border border-violet-300 bg-white/95 p-4 shadow-[0_10px_24px_rgba(139,92,246,0.25)]">
              <h3 className="text-lg font-semibold">Plan Plus</h3>
              <p className="mt-1 text-violet-700">
                <span className="text-slate-500 line-through">$89.900</span>{" "}
                <span className="font-semibold">$49.900 COP</span> (primeros inscritos)
              </p>
              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                <li>Pago único por contrato gestionado en la plataforma.</li>
                <li>Sin mensualidades.</li>
                <li>Contrato, firma, inventario, acta, pagos y recordatorios.</li>
              </ul>
              <Link
                href="/registro"
                className="mt-3 inline-flex rounded bg-violet-600 px-3 py-2 text-sm text-white shadow-[0_0_16px_rgba(139,92,246,0.35)] transition hover:bg-violet-500"
              >
                Activar cuando esté disponible
              </Link>
            </article>
            <article className="rounded-2xl border border-slate-300 bg-white/65 p-4 shadow-[0_10px_24px_rgba(139,92,246,0.18)]">
              <h3 className="text-lg font-semibold">Plan Premium</h3>
              <p className="mt-1 text-violet-700">Próximamente</p>
              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                <li>Aliados para seguros, garantías, cobranza y asesoría jurídica.</li>
              </ul>
              <button
                type="button"
                disabled
                className="mt-3 cursor-not-allowed rounded border border-slate-300 px-3 py-2 text-sm text-slate-600"
              >
                Próximamente
              </button>
            </article>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-300 bg-white/95 p-5 shadow-[0_10px_24px_rgba(139,92,246,0.18)] sm:p-6">
          <h2 className="text-xl font-semibold sm:text-2xl">Lo que Arriendo Seguro no hace</h2>
          <p className="mt-2 max-w-5xl text-slate-700">
            Para ser claros: Arriendo Seguro no es una inmobiliaria, no recauda cánones, no
            garantiza pagos, no reemplaza asesoría legal y no publica listas negras. Es una
            herramienta digital para formalizar y documentar arriendos ya acordados.
          </p>
        </section>

        <section className="rounded-2xl border border-violet-300 bg-white/95 p-6 text-center shadow-[0_14px_34px_rgba(139,92,246,0.2)]">
          <h2 className="text-2xl font-bold sm:text-3xl">
            ¿Ya encontraste arrendador o arrendatario?
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-slate-700">
            Formaliza el acuerdo con más claridad, soporte y tranquilidad.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <a
              href="#interes"
              className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-medium text-white shadow-[0_0_20px_rgba(139,92,246,0.45)] transition hover:bg-violet-500"
            >
              Responder encuesta
            </a>
            <Link
              href="/dashboard/plans"
              className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-800 shadow-[0_0_0_1px_rgba(139,92,246,0.28)] transition hover:border-sky-500 hover:text-sky-700"
            >
              Probar demo
            </Link>
            <Link
              href="/ingresar"
              className="rounded-lg border border-violet-500 px-5 py-2.5 text-sm font-medium text-violet-700 shadow-[0_0_14px_rgba(139,92,246,0.35)] transition hover:bg-violet-100/30"
            >
              Ingresar
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
