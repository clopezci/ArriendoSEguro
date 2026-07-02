"use client";

import { PartnersDirectory } from "@/components/partners/partners-directory";
import { PartnerCategoriesShowcase } from "@/components/partners/partner-categories-showcase";

export default function AliadosPage() {
  return (
    <main className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-violet-700">Aliados y terceros</p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Servicios de aliados</h1>
        <p className="max-w-2xl text-sm text-slate-600">
          Servicios opcionales de terceros que puedes tomar según tu necesidad. Tú decides; el aliado presta y cobra el
          servicio.
        </p>
      </header>

      {/* Directorio real (aliados configurados). Si no hay, muestra su propio aviso. */}
      <PartnersDirectory />

      {/* Categorías con botones grandes: "Me interesa" llega al fundador (mock) hasta
          configurar los aliados reales. */}
      <PartnerCategoriesShowcase />
    </main>
  );
}
