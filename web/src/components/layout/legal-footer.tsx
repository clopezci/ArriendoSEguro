import Link from "next/link";
import { CookiePreferencesLink } from "@/components/consent/cookie-preferences-link";

const LEGAL_LINKS = [
  { href: "/acerca-de", label: "Acerca de" },
  { href: "/contacto", label: "Contacto" },
  { href: "/calculadoras", label: "Calculadoras" },
  { href: "/reportar", label: "Reportar un problema" },
  { href: "/estado", label: "Estado del servicio" },
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
        <p className="mt-5 flex flex-wrap items-center justify-center gap-1.5 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} ArriendoSeguro · Un producto de{" "}
          <a
            href="https://lotic-soluciones.vercel.app/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-extrabold tracking-tight text-[#5646E5] transition hover:brightness-110 hover:underline"
            aria-label="Lotic Soluciones (abre en una pestaña nueva)"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" className="-mt-px">
              <circle cx="12" cy="7.5" r="2.3" fill="#5646E5" />
              <circle cx="6.5" cy="15.5" r="2.3" fill="#7C3AED" />
              <circle cx="17.5" cy="15.5" r="2.3" fill="#A855F7" />
              <path d="M12 9.6 L7 13.6 M12 9.6 L17 13.6" stroke="#7C3AED" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Lotic
          </a>
        </p>
      </div>
    </footer>
  );
}
