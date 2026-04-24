import { appConfig } from "@/lib/config";
import Link from "next/link";

export const metadata = {
  title: "Expediente",
};

const pasos = [
  {
    t: "Identificar a las partes",
    d: "Quién arrienda (arrendatario) y quién pone el inmueble (arrendador), con datos de contacto serios, sin inventar. Esto pasa por consentimiento bajo Habeas Data (Ley 1581) en Colombia.",
  },
  {
    t: "Describir el inmueble y el término",
    d: "Dirección en Colombia, tipo de vivienda, fechas de inicio y, si aplica, fin. El canon o valor del arriendo y frecuencia, en un lenguaje que no deje dudas.",
  },
  {
    t: "Guardar y firmar (cuando esté listo el borrador)",
    d: "Acá luego vamos a colgar un borrador, revisiones, y firma con registro, para que quede rastro y tranquilidad, sin reemplazar asesoría legal cuando toque abogado.",
  },
] as const;

export default function ExpedientePage() {
  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <p className="text-sm font-medium text-sky-700 dark:text-sky-300">Módulo 1 · en construcción</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Expediente del arriendo</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">
          Núcleo de {appConfig.name} en esta etapa. La idea es que tú y la otra parte queden
          enganchados al <strong>mismo expediente</strong>, con datos ordenados, antes de
          devanarte en papeles sueltos o chats de celular.
        </p>
      </div>

      <ol className="space-y-4">
        {pasos.map((p, i) => (
          <li
            key={p.t}
            className="rounded-xl border border-slate-200/90 bg-white p-4 dark:border-slate-700/90 dark:bg-slate-900/40"
          >
            <span className="text-xs font-medium uppercase text-slate-500">Paso {i + 1}</span>
            <h2 className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{p.t}</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{p.d}</p>
          </li>
        ))}
      </ol>

      <p className="rounded-lg border border-slate-200 bg-slate-50/90 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/30 dark:text-slate-300">
        <strong>Siguiente paso técnico (visión):</strong> conectar con Firestore un expediente por
        usuario o por invitación, validaciones, y registro de consentimientos. Si querés, en el
        próximo tramo bajamos esto a formularios reales.
      </p>

      <Link
        href="/panel"
        className="inline-block text-sm font-medium text-sky-600 hover:underline dark:text-sky-400"
      >
        ← Volver al panel
      </Link>
    </div>
  );
}
