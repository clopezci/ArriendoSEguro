import { RequireAuth } from "@/components/auth/require-auth";
import { BrandLockup } from "@/components/brand/brand-lockup";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import Link from "next/link";

export const dynamic = "force-dynamic";

/**
 * Marco (chrome) del panel en el estilo del rediseño "Un paso a la vez": fondo
 * cálido con destellos, encabezado flotante y contenedor centrado. Fase 1 de
 * llevar toda la experiencia post-creación (vista previa, firma, posventa) al
 * mismo lenguaje visual bento, sin tocar la lógica de cada página.
 */
export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <RequireAuth>
      <div className="relative min-h-screen overflow-hidden bg-[#F5F3EF] text-[#17151F]">
        <div className="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full opacity-40 blur-3xl" style={{ background: "radial-gradient(circle,#9B6BFF,#5646E5)" }} />
        <div className="pointer-events-none absolute -bottom-32 -left-24 h-72 w-72 rounded-full opacity-40 blur-3xl" style={{ background: "radial-gradient(circle,#FFB03A,#FF6B4A)" }} />

        <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/80 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3 sm:px-6">
            <Link href="/nuevo" className="text-lg font-semibold tracking-tight text-[#5646E5]">
              <BrandLockup />
            </Link>
            <DashboardNav />
          </div>
        </header>

        <main className="relative z-10 mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
      </div>
    </RequireAuth>
  );
}
