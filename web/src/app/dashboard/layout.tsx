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
        <header className="sticky top-0 z-50 isolate border-b border-slate-300 bg-slate-100/95 shadow-[0_4px_18px_rgba(139,92,246,0.14)] backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3 sm:px-6">
            <Link href="/dashboard" className="text-lg font-semibold tracking-tight text-violet-700">
              <BrandLockup />
            </Link>
            <DashboardNav />
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
      </div>
    </RequireAuth>
  );
}
