const STEPS = [
  {
    title: "Arma tu expediente",
    description: "Quién diligencia, y datos del dueño, el inmueble, el inquilino y el codeudor, en un solo flujo.",
  },
  {
    title: "Condiciones del contrato",
    description: "Canon con tope legal, método de pago, fechas, servicios, cláusulas y documentos de soporte.",
  },
  {
    title: "Revisión y vista previa",
    description: "Revisas todos los datos y ves el contrato completo antes de firmar.",
  },
  {
    title: "Firma de las partes",
    description: "Firma electrónica simple con evidencia y trazabilidad para cada firmante (Ley 527).",
  },
  {
    title: "Acta de entrega e inventario",
    description: "Inventario fotográfico por zonas y acta de entrega que se envía a ambas partes.",
  },
] as const;

export function LandingStepsSection() {
  return (
    <section aria-labelledby="pasos-heading" className="space-y-4">
      <h2
        id="pasos-heading"
        className="text-center text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl lg:text-left"
      >
        Hazlo en <span className="text-violet-700">5 sencillos pasos</span>
      </h2>
      <p className="text-center text-sm leading-relaxed text-slate-600 lg:text-left">
        Un solo recorrido guiado, del 1 al 5. Después, gestionas el arriendo (pagos, novedades y calificación) cuando lo
        necesites.
      </p>
      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {STEPS.map((step, index) => (
          <li
            key={step.title}
            aria-label={`Paso ${index + 1} de 5: ${step.title}`}
            className="flex min-h-[7.5rem] flex-col rounded-xl border border-violet-300/80 bg-white p-4 shadow-[0_8px_28px_rgba(139,92,246,0.16)] transition hover:border-violet-400 hover:shadow-[0_12px_32px_rgba(139,92,246,0.22)]"
          >
            <span className="mb-2 text-[11px] font-bold uppercase tracking-wider text-violet-600">
              Paso {index + 1} de 5
            </span>
            <span
              aria-hidden
              className="mb-3 inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-violet-500 text-2xl font-black text-white shadow-[0_4px_14px_rgba(124,58,237,0.45)]"
            >
              {index + 1}
            </span>
            <h3 className="text-base font-bold leading-snug text-slate-900">{step.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{step.description}</p>
          </li>
        ))}
        {/* Posventa: sin número */}
        <li className="flex min-h-[7.5rem] flex-col rounded-xl border border-dashed border-emerald-400/80 bg-emerald-50/60 p-4 shadow-sm">
          <span className="mb-2 text-[11px] font-bold uppercase tracking-wider text-emerald-700">Después · sin pasos</span>
          <span
            aria-hidden
            className="mb-3 inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-500 text-2xl font-black text-white shadow-[0_4px_14px_rgba(16,185,129,0.4)]"
          >
            ★
          </span>
          <h3 className="text-base font-bold leading-snug text-slate-900">Gestiona tu arriendo</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
            Pagos y recordatorios, novedades y calificación de la experiencia, cuando lo necesites.
          </p>
        </li>
      </ol>
    </section>
  );
}
