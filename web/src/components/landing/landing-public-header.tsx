import { BrandLockup } from "@/components/brand/brand-lockup";
import Link from "next/link";

type LandingPublicHeaderProps = {
  surveyHref?: string;
};

export function LandingPublicHeader({ surveyHref = "/encuesta" }: LandingPublicHeaderProps) {
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
            className="rounded-md border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-800 transition hover:border-violet-500 hover:text-slate-900 sm:px-2.5 sm:text-xs"
          >
            Blog
          </Link>
          <Link
            href={surveyHref}
            className="rounded-md border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-800 transition hover:border-violet-500 hover:text-slate-900 sm:px-2.5 sm:text-xs"
          >
            Responder encuesta
          </Link>
          <Link
            href="/demo"
            className="rounded-md border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-800 transition hover:border-violet-500 hover:text-slate-900 sm:px-2.5 sm:text-xs"
          >
            Ver demo guiado
          </Link>
          <Link
            href="/ingresar"
            className="rounded-md border border-violet-500 bg-violet-600/20 px-2 py-1 text-[11px] font-medium text-violet-700 shadow-[0_0_12px_rgba(139,92,246,0.2)] transition hover:bg-violet-600/30 sm:px-2.5 sm:text-xs"
          >
            Acceder al panel
          </Link>
        </div>
      </div>
    </header>
  );
}
