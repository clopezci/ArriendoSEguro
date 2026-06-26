"use client";

import { useAuth } from "@/contexts/auth-context";
import { canSeeInternalDashboardTools } from "@/lib/dashboard/internal-tools";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type Item = { href: string; label: string };

const ACCOUNT_ITEMS: Item[] = [
  { href: "/dashboard/mis-propiedades", label: "Mis propiedades" },
  { href: "/dashboard/billing", label: "Facturación" },
  { href: "/dashboard/reputacion", label: "Mi reputación" },
  { href: "/dashboard/plans", label: "Planes" },
  { href: "/dashboard/account", label: "Mi cuenta" },
];

const RESOURCES_ITEMS: Item[] = [
  { href: "/entiendelo-facil", label: "Cómo funciona" },
  { href: "/dashboard/aliados", label: "Aliados" },
  { href: "/demo", label: "Demo" },
];

const ADMIN_ITEMS: Item[] = [
  { href: "/admin", label: "Panel de administración" },
  { href: "/dashboard/contracts/new", label: "Nuevo expediente (directo)" },
  { href: "/panel/expediente", label: "Panel legacy" },
];

/** Menú desplegable accesible con cierre al hacer clic fuera. */
function NavDropdown({ label, items, pathname }: { label: string; items: Item[]; pathname: string | null }) {
  const [open, setOpen] = useState(false);
  const active = items.some((i) => pathname === i.href || pathname?.startsWith(`${i.href}/`));
  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`rounded-md px-2 py-1 transition-colors ${active ? "bg-violet-600/25 text-violet-800" : "hover:bg-slate-200"}`}
      >
        {label} <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" aria-hidden="true" onClick={() => setOpen(false)} />
          <div
            role="menu"
            className="absolute left-0 z-20 mt-1 min-w-[12rem] rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
          >
            {items.map((i) => (
              <Link
                key={i.href}
                href={i.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="block px-3 py-1.5 text-sm text-slate-700 hover:bg-violet-50 hover:text-violet-800"
              >
                {i.label}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function DashboardNav() {
  const { user, signOut } = useAuth();
  const pathname = usePathname();
  const internal = canSeeInternalDashboardTools(user?.email ?? null);

  const topActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname === href || pathname?.startsWith(`${href}/`);

  return (
    <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <nav className="flex flex-wrap items-center gap-1 text-sm sm:gap-2" aria-label="Principal">
        <Link
          href="/dashboard"
          className={`rounded-md px-2 py-1 transition-colors ${topActive("/dashboard") ? "bg-violet-600/25 text-violet-800" : "hover:bg-slate-200"}`}
        >
          Inicio
        </Link>
        <Link
          href="/dashboard/leases"
          className={`rounded-md px-2 py-1 transition-colors ${topActive("/dashboard/leases") ? "bg-violet-600/25 text-violet-800" : "hover:bg-slate-200"}`}
        >
          Mis arriendos
        </Link>
        <NavDropdown label="Mi cuenta" items={ACCOUNT_ITEMS} pathname={pathname} />
        <NavDropdown label="Recursos" items={RESOURCES_ITEMS} pathname={pathname} />
        {internal && <NavDropdown label="Admin" items={ADMIN_ITEMS} pathname={pathname} />}
        <button
          type="button"
          onClick={() => void signOut()}
          className="rounded-md px-2 py-1 text-left hover:bg-slate-200 sm:text-center"
        >
          Salir
        </button>
      </nav>
      <div className="flex items-center justify-end text-sm">
        {user?.email && (
          <Link
            href="/dashboard/account"
            className="max-w-[220px] truncate rounded-md border border-transparent px-2 py-1 text-xs text-slate-700 transition-colors hover:border-violet-500 hover:bg-slate-200 hover:text-violet-700"
            title={`Ir a mi cuenta — ${user.email}`}
          >
            {user.email}
          </Link>
        )}
      </div>
    </div>
  );
}
