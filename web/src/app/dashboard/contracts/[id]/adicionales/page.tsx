"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ExpedientePostWizardNav } from "@/components/contracts/expediente-post-wizard-nav";

/**
 * Centro de adicionales (Bloque 2).
 *
 * El Bloque 1 (asistente) captura lo mínimo para generar el contrato. Aquí se
 * configuran las opciones **opcionales**: codeudores, garantía de servicios,
 * cláusulas especiales, método de pago/recordatorios, notaría y documentos de
 * propiedad. Todo es a elección del usuario (salvo lo obligatorio por ley).
 */
const ADICIONALES = [
  {
    href: (id: string) => `/dashboard/contracts/${id}/codebtor`,
    title: "Codeudores",
    description: "Agrega uno o varios codeudores solidarios con sus datos y consentimientos.",
  },
  {
    href: (id: string) => `/dashboard/contracts/${id}/utilities`,
    title: "Garantía de servicios públicos (Art. 15)",
    description: "Única garantía permitida; su valor no excede dos períodos de facturación. Opcional.",
  },
  {
    href: (id: string) => `/dashboard/contracts/${id}/special-clauses`,
    title: "Cláusulas especiales",
    description: "Mascotas, parqueadero, mobiliario, teletrabajo y otras condiciones pactadas.",
  },
  {
    href: (id: string) => `/dashboard/contracts/${id}/pagos-recordatorios`,
    title: "Método de pago y recordatorios",
    description: "Comparte tu cuenta o QR (con tu autorización) para los recordatorios de pago al inquilino. Opcional.",
  },
  {
    href: (id: string) => `/dashboard/contracts/${id}/notarial`,
    title: "Autenticación notarial",
    description: "Constancia y carga del PDF autenticado en notaría (refuerzo a la firma).",
  },
  {
    href: (id: string) => `/dashboard/contracts/${id}/documentos-propiedad`,
    title: "Documentos de propiedad / poder",
    description: "Escritura, certificado de libertad o el poder autenticado si actúas como apoderado.",
  },
] as const;

export default function AdicionalesHubPage() {
  const id = String(useParams<{ id: string }>().id);

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-violet-700">Bloque 2</p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Centro de adicionales</h1>
        <p className="max-w-2xl text-sm text-slate-600">
          Lo esencial para tu contrato ya lo capturaste en el asistente. Aquí configuras lo opcional, a tu medida.
          Todo es a elección, excepto la información obligatoria por ley.
        </p>
      </header>

      <ExpedientePostWizardNav contractId={id} />

      <ul className="grid gap-3 sm:grid-cols-2">
        {ADICIONALES.map((item) => (
          <li key={item.title}>
            <Link
              href={item.href(id)}
              className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-[0_6px_20px_rgba(139,92,246,0.12)] transition hover:border-violet-400 hover:shadow-[0_10px_28px_rgba(139,92,246,0.2)]"
            >
              <span className="text-sm font-bold text-violet-900">{item.title}</span>
              <span className="mt-2 flex-1 text-xs leading-relaxed text-slate-600">{item.description}</span>
              <span className="mt-3 text-xs font-semibold text-violet-700">Configurar →</span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-3">
        <Link
          href={`/dashboard/contracts/${id}/review`}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-800 hover:border-violet-500"
        >
          ← Volver al resumen
        </Link>
        <Link
          href={`/dashboard/contracts/${id}/preview`}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white"
        >
          Ir a generar / firmar
        </Link>
      </div>
    </main>
  );
}
