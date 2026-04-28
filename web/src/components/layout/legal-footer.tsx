import Link from "next/link";

const LEGAL_LINKS = [
  { href: "/legal/terminos", label: "Términos" },
  { href: "/legal/privacidad", label: "Tratamiento de datos" },
  { href: "/legal/aviso-privacidad", label: "Aviso de privacidad" },
  { href: "/legal/firma-electronica", label: "Firma electrónica" },
  { href: "/legal/demo", label: "Demo" },
] as const;

export function LegalFooter() {
  return (
    <footer className="border-t border-slate-800/80 bg-slate-950 text-slate-400">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <nav className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm" aria-label="Información legal">
          {LEGAL_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-slate-300 underline-offset-4 hover:text-violet-300 hover:underline"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <p className="mt-3 text-center text-[11px] text-slate-500">
          También:{" "}
          <Link href="/legal/evaluacion" className="text-slate-400 underline-offset-2 hover:text-violet-300 hover:underline">
            Política de evaluación estructurada
          </Link>
        </p>
        <p className="mx-auto mt-3 max-w-2xl text-center text-[11px] leading-relaxed text-slate-500">
          Estos documentos son una base inicial para el MVP y deben ser revisados por un abogado antes de operación
          comercial amplia.
        </p>
      </div>
    </footer>
  );
}
