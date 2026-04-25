import { RequireAuth } from "@/components/auth/require-auth";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <RequireAuth>
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-900 text-slate-100">
        <header className="border-b border-slate-800 bg-slate-950/90 shadow-[0_8px_28px_rgba(139,92,246,0.18)]">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
            <h1 className="text-lg font-semibold text-violet-400">ArriendoSeguro · Dashboard</h1>
            <nav className="flex flex-wrap gap-2 text-sm">
              <Link className="rounded-md px-2 py-1 hover:bg-slate-800" href="/dashboard">
                Inicio
              </Link>
              <Link className="rounded-md px-2 py-1 hover:bg-slate-800" href="/dashboard/contracts">
                Contratos
              </Link>
              <Link className="rounded-md px-2 py-1 hover:bg-slate-800" href="/dashboard/billing">
                Facturación
              </Link>
              <Link className="rounded-md px-2 py-1 hover:bg-slate-800" href="/panel">
                Menú principal
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
      </div>
    </RequireAuth>
  );
}

