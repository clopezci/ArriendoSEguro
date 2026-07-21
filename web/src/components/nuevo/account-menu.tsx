"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/auth-context";

/**
 * Menú de cuenta para las pantallas inmersivas de `/nuevo`. El desplegable se
 * renderiza en un PORTAL a `document.body` con posición `fixed`, para que SIEMPRE
 * quede por encima del contenido de la página (antes quedaba "detrás" porque un
 * contenedor con transform/overflow/z-index lo atrapaba en su contexto de
 * apilamiento). Solo aparece con sesión iniciada.
 */
export function AccountMenu() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [coords, setCoords] = useState<{ top: number; right: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setMounted(true), []);

  // Cierra/recalcula si cambia el tamaño o hace scroll (el portal es `fixed`).
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  if (!user) return null;

  const email = user.email ?? "Mi cuenta";
  const initial = (email.trim()[0] ?? "?").toUpperCase();

  function toggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setCoords({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) });
    }
    setOpen((v) => !v);
  }

  async function doSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setOpen(false);
      router.push("/ingresar");
    }
  }

  const itemCls = "block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-violet-50 hover:text-violet-800";

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-2 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-[#5646E5]"
        title={email}
      >
        <span className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-[#5646E5] to-[#8B6BFF] text-[11px] font-black text-white">
          {initial}
        </span>
        <span className="hidden max-w-[9rem] truncate sm:inline">{email}</span>
        <span aria-hidden="true">▾</span>
      </button>

      {mounted && open && coords &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[9998]" aria-hidden="true" onClick={() => setOpen(false)} />
            <div
              role="menu"
              style={{ position: "fixed", top: coords.top, right: coords.right }}
              className="z-[9999] min-w-[13rem] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-2xl"
            >
              <p className="truncate px-3 py-2 text-[11px] text-slate-400" title={email}>
                {email}
              </p>
              <Link href="/dashboard" role="menuitem" onClick={() => setOpen(false)} className={itemCls}>
                Inicio (panel)
              </Link>
              <Link href="/nuevo/contratos" role="menuitem" onClick={() => setOpen(false)} className={itemCls}>
                Mis contratos
              </Link>
              <Link href="/dashboard/account" role="menuitem" onClick={() => setOpen(false)} className={itemCls}>
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
          </>,
          document.body,
        )}
    </div>
  );
}
