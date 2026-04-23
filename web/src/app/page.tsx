import { LeadMarketForm } from "@/components/forms/lead-market-form";
import { appConfig, featureFlags } from "@/lib/config";
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
            MVP: formalizar arriendos acordados entre particulares (Colombia)
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-16 px-4 py-12 sm:px-6 sm:py-16">
        <section className="space-y-6 text-center sm:text-left">
          <p className="text-sm font-medium uppercase tracking-wide text-sky-700 dark:text-sky-300">
            Confianza con datos, no con rumores
          </p>
          <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            {appConfig.tagline}
          </h1>
          <p className="max-w-3xl text-lg text-slate-600 dark:text-slate-300">
            {appConfig.name} reúne contrato, inventario, firma con trazabilidad, registro de pagos
            (sin recaudo) y evaluación estructurada y privada. No sustituye asesoría legal; evita
            la asimetría de información y los errores más comunes bajo el marco de la Ley 820 de
            2003, datos personales (Ley 1581) y mensajes de datos (Ley 527), con diseño de
            gobernanza y auditoría.
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
            <h2 className="text-lg font-semibold">Problema</h2>
            <p className="mt-2 text-slate-600 dark:text-slate-300">
              Referencias cruzadas por WhatsApp, riesgo legal al difundir opiniones, direcciones
              y datos personales usados de forma poco cuidada. Poca estructura y cero
              trazabilidad.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/40">
            <h2 className="text-lg font-semibold">Propuesta (MVP)</h2>
            <p className="mt-2 text-slate-600 dark:text-slate-300">
              Un expediente digital para partes que ya se encontraron: se valida canon, se guían
              servicios públicos sin depósitos en dinero, se genera documentación y se deja
              trazabilidad. Sin listados públicos ni buscador por cédula en esta fase.
            </p>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-3" aria-label="Pasos básicos">
          {[
            { t: "1. Crear expediente", d: "Invita a la contraparte. Sin marketplace." },
            { t: "2. Datos y reglas leyes", d: "Tope de canon, IPC y depósito no permitido." },
            { t: "3. Documentos y cierre", d: "Inventario, actas, pagos y evaluación cerrada." },
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

        <section className="grid gap-6 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 dark:border-slate-700/80 dark:bg-slate-900/50">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Plan básico</h2>
            <ul className="mt-3 list-inside list-disc space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
              <li>Expediente de arriendo y partes</li>
              <li>Control legal de canon y reajuste (referencia)</li>
              <li>Contrato, inventario, actas, registro de pagos</li>
              <li>Firma con bitácora; evaluación estructurada privada</li>
            </ul>
            <p className="mt-3 text-xs text-slate-500">Precio: por definir comercialmente.</p>
          </div>
          <div className="rounded-2xl border border-sky-200/80 bg-sky-50/80 p-6 dark:border-sky-800/50 dark:bg-sky-950/30">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Plan premium (próximo)</h2>
            <ul className="mt-3 list-inside list-disc space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
              <li>Recordatorios y notificaciones ampliadas</li>
              <li>Trazas ampliadas y reportes</li>
              <li>Refuerzo de firma / OTP reforzado (sin SMS masivo al inicio)</li>
            </ul>
            <p className="mt-3 text-xs text-slate-500">Adicionales: aliados seguros, cobranza, verificación, etc.</p>
          </div>
        </section>

        {!featureFlags.marketplaceAndListing && (
          <p className="text-center text-sm text-amber-800 dark:text-amber-200/90">
            Publicación pública, marketplace y búsqueda: desactivado en arquitectura de esta fase.
          </p>
        )}

        <section id="interes" className="scroll-mt-8">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Tu opinión nos guía</h2>
          <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-300">
            Necesitamos validar interés, precio percibido y módulo más valioso. Seis preguntas; correo
            opcional.
          </p>
          <LeadMarketForm />
        </section>
      </main>

      <footer className="mt-4 border-t border-slate-200/80 py-8 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
        <p>
          {appConfig.name} — &quot;No vendemos opiniones: construimos una infraestructura de
          confianza con datos mínimos, consentimiento y trazabilidad.&quot;
        </p>
        <p className="mt-2 max-w-3xl mx-auto">
          Aviso: la plataforma no constituye asesoría jurídica. Las reglas de negocio replican
          lineamientos del negocio y deben ser validadas con abogado y normas vigentes. El MVP no
          recauda pagos de arriendo; solo apoya a formalizar y a registrar soportes.
        </p>
      </footer>
    </div>
  );
}
