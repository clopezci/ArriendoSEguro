"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithCustomToken } from "firebase/auth";
import { getAuthClient } from "@/lib/firebase/client";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
import { CONSENT_CURRENT_VERSION } from "@/domain/consents/consentVersions";

function safeNext(raw: string | null): string {
  if (!raw) return "/nuevo";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/nuevo";
  return raw;
}

/**
 * Cierre del login con Google (server-side): canjea el custom token que dejó el
 * callback (cookie httpOnly) y crea la sesión con signInWithCustomToken. Esto
 * SOLO habla con identitytoolkit.googleapis.com (no bloqueado). Luego vuelve al
 * recorrido (`next`), donde el usuario ya queda logueado.
 */
function CompleteInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  const provider = params.get("provider") === "facebook" ? "facebook" : "google";
  const providerLabel = provider === "facebook" ? "Facebook" : "Google";

  useEffect(() => {
    const next = safeNext(params.get("next"));
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/auth/${provider}/token`, { cache: "no-store" });
        const data = (await res.json()) as { success?: boolean; token?: string };
        if (!data.success || !data.token) throw new Error("sin token");
        const cred = await signInWithCustomToken(getAuthClient(), data.token);
        // Registro de consentimiento (best-effort; el wizard lo reintenta).
        try {
          await fetch("/api/consents/register", {
            method: "POST",
            headers: { "content-type": "application/json", ...(await buildAuthHeaders(cred.user)) },
            body: JSON.stringify({ version: CONSENT_CURRENT_VERSION, surface: "REGISTRATION" }),
          });
        } catch {
          /* se reintenta desde el wizard */
        }
        if (!cancelled) router.replace(next);
      } catch {
        if (!cancelled) setError(`No pudimos completar el ingreso con ${providerLabel}. Intenta de nuevo o usa tu correo y contraseña.`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params, router, provider, providerLabel]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
      {error ? (
        <>
          <p className="text-lg font-bold text-rose-700">{error}</p>
          <a href="/ingresar" className="mt-4 rounded-lg bg-[#5646E5] px-4 py-2 text-sm font-semibold text-white">
            Volver a ingresar
          </a>
        </>
      ) : (
        <>
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-[#5646E5]" />
          <p className="mt-4 text-sm font-semibold text-slate-700">Entrando con {providerLabel}…</p>
        </>
      )}
    </div>
  );
}

export default function AuthCompletePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-slate-500">Cargando…</div>}>
      <CompleteInner />
    </Suspense>
  );
}
