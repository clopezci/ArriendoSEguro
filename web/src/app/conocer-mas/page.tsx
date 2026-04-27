import { appConfig } from "@/lib/config";
import Link from "next/link";

export const metadata = {
  title: "Conocer más",
};

export default function ConocerMasPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-900 px-4 py-12 text-slate-100">
      <main className="mx-auto max-w-5xl space-y-8">
        <header className="space-y-3">
          <h1 className="text-3xl font-bold tracking-tight">
            Conocer más sobre <span className="text-violet-400">{appConfig.name}</span>
          </h1>
          <p className="max-w-3xl text-slate-300">
            Queremos democratizar el acceso a garantías y cumplimiento legal para protegerte de
            manera fácil y de bajo costo. Empezamos por lo esencial y seguimos creciendo contigo.
          </p>
        </header>

        <section className="grid gap-5 sm:grid-cols-2">
          <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-[0_12px_30px_rgba(139,92,246,0.22)]">
            <h2 className="text-lg font-semibold">Lo básico</h2>
            <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-slate-300">
              <li>Contrato de arrendamiento guiado</li>
              <li>Inventario del inmueble y actas</li>
              <li>Firma digital entre las partes</li>
              <li>Registro informativo de pagos</li>
            </ul>
          </article>
          <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-[0_12px_30px_rgba(139,92,246,0.22)]">
            <h2 className="text-lg font-semibold">Complementario</h2>
            <p className="mt-3 text-sm text-slate-300">
              Recordatorios, reportes, trazabilidad y herramientas para que no se pierda nada
              importante durante el arriendo.
            </p>
          </article>
          <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-[0_12px_30px_rgba(139,92,246,0.22)]">
            <h2 className="text-lg font-semibold">Extras con aliados</h2>
            <p className="mt-3 text-sm text-slate-300">
              Seguro de arrendamiento, gestión de cobranza, estudios legales y apoyo jurídico
              especializado, solo si tú decides tomar esos servicios.
            </p>
          </article>
          <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-[0_12px_30px_rgba(139,92,246,0.22)]">
            <h2 className="text-lg font-semibold">Lo que viene</h2>
            <p className="mt-3 text-sm text-slate-300">
              Módulos adicionales de reputación, recomendaciones, y más adelante marketplace y
              búsqueda para quienes también quieran publicar.
            </p>
          </article>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-[0_12px_30px_rgba(139,92,246,0.22)]">
          <h2 className="text-lg font-semibold">Quiénes somos y por qué lo hacemos</h2>
          <p className="mt-3 text-slate-300">
            Nacimos para que arrendar no sea un dolor de cabeza ni un privilegio costoso. Creemos
            que cada familia merece acuerdos claros, respaldo y herramientas simples para vivir con
            tranquilidad y construir confianza entre personas.
          </p>
        </section>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/"
            className="rounded-lg border border-slate-700 px-5 py-2.5 text-sm font-medium text-slate-200 shadow-[0_0_0_1px_rgba(139,92,246,0.28)] hover:border-violet-400 hover:text-violet-300"
          >
            Volver a landing
          </Link>
          <Link
            href="/dashboard"
            className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-medium text-white shadow-[0_0_18px_rgba(139,92,246,0.45)] hover:bg-violet-500"
          >
            Ir al panel principal
          </Link>
        </div>
      </main>
    </div>
  );
}
