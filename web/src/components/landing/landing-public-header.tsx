import { BrandLockup } from "@/components/brand/brand-lockup";
import Link from "next/link";

export function LandingPublicHeader() {
  return (
    <header className="sticky top-0 z-50 shrink-0 border-b border-slate-200/70 bg-white/70 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-2.5 sm:px-6">
        <Link href="/" className="text-sm font-semibold tracking-tight text-[#5646E5] sm:text-base">
          <BrandLockup />
        </Link>
        <div className="flex items-center justify-end gap-2">
          <Link
            href="/ingresar?redirect=/nuevo"
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:text-[#5646E5]"
          >
            Acceder
          </Link>
          <Link
            href="/nuevo"
            className="rounded-xl bg-[#5646E5] px-4 py-1.5 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition hover:brightness-105 active:scale-95"
          >
            Crear contrato
          </Link>
        </div>
      </div>
    </header>
  );
}
