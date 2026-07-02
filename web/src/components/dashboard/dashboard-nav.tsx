"use client";

import { useAuth } from "@/contexts/auth-context";
import { canSeeInternalDashboardTools } from "@/lib/dashboard/internal-tools";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type Item = { href: string; label: string };
type Group = { label: string; items: Item[] };

const ACCOUNT_ITEMS: Item[] = [
  { href: "/dashboard/mis-propiedades", label: "Mis propiedades" },
  { href: "/dashboard/billing", label: "Facturación" },
  { href: "/dashboard/reputacion", label: "Mi reputación" },
  { href: "/dashboard/plans", label: "Planes" },
  { href: "/dashboard/account", label: "Mi cuenta" },
];

const RESOURCES_ITEMS: Item[] = [
  { href: "/herramientas", label: "Herramientas gratis" },
  { href: "/calculadoras", label: "Calculadoras" },
  { href: "/plantillas", label: "Plantillas y descargas" },
  { href: "/blog", label: "Blog" },
  { href: "/entiendelo-facil", label: "Cómo funciona" },
  { href: "/dashboard/aliados", label: "Aliados" },
];

const ADMIN_ITEMS: Item[] = [
  { href: "/admin", label: "Panel de administración" },
  { href: "/dashboard/contracts/new", label: "Nuevo expediente (directo)" },
  { href: "/panel/expediente", label: "Panel legacy" },
];

/** Menú desplegable de escritorio, accesible, con cierre al hacer clic fuera. */
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
        className={`rounded-md px-2.5 py-1.5 transition-colors ${active ? "bg-violet-600/20 text-violet-800" : "text-slate-700 hover:bg-slate-200"}`}
      >
        {label} <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" aria-hidden="true" onClick={() => setOpen(false)} />
          <div
            role="menu"
            className="absolute right-0 z-20 mt-1 min-w-[13rem] rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
          >
            {items.map((i) => (
              <Link
                key={i.href}
                href={i.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="block px-3 py-2 text-sm text-slate-700 hover:bg-violet-50 hover:text-violet-800"
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
  const [mobileOpen, setMobileOpen] = useState(false);

  const topActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname === href || pathname?.startsWith(`${href}/`);

  const groups: Group[] = [
    { label: "Mi cuenta", items: ACCOUNT_ITEMS },
    { label: "Recursos", items: RESOURCES_ITEMS },
    ...(internal ? [{ label: "Admin", items: ADMIN_ITEMS }] : []),
  ];

  return (
    <>
      {/* ── Escritorio ── */}
      <nav className="hidden items-center gap-1 text-sm sm:flex" aria-label="Principal">
        <Link
          href="/dashboard"
          className={`rounded-md px-2.5 py-1.5 transition-colors ${topActive("/dashboard") ? "bg-violet-600/20 text-violet-800" : "text-slate-700 hover:bg-slate-200"}`}
        >
          Inicio
        </Link>
        <Link
          href="/dashboard/leases"
          className={`rounded-md px-2.5 py-1.5 transition-colors ${topActive("/dashboard/leases") ? "bg-violet-600/20 text-violet-800" : "text-slate-700 hover:bg-slate-200"}`}
        >
          Mis arriendos
        </Link>
        {groups.map((g) => (
          <NavDropdown key={g.label} label={g.label} items={g.items} pathname={pathname} />
        ))}
        <div className="mx-1 h-5 w-px bg-slate-300" aria-hidden="true" />
        {user?.email && (
          <Link
            href="/dashboard/account"
            className="max-w-[180px] truncate rounded-md px-2 py-1 text-xs text-slate-500 hover:text-violet-700"
            title={`Mi cuenta — ${user.email}`}
          >
            {user.email}
          </Link>
        )}
        <button
          type="button"
          onClick={() => void signOut()}
          className="rounded-md border border-slate-300 px-2.5 py-1.5 text-slate-700 hover:border-violet-500 hover:text-violet-700"
        >
          Salir
        </button>
      </nav>

      {/* ── Móvil: botón hamburguesa ── */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="Abrir menú"
        aria-expanded={mobileOpen}
        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 sm:hidden"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* ── Móvil: panel lateral ── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 sm:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setMobileOpen(false)} aria-hidden="true" />
          <div className="absolute right-0 top-0 flex h-full w-[82%] max-w-xs flex-col overflow-y-auto bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <span className="truncate text-sm font-semibold text-slate-800">{user?.email ?? "Menú"}</span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Cerrar menú"
                className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <nav className="flex-1 px-2 py-3" aria-label="Menú móvil">
              <Link
                href="/dashboard"
                onClick={() => setMobileOpen(false)}
                className={`block rounded-lg px-3 py-2.5 text-base font-medium ${topActive("/dashboard") ? "bg-violet-50 text-violet-800" : "text-slate-800 hover:bg-slate-100"}`}
              >
                Inicio
              </Link>
              <Link
                href="/dashboard/leases"
                onClick={() => setMobileOpen(false)}
                className={`block rounded-lg px-3 py-2.5 text-base font-medium ${topActive("/dashboard/leases") ? "bg-violet-50 text-violet-800" : "text-slate-800 hover:bg-slate-100"}`}
              >
                Mis arriendos
              </Link>

              {groups.map((g) => (
                <div key={g.label} className="mt-3">
                  <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{g.label}</p>
                  {g.items.map((i) => (
                    <Link
                      key={i.href}
                      href={i.href}
                      onClick={() => setMobileOpen(false)}
                      className="block rounded-lg px-3 py-2.5 text-[15px] text-slate-700 hover:bg-violet-50 hover:text-violet-800"
                    >
                      {i.label}
                    </Link>
                  ))}
                </div>
              ))}
            </nav>

            <div className="border-t border-slate-200 p-3">
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  void signOut();
                }}
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:border-violet-500 hover:text-violet-700"
              >
                Salir
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
