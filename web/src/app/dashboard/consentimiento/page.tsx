"use client";

import { useAuth } from "@/contexts/auth-context";
import { DataConsentCheckbox } from "@/components/consent/data-consent-checkbox";
import { CONSENT_CURRENT_VERSION, getCurrentConsentText } from "@/domain/consents/consentVersions";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * Pantalla intermedia para registrar el consentimiento de tratamiento de
 * datos cuando el usuario va a iniciar el wizard del contrato y todavía no
 * lo aceptó (por ejemplo, cuentas creadas antes de habilitar el flujo).
 * Si rechaza, lo enviamos al dashboard general; no le bloqueamos la
 * navegación general de la app, pero sí la creación de un contrato.
 */
export default function ConsentimientoPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = params.get("redirect") || "/dashboard";

  const [accepted, setAccepted] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const text = useMemo(() => getCurrentConsentText(), []);

  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/ingresar?redirect=${encodeURIComponent(redirectTo)}`);
    }
  }, [loading, user, router, redirectTo]);

  const onSubmit = useCallback(async () => {
    setError(null);
    if (!accepted) {
      setInvalid(true);
      return;
    }
    if (!user) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/consents/register", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(await buildAuthHeaders(user)),
        },
        body: JSON.stringify({
          version: CONSENT_CURRENT_VERSION,
          surface: "CONTRACT_WIZARD_START",
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean };
      if (!res.ok || !data.success) {
        setError(
          "No pudimos registrar tu aceptación en este momento. Verifica tu conexión y vuelve a intentar.",
        );
        return;
      }
      router.replace(redirectTo);
    } catch {
      setError(
        "Hubo un problema temporal al registrar tu aceptación. Intenta de nuevo en un momento.",
      );
    } finally {
      setSubmitting(false);
    }
  }, [accepted, user, router, redirectTo]);

  if (loading) {
    return <p className="text-sm text-slate-300">Cargando…</p>;
  }
  if (!user) {
    return null;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4 sm:p-6">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-violet-300">
          Tratamiento de datos personales
        </p>
        <h1 className="text-xl font-bold text-slate-100 sm:text-2xl">
          Antes de crear tu contrato
        </h1>
        <p className="text-sm text-slate-300">
          Necesitamos tu autorización expresa para tratar tus datos personales conforme a la{" "}
          <strong>Ley 1581 de 2012</strong> y al{" "}
          <Link
            href="/legal/aviso-privacidad"
            target="_blank"
            rel="noopener noreferrer"
            className="text-violet-300 underline-offset-4 hover:underline"
          >
            Aviso de privacidad
          </Link>
          .
        </p>
      </header>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-sm leading-relaxed text-slate-200 shadow-[0_10px_24px_rgba(139,92,246,0.18)] sm:p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-violet-300">
          Versión {text.version}
        </h2>
        <p className="mt-1 text-xs text-slate-400">Publicado {text.publishedAt}</p>
        <div className="mt-4 space-y-3 whitespace-pre-line">
          {text.fullText}
        </div>
      </section>

      <DataConsentCheckbox
        checked={accepted}
        onChange={(v) => {
          setAccepted(v);
          if (v) setInvalid(false);
        }}
        invalid={invalid}
        errorMessage="Debes aceptar el tratamiento de datos para continuar."
        variant="dark"
      />

      {error && (
        <p
          className="rounded-lg border border-rose-500/50 bg-rose-900/30 px-3 py-2 text-sm text-rose-200"
          role="alert"
        >
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Link
          href="/dashboard"
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:border-slate-500"
        >
          No deseo aceptar
        </Link>
        <button
          type="button"
          onClick={() => void onSubmit()}
          disabled={submitting}
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-[0_0_18px_rgba(139,92,246,0.35)] hover:bg-violet-500 disabled:opacity-60"
        >
          {submitting ? "Registrando…" : "Acepto y continúo"}
        </button>
      </div>
    </div>
  );
}
