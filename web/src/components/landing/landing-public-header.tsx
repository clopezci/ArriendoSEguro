import { BrandLockup } from "@/components/brand/brand-lockup";
import Link from "next/link";

export function LandingPublicHeader() {
  return (
    <header className="shrink-0 border-b border-slate-300 bg-slate-100/90 shadow-[0_6px_20px_rgba(139,92,246,0.12)] backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-2 sm:px-6">
        <Link href="/" className="text-sm font-semibold tracking-tight text-violet-700 sm:text-base">
          <BrandLockup />
        </Link>
        <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
          <Link
            href="/herramientas"
            className="rounded-md border border-emerald-400 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-800 transition hover:border-emerald-500 hover:bg-emerald-100 sm:px-2.5 sm:text-xs"
          >
            Herramientas gratis
          </Link>
          <Link
            href="/blog"
            className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-800 transition hover:border-violet-500 hover:text-slate-900 sm:px-2.5 sm:text-sm"
          >
            Blog
          </Link>
          <Link
            href="/ingresar"
            className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-800 transition hover:border-violet-500 hover:text-slate-900 sm:px-2.5 sm:text-sm"
          >
            Acceder
          </Link>
          <Link
            href="/crear-cuenta"
            className="rounded-md border border-violet-500 bg-violet-600 px-2.5 py-1 text-xs font-semibold text-white shadow-[0_0_12px_rgba(139,92,246,0.25)] transition hover:bg-violet-700 sm:px-3 sm:text-sm"
          >
            Crear cuenta
          </Link>
        </div>
      </div>
    </header>
  );
}
