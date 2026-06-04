import Link from "next/link";
import { CookiePreferencesLink } from "@/components/consent/cookie-preferences-link";

const LEGAL_LINKS = [
  { href: "/acerca-de", label: "Acerca de" },
  { href: "/contacto", label: "Contacto" },
  { href: "/calculadoras", label: "Calculadoras" },
  { href: "/reportar", label: "Reportar un problema" },
  { href: "/blog", label: "Blog" },
  { href: "/legal/terminos", label: "Términos" },
  { href: "/legal/privacidad", label: "Tratamiento de datos" },
  { href: "/legal/aviso-privacidad", label: "Aviso de privacidad" },
  { href: "/legal/cookies", label: "Cookies" },
  { href: "/legal/firma-electronica", label: "Firma electrónica" },
  { href: "/legal/demo", label: "Demo" },
  { href: "/legal/evaluacion", label: "Política de evaluación de reputación" },
] as const;

export function LegalFooter() {
  return (
    <footer className="border-t border-slate-300 bg-slate-100 text-slate-600">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <nav className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm" aria-label="Información legal">
          {LEGAL_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-slate-700 underline-offset-4 hover:text-violet-700 hover:underline"
            >
              {item.label}
            </Link>
          ))}
          <CookiePreferencesLink />
        </nav>
      </div>
    </footer>
  );
}
