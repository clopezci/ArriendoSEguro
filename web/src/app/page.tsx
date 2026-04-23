import { LeadMarketForm } from "@/components/forms/lead-market-form";
import { appConfig } from "@/lib/config";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900 dark:from-slate-950 dark:to-slate-900 dark:text-slate-100">
      <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur dark:border-slate-800/80 dark:bg-slate-950/70">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <span className="text-lg font-semibold tracking-tight text-slate-800 dark:text-white">
            {appConfig.name}
          </span>
          <span className="hidden text-xs text-slate-500 sm:block">
            Dejar en claro un arriendo entre personas, en Colombia, sin enredos
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-16 px-4 py-12 sm:px-6 sm:py-16">
        <section className="space-y-6 text-center sm:text-left">
          <p className="text-sm font-medium uppercase tracking-wide text-sky-700 dark:text-sky-300">
            Menos dudas, más tranquilidad
          </p>
          <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            {appConfig.tagline}
          </h1>
          <p className="max-w-3xl text-lg text-slate-600 dark:text-slate-300">
            Aquí te ayudamos a poner negro sobre blanco lo que a veces queda en dichos, fotos o
            mensajes sueltos: el acuerdo de arriendo, el inventario de la vivienda, la firma y
            un registro ordenado. No reemplazamos al abogado cuando haga falta; te damos un camino
            claro y serio, con cuidado por tus datos personales.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="#interes"
              className="inline-flex items-center justify-center rounded-lg bg-sky-600 px-6 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-sky-700"
            >
              Quiero dejar mis respuestas
            </Link>
            <a
              href="#como-funciona"
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-5 py-3 text-sm font-medium text-slate-800 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-100 dark:hover:border-slate-500 dark:hover:bg-slate-800/60"
            >
              Ver cómo funciona
            </a>
          </div>
        </section>

        <section className="grid gap-6 sm:grid-cols-2" id="como-funciona">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/40">
            <h2 className="text-lg font-semibold">Lo que pasa hoy, sin ayuda</h2>
            <p className="mt-2 text-slate-600 dark:text-slate-300">
              Mucha gente arrienda con miedo: no sabe si puede confiar en la otra persona, si el
              pago se va a cumplir o si, al final, el estrés pasa factura. Las “referencias” vuelan
              por celular y grupos, sin un lugar único y tranquilo para ordenar la información.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/40">
            <h2 className="text-lg font-semibold">Qué buscamos hacer por ti (primer paso)</h2>
            <p className="mt-2 text-slate-600 dark:text-slate-300">
              Que tú y la otra parte —quien pone el inmueble y quien lo ocupa— puedan bajar a
              escrito el acuerdo, con inventario, firmas y un seguimiento claro, sin perderse en
              papeles sueltos. <strong>Esta etapa</strong> nace para quienes ya se encontraron: no
              hace falta anunciar la casa al mundo; lo importante es formalizar con orden y respeto.
            </p>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-3" aria-label="Pasos sencillos">
          {[
            {
              t: "1. Un mismo trámite para las dos partes",
              d: "Cada quien entra a su debido lugar en la plataforma: tú y la otra persona quedan vinculados al mismo expediente, sin poner el inmueble en un tablero público de internet.",
            },
            {
              t: "2. Números y acordados que hacen sentido",
              d: "Te orientamos para que el valor del arriendo y lo que se pacte encaje con reglas de vivienda en Colombia, de forma sencilla de entender, para evitar sorpresas desagradables.",
            },
            {
              t: "3. Documentos, inventario y cierre con calma",
              d: "Puedes avanzar hacia documentos, inventario con fotos si aplica, anotar pagos (sin manejar el dinero por la app) y, al cierre, una opinión estructurada y privada.",
            },
          ].map((s) => (
            <div
              key={s.t}
              className="rounded-xl border border-slate-200/60 bg-slate-50/80 p-4 dark:border-slate-700/60 dark:bg-slate-900/30"
            >
              <h3 className="font-medium text-slate-900 dark:text-slate-100">{s.t}</h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{s.d}</p>
            </div>
          ))}
        </section>

        <details className="mx-auto max-w-3xl rounded-2xl border border-slate-200/80 bg-slate-50/90 p-4 text-sm text-slate-600 open:bg-slate-50 dark:border-slate-700/80 dark:bg-slate-900/40 dark:text-slate-300 dark:open:bg-slate-900/30">
          <summary className="cursor-pointer list-none font-medium text-slate-800 after:ml-2 after:text-sky-600 after:content-['▼'] open:after:content-['▲'] dark:text-slate-200">
            ¿Te interesa el detalle de cómo se construye el producto? (técnico, sin prisa)
          </summary>
          <p className="mt-3 leading-relaxed">
            En fases venideras se irán sumando módulos con más automatización, validaciones
            alineadas a la norma colombiana, estándar de direcciones, escala, seguridad reforzada
            (OWASP) y, cuando aplique, integraciones. Lo que ves hoy es la base para crecer sin
            rehacer lo esencial. Si esto suena a palabras raras, no te preocupes: la app irá
            explicada en lenguaje humano a medida que avance.
          </p>
        </details>

        <section className="space-y-6">
          <h2 className="text-center text-2xl font-bold text-slate-900 dark:text-slate-50 sm:text-left">
            Qué incluye
          </h2>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 dark:border-slate-700/80 dark:bg-slate-900/50">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Lo esencial (hilo conductor del producto)
              </h3>
              <ul className="mt-3 list-inside list-disc space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
                <li>Expediente de arriendo y datos de quien pone y quien toma el inmueble</li>
                <li>Orientación en lo monetario y en los acuerdos según vivienda</li>
                <li>Contrato, inventario, actas, registro de lo pagado (sin recibir dinero en la app)</li>
                <li>Firma y registro; al final, una evaluación privada, sin “muro de chismes”</li>
              </ul>
              <p className="mt-3 text-xs text-slate-500">El precio de este paquete lo iremos fijando con claridad.</p>
            </div>
            <div className="rounded-2xl border border-sky-200/80 bg-sky-50/80 p-6 dark:border-sky-800/50 dark:bg-sky-950/30">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Complementos (para quien quiera ir un paso más allá)
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Recordatorios, más avisos, reportes descargables y otras ayudas para no perder
                fechas. Lo iremos dejando listo poco a poco.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/70 p-6 dark:border-emerald-800/50 dark:bg-emerald-950/20">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Extras con aliados (cuando tengamos convenio con terceros de confianza)
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Más adelante podrás, si tú quieres, acercar a la mesa: seguro de arriendo, acompañamiento
              en cobros, revisión o estudios legales, firma digital o electrónica con apoyo
              especializado, y otras posibilidades que cierren con entidades serias. Nada de esto
              te obliga desde el primer día: primero el núcleo sencillo, luego tú eliges qué
              sumar.
            </p>
          </div>
        </section>

        <div className="rounded-2xl border border-dashed border-amber-300/80 bg-amber-50/60 p-5 text-center text-sm text-amber-950 dark:border-amber-700/50 dark:bg-amber-950/25 dark:text-amber-100/90">
          <p className="font-medium">Próximamente, en construcción</p>
          <p className="mt-2 max-w-2xl mx-auto text-amber-900/90 dark:text-amber-100/80">
            En el futuro queremos ofrecer también formas de publicar y comparar inmuebles, y otras
            herramientas de búsqueda. Aún no están listas: preferimos entregar bien lo de adentro
            antes de abrir un escaparate grande. Te iremos contando.
          </p>
        </div>

        <section id="interes" className="scroll-mt-8">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Tu opinión nos guía</h2>
          <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-300">
            Seis preguntas; correo opcional. Con eso afinamos el producto para personas como tú.
          </p>
          <LeadMarketForm />
        </section>
      </main>

      <footer className="mt-4 border-t border-slate-200/80 py-8 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
        <p>
          {appConfig.name} — &quot;No vendemos opiniones: ayudamos a que la confianza se apoye en
          datos claros, con tu permiso y un registro responsable.&quot;
        </p>
        <p className="mt-2 max-w-3xl mx-auto">
          La plataforma no sustituye un abogado cuando la situación lo requiera. Trabajamos con
          criterios de ley y de buen uso de la información, sin cobrar en la app el dinero del
          canon del arriendo.
        </p>
      </footer>
    </div>
  );
}
