"use client";

import { PartnersDirectory } from "@/components/partners/partners-directory";

export default function AliadosPage() {
  return (
    <main className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-violet-700">Aliados</p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Servicios de aliados</h1>
        <p className="max-w-2xl text-sm text-slate-600">
          Servicios opcionales de terceros que puedes tomar según tu necesidad: recaudo del canon, seguro de
          arrendamiento, estudio de crédito, mantenimiento y más. Tú decides; el aliado presta y cobra el servicio.
        </p>
      </header>
      <PartnersDirectory />
    </main>
  );
}
