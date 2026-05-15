const STEPS = [
  {
    title: "Arma tu expediente",
    description: "Datos del arrendador, arrendatario, inmueble y condiciones del canon en un solo flujo.",
  },
  {
    title: "Revisa tu contrato",
    description: "Vista previa con plantilla para vivienda urbana antes de comprometerte a firmar.",
  },
  {
    title: "Firma con las dos partes",
    description: "Firma electrónica simple con evidencia y trazabilidad para cada firmante.",
  },
  {
    title: "Documenta la entrega",
    description: "Inventario fotográfico por zonas y acta de entrega del inmueble.",
  },
  {
    title: "Califica la experiencia",
    description:
      "Al cerrar el arriendo, las partes pueden dejar una evaluación estructurada. Si construimos comunidad con el tiempo, tendrás más contexto para decidir con quién arrendar — sin sustituir tu propia diligencia.",
  },
  {
    title: "Lleva el control",
    description: "Registro de pagos, recordatorios y respaldo documental del arriendo.",
  },
] as const;

export function LandingStepsSection() {
  return (
    <section aria-labelledby="pasos-heading" className="space-y-4">
      <h2
        id="pasos-heading"
        className="text-center text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl lg:text-left"
      >
        Hazlo en{" "}
        <span className="text-violet-700">{STEPS.length} sencillos pasos</span>
      </h2>
      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {STEPS.map((step, index) => (
          <li
            key={step.title}
            className="flex min-h-[7.5rem] flex-col rounded-xl border border-violet-300/80 bg-white p-4 shadow-[0_8px_28px_rgba(139,92,246,0.16)] transition hover:border-violet-400 hover:shadow-[0_12px_32px_rgba(139,92,246,0.22)]"
          >
            <span
              aria-hidden
              className="mb-3 inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-violet-500 text-2xl font-black text-white shadow-[0_4px_14px_rgba(124,58,237,0.45)]"
            >
              {index + 1}
            </span>
            <h3 className="text-sm font-bold leading-snug text-slate-900 sm:text-base">{step.title}</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600 sm:text-[13px]">{step.description}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
