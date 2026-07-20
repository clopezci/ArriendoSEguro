"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";

/**
 * Menú de cuenta compacto para las pantallas inmersivas de `/nuevo` (crear y
 * gestionar contratos), que no montan el nav de `/dashboard`. Solo aparece si
 * hay sesión iniciada; para un usuario nuevo (sin sesión) NO se muestra. Da
 * acceso a Inicio, Mis contratos y, sobre todo, a **Cerrar sesión** (algo que
 * antes solo existía dentro de `/dashboard`).
 */
export function AccountMenu() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // Usuario nuevo / sin sesión: no se muestra nada.
  if (!user) return null;

  const email = user.email ?? "Mi cuenta";
  const initial = (email.trim()[0] ?? "?").toUpperCase();

  async function doSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setOpen(false);
      // Tras salir, a la pantalla de ingreso para entrar con otra cuenta.
      router.push("/ingresar");
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-2 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-[#5646E5]"
        title={email}
      >
        <span className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-[#5646E5] to-[#8B6BFF] text-[11px] font-black text-white">
          {initial}
        </span>
        <span className="hidden max-w-[9rem] truncate sm:inline">{email}</span>
        <span aria-hidden="true">▾</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" aria-hidden="true" onClick={() => setOpen(false)} />
          <div
            role="menu"
            className="absolute right-0 z-30 mt-1 min-w-[13rem] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
          >
            <p className="truncate px-3 py-2 text-[11px] text-slate-400" title={email}>
              {email}
            </p>
            <Link
              href="/dashboard"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-sm text-slate-700 hover:bg-violet-50 hover:text-violet-800"
            >
              Inicio (panel)
            </Link>
            <Link
              href="/nuevo/contratos"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-sm text-slate-700 hover:bg-violet-50 hover:text-violet-800"
            >
              Mis contratos
            </Link>
            <Link
              href="/dashboard/account"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-sm text-slate-700 hover:bg-violet-50 hover:text-violet-800"
            >
              Mi cuenta
            </Link>
            <div className="my-1 h-px bg-slate-100" aria-hidden="true" />
            <button
              type="button"
              role="menuitem"
              onClick={() => void doSignOut()}
              disabled={signingOut}
              className="block w-full px-3 py-2 text-left text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
            >
              {signingOut ? "Cerrando…" : "Cerrar sesión"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
