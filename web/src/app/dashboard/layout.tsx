import { RequireAuth } from "@/components/auth/require-auth";
import { BrandLockup } from "@/components/brand/brand-lockup";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <RequireAuth>
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <header className="border-b border-slate-300 bg-slate-100/90 shadow-[0_8px_28px_rgba(139,92,246,0.18)]">
          <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <Link href="/dashboard" className="text-lg font-semibold tracking-tight text-violet-700">
                <BrandLockup />
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
