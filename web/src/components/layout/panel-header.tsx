"use client";

import { useAuth } from "@/contexts/auth-context";
import { appConfig } from "@/lib/config";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/panel", label: "Inicio" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/entiendelo-facil", label: "¿Primera vez arrendando?" },
  { href: "/panel/expediente", label: "Expediente" },
  { href: "/panel/inventario", label: "Inventario" },
  { href: "/panel/pagos", label: "Pagos" },
  { href: "/#interes", label: "Inscribirse" },
] as const;

export function PanelHeader() {
  const { user, signOut } = useAuth();
  const pathname = usePathname();

  return (
    <header className="border-b border-slate-800 bg-slate-950/95 shadow-[0_8px_28px_rgba(139,92,246,0.2)]">
      <div className="mx-auto flex max-w-4xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/panel"
            className="text-sm font-semibold text-violet-400"
          >
            {appConfig.name}
          </Link>
          <span className="max-w-[12rem] truncate text-xs text-slate-400 sm:hidden" title={user?.email ?? ""}>
            {user?.email}
          </span>
        </div>
        <nav className="flex flex-wrap gap-2" aria-label="Módulos del panel">
          {links.map(({ href, label }) => {
            const active =
              href === "/#interes"
                ? false
                : pathname === href || (href !== "/panel" && pathname?.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`rounded-md px-2.5 py-1.5 text-sm font-medium transition ${
                  active
                    ? "bg-sky-900/60 text-sky-100 ring-1 ring-violet-400/60 shadow-[0_0_14px_rgba(139,92,246,0.28)]"
                    : "text-slate-300 shadow-[0_0_0_1px_rgba(139,92,246,0.22)] hover:bg-slate-800 hover:text-violet-300"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center justify-end gap-3 border-t border-slate-800 pt-2 sm:border-0 sm:pt-0">
          <span
            className="hidden max-w-xs truncate text-xs text-slate-400 sm:inline"
            title={user?.email ?? ""}
          >
            {user?.email}
          </span>
          <button
            type="button"
            onClick={() => signOut()}
            className="rounded-md border border-slate-700 px-2.5 py-1 text-sm font-medium text-slate-300 shadow-[0_0_0_1px_rgba(139,92,246,0.26)] hover:border-violet-400 hover:text-violet-300"
          >
            Salir
          </button>
        </div>
      </div>
    </header>
  );
}
