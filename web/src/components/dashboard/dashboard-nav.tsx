"use client";

import { useAuth } from "@/contexts/auth-context";
import { canSeeInternalDashboardTools } from "@/lib/dashboard/internal-tools";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navMain = [
  { href: "/dashboard", label: "Inicio" },
  { href: "/dashboard/leases", label: "Mis arriendos" },
  { href: "/entiendelo-facil", label: "Cómo funciona" },
  { href: "/dashboard/plans", label: "Planes" },
  { href: "/demo", label: "Demo" },
] as const;

export function DashboardNav() {
  const { user, signOut } = useAuth();
  const pathname = usePathname();
  const internal = canSeeInternalDashboardTools(user?.email ?? null);

  return (
    <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <nav className="flex flex-wrap items-center gap-1 text-sm sm:gap-2" aria-label="Principal">
        {navMain.map(({ href, label }) => {
          const active =
            href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname === href || pathname?.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={`rounded-md px-2 py-1 transition-colors ${
                active ? "bg-violet-600/25 text-violet-100" : "hover:bg-slate-800"
              }`}
            >
              {label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => void signOut()}
          className="rounded-md px-2 py-1 text-left hover:bg-slate-800 sm:text-center"
        >
          Salir
        </button>
      </nav>
      <div className="flex flex-wrap items-center justify-end gap-3 text-sm">
        {internal && (
          <nav className="flex flex-wrap gap-1 border-l border-slate-700 pl-3 text-xs text-amber-100/90" aria-label="Herramientas internas">
            <Link className="rounded px-1 py-0.5 hover:bg-slate-800" href="/dashboard/contracts/new">
              Nuevo expediente (directo)
            </Link>
            <Link className="rounded px-1 py-0.5 hover:bg-slate-800" href="/panel/expediente">
              Panel legacy
            </Link>
          </nav>
        )}
        {user?.email && (
          <span className="max-w-[220px] truncate text-xs text-slate-400" title={user.email}>
            {user.email}
          </span>
        )}
      </div>
    </div>
  );
}
