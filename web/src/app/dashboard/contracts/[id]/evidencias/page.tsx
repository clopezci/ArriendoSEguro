"use client";

import { ExpedientePostWizardNav } from "@/components/contracts/expediente-post-wizard-nav";
import { WizardShell } from "@/components/contracts/wizard-shell";
import Link from "next/link";
import { useParams } from "next/navigation";

const HUB_ITEMS = [
  {
    href: (id: string) => `/dashboard/contracts/${id}/soportes-codeudor`,
    title: "Soportes del codeudor",
    description: "Carta laboral, colillas, extractos y otros PDF o imágenes de respaldo económico.",
  },
  {
    href: (id: string) => `/dashboard/contracts/${id}/documentos-propiedad`,
    title: "Documentos de propiedad / poder",
    description: "Escritura, certificado de libertad y tradición o el poder autenticado si actúas como apoderado.",
  },
  {
    href: (id: string) => `/dashboard/contracts/${id}/evidencia`,
    title: "Paquete de evidencia (ZIP)",
    description: "Descarga unificada de contrato, firmas, inventario, pagos y soportes cuando estén disponibles.",
  },
  {
    href: (id: string) => `/dashboard/contracts/${id}/notarial`,
    title: "Autenticación notarial",
    description: "Constancia y carga del PDF autenticado en notaría (opcional, refuerzo a la firma electrónica).",
  },
  {
    href: (id: string) => `/dashboard/contracts/${id}/payments`,
    title: "Registro de pagos",
    description: "Canon y pagos informativos, anexos y recordatorios del arriendo.",
  },
  {
    href: (id: string) => `/dashboard/contracts/${id}/inventory`,
    title: "Inventario y entrega",
    description: "Inventario fotográfico por zonas y acta de entrega del inmueble.",
  },
] as const;

export default function EvidenciasHubPage() {
  const id = String(useParams<{ id: string }>().id);

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <WizardShell title="Evidencias del expediente" currentStep={12} contractId={id} variant="extra">
        <p className="mb-4 text-sm text-slate-700">
          Aquí concentras contrato firmado, soportes del codeudor, paquete ZIP, notaría, pagos e inventario. No sustituye
          asesoría legal ni cobranza; es tu respaldo documental del arriendo.
        </p>
        <ExpedientePostWizardNav contractId={id} />
        <ul className="grid gap-3 sm:grid-cols-2">
          {HUB_ITEMS.map((item) => (
            <li key={item.title}>
              <Link
                href={item.href(id)}
                className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-[0_6px_20px_rgba(139,92,246,0.12)] transition hover:border-violet-400 hover:shadow-[0_10px_28px_rgba(139,92,246,0.2)]"
              >
                <span className="text-sm font-bold text-violet-900">{item.title}</span>
                <span className="mt-2 flex-1 text-xs leading-relaxed text-slate-600">{item.description}</span>
                <span className="mt-3 text-xs font-semibold text-violet-700">Abrir →</span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-sm text-slate-600">
          ¿Necesitas registrar un hecho durante el arriendo? Ve al{" "}
          <Link
            href={`/dashboard/contracts/${id}/novedades`}
            className="font-medium text-violet-700 underline"
            title="Ejemplos: mora en el canon, daños en el inmueble, solicitud de reparación, convivencia o acuerdos entre partes."
          >
            paso 13 — Novedades del arriendo
          </Link>
          .
        </p>
      </WizardShell>
    </div>
  );
}
