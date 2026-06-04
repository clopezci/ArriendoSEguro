"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
import { isValidReferralCodeFormat, normalizeReferralCode } from "@/domain/referrals/referrals";

const PENDING_KEY = "arriendoseguro.referral.pending";
const DONE_KEY = "arriendoseguro.referral.claimed";

/**
 * Rastreador de referidos (montado una vez en el layout raíz):
 * 1. Captura el código `?ref=` de la URL en cualquier página pública y lo
 *    guarda en localStorage.
 * 2. Cuando el usuario inicia sesión, reclama la referencia (queda pendiente
 *    de aprobación del fundador). No bloquea la UI ni muestra nada.
 */
export function ReferralTracker() {
  const { user } = useAuth();
  const claimedThisSession = useRef(false);

  // 1) Captura el código de la URL.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const params = new URLSearchParams(window.location.search);
      const raw = params.get("ref");
      if (!raw) return;
      const code = normalizeReferralCode(raw);
      if (isValidReferralCodeFormat(code) && !window.localStorage.getItem(DONE_KEY)) {
        window.localStorage.setItem(PENDING_KEY, code);
      }
    } catch {
      /* sin acceso a URL/localStorage: ignorar */
    }
  }, []);

  // 2) Reclama tras iniciar sesión.
  useEffect(() => {
    if (!user || claimedThisSession.current) return;
    let cancelled = false;
    const run = async () => {
      let code: string | null = null;
      try {
        if (window.localStorage.getItem(DONE_KEY)) return;
        code = window.localStorage.getItem(PENDING_KEY);
      } catch {
        return;
      }
      if (!code) return;
      claimedThisSession.current = true;
      try {
        const res = await fetch("/api/referrals/claim", {
          method: "POST",
          headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
          body: JSON.stringify({ code }),
        });
        if (cancelled) return;
        // Éxito o "ya registrado": no reintentar en este navegador.
        if (res.ok) {
          try {
            window.localStorage.setItem(DONE_KEY, "1");
            window.localStorage.removeItem(PENDING_KEY);
          } catch {
            /* noop */
          }
        }
      } catch {
        // Error de red: se reintentará en una próxima sesión (no marcamos done).
        claimedThisSession.current = false;
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return null;
}
