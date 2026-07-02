import { BrandLockup } from "@/components/brand/brand-lockup";
import Link from "next/link";

export function LandingPublicHeader() {
  return (
    <header className="shrink-0 border-b border-slate-300 bg-slate-100/90 shadow-[0_6px_20px_rgba(139,92,246,0.12)] backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-2 sm:px-6">
        <Link href="/" className="text-sm font-semibold tracking-tight text-violet-700 sm:text-base">
          <BrandLockup />
        </Link>
        <div className="flex items-center justify-end gap-2">
          <Link
            href="/ingresar"
            className="rounded-md px-2.5 py-1.5 text-sm font-medium text-slate-700 transition hover:text-violet-700"
          >
            Acceder
          </Link>
          <Link
            href="/crear-cuenta"
            className="rounded-lg border border-violet-500 bg-violet-600 px-3.5 py-1.5 text-sm font-semibold text-white shadow-[0_0_12px_rgba(139,92,246,0.25)] transition hover:bg-violet-700"
          >
            Crear cuenta
          </Link>
        </div>
      </div>
    </header>
  );
}
