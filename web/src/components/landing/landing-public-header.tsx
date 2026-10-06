import { BrandLockup } from "@/components/brand/brand-lockup";
import { appConfig } from "@/lib/config";
import Link from "next/link";

export function LandingPublicHeader() {
  return (
    <header className="sticky top-0 z-50 shrink-0 border-b border-slate-200/70 bg-white/70 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-3 py-2.5 sm:px-6">
        {/* En celular solo cabe el ícono "AS" junto a los 3 botones (el nombre
            necesita ~418px y se montaba sobre ellos); desde tablet se ve completo. */}
        <Link
          href="/"
          aria-label={appConfig.name}
          className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold tracking-tight text-[#5646E5] sm:text-base"
        >
          <BrandLockup compact />
          <span className="hidden sm:inline">{appConfig.name}</span>
        </Link>
        {/* En celular el espacio no alcanza para 3 botones con texto: "Soy agencia"
            queda solo como ícono y ningún botón puede encogerse ni partirse. */}
        <div className="flex shrink-0 items-center justify-end gap-1 sm:gap-2">
          <Link
            href="/agencias"
            aria-label="Soy agencia"
            title="Soy agencia"
            className="whitespace-nowrap rounded-lg px-2 py-1.5 text-sm font-medium text-slate-500 transition hover:text-[#5646E5] sm:px-2.5"
          >
            🏢<span className="hidden sm:inline"> Soy agencia</span>
          </Link>
          <Link
            href="/ingresar?redirect=/nuevo"
            className="whitespace-nowrap rounded-lg px-2 py-1.5 text-sm font-medium text-slate-700 transition hover:text-[#5646E5] sm:px-3"
          >
            Acceder
          </Link>
          <Link
            href="/nuevo"
            className="whitespace-nowrap rounded-xl bg-[#5646E5] px-3 py-1.5 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition hover:brightness-105 active:scale-95 sm:px-4"
          >
            Crear contrato
          </Link>
        </div>
      </div>
    </header>
  );
}
