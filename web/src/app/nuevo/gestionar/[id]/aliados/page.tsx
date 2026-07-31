"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { PartnersDirectory } from "@/components/partners/partners-directory";
import { PartnerCategoriesShowcase } from "@/components/partners/partner-categories-showcase";

/**
 * Aliados y servicios de terceros en estilo bento. Reusa el directorio funcional
 * (mismo componente y endpoints): al pulsar "Contactar" se crea un lead, se
 * envía al correo del aliado (configurado en /admin) y se lleva el control por
 * doble confirmación (token) para la conciliación de comisiones.
 */
export default function AliadosBentoPage() {
  const id = String(useParams<{ id: string }>().id);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#F5F3EF] text-[#17151F]">
      <div className="pointer-events-none absolute -right-20 -top-28 h-80 w-80 rounded-full opacity-40 blur-3xl" style={{ background: "radial-gradient(circle,#37D0E8,#3A7BFF)" }} />
      <div className="pointer-events-none absolute -bottom-28 -left-24 h-72 w-72 rounded-full opacity-40 blur-3xl" style={{ background: "radial-gradient(circle,#9B6BFF,#5646E5)" }} />

      <div className="relative z-10 mx-auto max-w-3xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <Link href={`/nuevo/gestionar/${id}`} className="text-sm font-semibold text-[#5646E5] hover:underline">← Gestionar</Link>
          <span className="rounded-full border border-slate-200 bg-white/70 px-3 py-1.5 text-xs text-slate-500">Aliados</span>
        </div>

        <h1 className="text-balance text-3xl font-extrabold tracking-tight">Aliados y servicios</h1>
        <p className="mt-2 text-slate-500">
          Servicios de terceros que tú decides tomar (seguro de arriendo, cobranza, estudio de crédito, jurídica…). Al
          contactar, le pasamos tus datos al aliado y llevamos el control de si tomaste o no el servicio.
        </p>

        <div className="mt-6">
          <PartnersDirectory />
        </div>

        {/* Categorías "Me interesa": siempre visibles (aunque aún no haya aliados
            configurados), para que el usuario vea qué servicios vienen y deje
            su interés. */}
        <div className="mt-8">
          <h2 className="text-lg font-extrabold tracking-tight">Próximamente, más aliados para cada necesidad</h2>
          <p className="mt-1 text-sm text-slate-500">Marca «Me interesa» y te avisamos cuando esté disponible; sin costo ni compromiso.</p>
          <div className="mt-4">
            <PartnerCategoriesShowcase />
          </div>
        </div>
      </div>
    </div>
  );
}
