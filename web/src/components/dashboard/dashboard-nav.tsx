"use client";

import { useAuth } from "@/contexts/auth-context";
import { canSeeInternalDashboardTools } from "@/lib/dashboard/internal-tools";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navMain = [
  { href: "/dashboard", label: "Inicio" },
  { href: "/dashboard/leases", label: "Mis arriendos" },
  { href: "/dashboard/mis-propiedades", label: "Mis propiedades" },
  { href: "/dashboard/account", label: "Mi cuenta" },
  { href: "/entiendelo-facil", label: "Cómo funciona" },
  { href: "/dashboard/plans", label: "Planes" },
  { href: "/dashboard/aliados", label: "Aliados" },
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
                active ? "bg-violet-600/25 text-violet-800" : "hover:bg-slate-200"
              }`}
            >
              {label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => void signOut()}
          className="rounded-md px-2 py-1 text-left hover:bg-slate-200 sm:text-center"
        >
          Salir
        </button>
      </nav>
      <div className="flex flex-wrap items-center justify-end gap-3 text-sm">
        {internal && (
          <nav className="flex flex-wrap gap-1 border-l border-slate-300 pl-3 text-xs text-amber-800" aria-label="Herramientas internas">
            <Link className="rounded px-1 py-0.5 hover:bg-slate-200" href="/dashboard/contracts/new">
              Nuevo expediente (directo)
            </Link>
            <Link className="rounded px-1 py-0.5 hover:bg-slate-200" href="/panel/expediente">
              Panel legacy
            </Link>
          </nav>
        )}
        {user?.email && (
          <Link
            href="/dashboard/account"
            className="max-w-[220px] truncate rounded-md border border-transparent px-2 py-1 text-xs text-slate-700 transition-colors hover:border-violet-500 hover:bg-slate-200 hover:text-violet-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400"
            title={`Ir a mi cuenta — ${user.email}`}
            aria-label={`Ir a mi cuenta de ${user.email}`}
          >
            {user.email}
          </Link>
        )}
      </div>
    </div>
  );
}
