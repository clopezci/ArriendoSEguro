import { RequireAuth } from "@/components/auth/require-auth";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <RequireAuth>
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-900 text-slate-100">
        <header className="border-b border-slate-800 bg-slate-950/90 shadow-[0_8px_28px_rgba(139,92,246,0.18)]">
          <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <Link href="/dashboard" className="text-lg font-semibold tracking-tight text-violet-300">
                ArriendoSeguro
              </Link>
            </div>
            <DashboardNav />
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
      </div>
    </RequireAuth>
  );
}
