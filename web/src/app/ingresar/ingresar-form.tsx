"use client";

import { useAuth } from "@/contexts/auth-context";
import { TurnstileWidget } from "@/components/security/turnstile-widget";
import { DataConsentCheckbox } from "@/components/consent/data-consent-checkbox";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
import { mapFirebaseAuthError } from "@/lib/auth/firebase-errors";
import { appConfig } from "@/lib/config";
import { CONSENT_CURRENT_VERSION } from "@/domain/consents/consentVersions";
import { getAuthClient } from "@/lib/firebase/client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

export function IngresarForm() {
  const {
    user,
    signIn,
    signUp,
    resetPassword,
    configError,
    loading: authLoading,
  } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"iniciar" | "crear">("iniciar");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [humanCheck, setHumanCheck] = useState("");
  const [humanA, setHumanA] = useState<number | null>(null);
  const [humanB, setHumanB] = useState<number | null>(null);
  const [botField, setBotField] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [consentInvalid, setConsentInvalid] = useState(false);

  const redirect = searchParams.get("redirect") || "/dashboard";
  const now = Date.now();
  const cooldownSeconds = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));
  const submitBlocked = cooldownUntil > now;

  const goPanel = useCallback(() => {
    router.replace(redirect);
  }, [router, redirect]);

  const regenerateHumanChallenge = useCallback(() => {
    setHumanA(Math.floor(Math.random() * 7) + 2);
    setHumanB(Math.floor(Math.random() * 7) + 2);
    setHumanCheck("");
  }, []);

  useEffect(() => {
    regenerateHumanChallenge();
  }, [regenerateHumanChallenge]);

  useEffect(() => {
    regenerateHumanChallenge();
    setConsentInvalid(false);
  }, [mode, regenerateHumanChallenge]);

  useEffect(() => {
    if (authLoading || configError) return;
    if (user) goPanel();
  }, [user, authLoading, configError, goPanel]);

  /** Registra el consentimiento de datos tras un alta (best-effort, no bloquea). */
  const registerConsentBestEffort = useCallback(async () => {
    try {
      const current = getAuthClient().currentUser;
      if (!current) return;
      await fetch("/api/consents/register", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(current)) },
        body: JSON.stringify({ version: CONSENT_CURRENT_VERSION, surface: "REGISTRATION" }),
      });
    } catch {
      // El consentimiento se reintentará desde el wizard.
    }
  }, []);

  /** Acceso/registro con Google del lado del SERVIDOR: el backend hace el OAuth y
   *  crea la sesión; el navegador nunca carga scripts de Google → funciona con
   *  cualquier extensión/bloqueador. Volvemos a `redirect`. */
  function submitGoogle() {
    setError(null);
    setNotice(null);
    if (mode === "crear" && !consentAccepted) {
      setConsentInvalid(true);
      setError("Para crear tu cuenta con Google debes aceptar el tratamiento de datos personales (Ley 1581 de 2012).");
      return;
    }
    setSending(true);
    window.location.href = `/api/auth/google/start?next=${encodeURIComponent(redirect)}`;
  }

  /** Acceso/registro con Facebook del lado del SERVIDOR (mismo patrón que Google). */
  function submitFacebook() {
    setError(null);
    setNotice(null);
    if (mode === "crear" && !consentAccepted) {
      setConsentInvalid(true);
      setError("Para crear tu cuenta con Facebook debes aceptar el tratamiento de datos personales (Ley 1581 de 2012).");
      return;
    }
    setSending(true);
    window.location.href = `/api/auth/facebook/start?next=${encodeURIComponent(redirect)}`;
  }

  const humanExpected = useMemo(() => {
    if (humanA == null || humanB == null) return null;
    return humanA + humanB;
  }, [humanA, humanB]);

  const turnstileSiteKey = (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "").trim();
  /** Solo obligatorio si definís explícitamente NEXT_PUBLIC_TURNSTILE_REQUIRED=true (después de verificar el widget en Turnstile). */
  const turnstileStrict = turnstileSiteKey.length > 0 && process.env.NEXT_PUBLIC_TURNSTILE_REQUIRED === "true";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (submitBlocked) {
      setError(`Demasiados intentos. Espera ${cooldownSeconds} segundos e inténtalo de nuevo.`);
      return;
    }
    if (botField.trim().length > 0) {
      setError("No se pudo validar el formulario. Recarga e inténtalo de nuevo.");
      return;
    }
    if (turnstileStrict && !turnstileToken) {
      setError(
        "Completa primero el recuadro de Cloudflare Turnstile (debajo de la suma). Si no aparece, revisa los dominios permitidos en Cloudflare o desactiva el modo estricto quitando NEXT_PUBLIC_TURNSTILE_REQUIRED.",
      );
      return;
    }
    if (turnstileStrict && turnstileToken) {
      const sec = await fetch("/api/security/turnstile/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: turnstileToken, action: "auth_form" }),
      });
      if (!sec.ok) {
        setError("No se pudo validar Turnstile en el servidor. Recarga la página e inténtalo de nuevo.");
        return;
      }
    }
    if (humanExpected == null || Number(humanCheck) !== humanExpected) {
      setError("Control de seguridad incorrecto. Revisa la suma e inténtalo de nuevo.");
      regenerateHumanChallenge();
      return;
    }
    if (mode === "crear" && !consentAccepted) {
      setConsentInvalid(true);
      setError(
        "Para crear tu cuenta debes aceptar el tratamiento de datos personales (Ley 1581 de 2012).",
      );
      return;
    }
    setSending(true);
    try {
      if (mode === "iniciar") await signIn(email, password);
      else {
        await signUp(email, password);
        // Tras el alta exitosa, registramos el consentimiento en backend con el
        // token recién emitido (best-effort; el wizard lo reintenta si falla).
        await registerConsentBestEffort();
      }
      setFailedAttempts(0);
      goPanel();
    } catch (err) {
      const nextFails = failedAttempts + 1;
      setFailedAttempts(nextFails);
      if (nextFails >= 5) {
        const lockMs = Math.min(120_000, 20_000 + (nextFails - 5) * 15_000);
        setCooldownUntil(Date.now() + lockMs);
      }
      setError(mapFirebaseAuthError(err));
      regenerateHumanChallenge();
      setTurnstileToken("");
    } finally {
      setSending(false);
    }
  }

  async function onForgotPassword() {
    setError(null);
    setNotice(null);
    const normalized = email.trim();
    if (!normalized) {
      setError("Escribe primero tu correo para enviar el enlace de recuperación.");
      return;
    }
    try {
      await resetPassword(normalized);
      setNotice(
        "Te enviamos un enlace para restablecer la contraseña. Revisa bandeja principal, spam o promociones.",
      );
    } catch (err) {
      setError(mapFirebaseAuthError(err));
    }
  }

  if (configError) {
    return (
      <p className="text-center text-sm text-amber-800 dark:text-amber-800">
        Falta configurar las variables de Firebase. El desarrollador debe añadir{" "}
        <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/50">NEXT_PUBLIC_FIREBASE_*</code>{" "}
        en <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/50">.env.local</code>.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <div className="flex rounded-lg border border-slate-200 p-0.5 text-sm dark:border-slate-300">
        <button
          type="button"
          onClick={() => setMode("iniciar")}
          className={`flex-1 rounded-md py-2 font-medium ${
            mode === "iniciar"
              ? "bg-sky-600 text-white"
              : "text-slate-600 dark:text-slate-700"
          }`}
        >
          Iniciar sesión
        </button>
        <button
          type="button"
          onClick={() => setMode("crear")}
          className={`flex-1 rounded-md py-2 font-medium ${
            mode === "crear"
              ? "bg-sky-600 text-white"
              : "text-slate-600 dark:text-slate-700"
          }`}
        >
          Crear cuenta
        </button>
      </div>

      <button
        type="button"
        onClick={() => void submitGoogle()}
        disabled={sending || authLoading || submitBlocked}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.62z" />
          <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
          <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
          <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
        </svg>
        {mode === "crear" ? "Crear cuenta con Google" : "Continuar con Google"}
      </button>

      {/* El botón de Facebook solo se muestra si el permiso ya fue aprobado por Meta
          (flag NEXT_PUBLIC_FACEBOOK_LOGIN_ENABLED=true). Mientras está en revisión,
          se oculta para no mostrar a los clientes el aviso de "permiso no aprobado". */}
      {process.env.NEXT_PUBLIC_FACEBOOK_LOGIN_ENABLED === "true" && (
      <button
        type="button"
        onClick={() => void submitFacebook()}
        disabled={sending || authLoading || submitBlocked}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#1877F2] bg-[#1877F2] py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-60"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#ffffff" d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.68 4.53-4.68 1.31 0 2.68.23 2.68.23v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z" />
        </svg>
        {mode === "crear" ? "Crear cuenta con Facebook" : "Continuar con Facebook"}
      </button>
      )}

      <div className="flex items-center gap-3 text-xs text-slate-400">
        <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
        o con tu correo
        <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
      </div>

      <div>
        <label htmlFor="email" className="mb-1 block text-sm text-slate-600 dark:text-slate-700">
          Correo electrónico
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-slate-300 dark:bg-slate-200 dark:text-slate-900"
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-sm text-slate-600 dark:text-slate-700">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete={mode === "iniciar" ? "current-password" : "new-password"}
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-slate-300 dark:bg-slate-200 dark:text-slate-900"
        />
      </div>
      <div>
        <label htmlFor="humanCheck" className="mb-1 block text-sm text-slate-600 dark:text-slate-700">
          Control de seguridad: {humanA ?? "?"} + {humanB ?? "?"}
        </label>
        <input
          id="humanCheck"
          name="humanCheck"
          inputMode="numeric"
          required
          value={humanCheck}
          onChange={(e) => setHumanCheck(e.target.value.replace(/\D/g, ""))}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-slate-300 dark:bg-slate-200 dark:text-slate-900"
          placeholder="Resultado de la suma"
        />
        <p className="mt-1 text-[11px] text-slate-500">
          Este control evita automatizaciones básicas de intentos masivos.
        </p>
      </div>
      <input
        tabIndex={-1}
        aria-hidden="true"
        autoComplete="off"
        value={botField}
        onChange={(e) => setBotField(e.target.value)}
        className="hidden"
        name="website"
      />
      <TurnstileWidget onToken={setTurnstileToken} action="auth_form" requiredForSubmit={turnstileStrict} />
      {mode === "crear" && (
        <DataConsentCheckbox
          checked={consentAccepted}
          onChange={(v) => {
            setConsentAccepted(v);
            if (v) setConsentInvalid(false);
          }}
          invalid={consentInvalid}
          errorMessage="Debes aceptar el tratamiento de datos para crear tu cuenta."
        />
      )}
      {notice && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-800/60 dark:bg-emerald-50 dark:text-emerald-800">
          {notice}
        </p>
      )}
      {error && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900 dark:border-rose-800/60 dark:bg-rose-50 dark:text-rose-800">
          {error}
        </p>
      )}
      {mode === "iniciar" && (
        <button
          type="button"
          onClick={() => void onForgotPassword()}
          className="text-sm text-sky-600 underline-offset-4 hover:underline dark:text-sky-700"
        >
          Olvidé mi contraseña
        </button>
      )}
      <button
        type="submit"
        disabled={sending || authLoading || submitBlocked}
        className="w-full rounded-lg bg-sky-600 py-2.5 text-sm font-medium text-white shadow transition hover:bg-sky-700 disabled:opacity-60"
      >
        {submitBlocked
          ? `Esperá ${cooldownSeconds}s`
          : sending
            ? "Procesando…"
            : mode === "iniciar"
              ? "Entrar"
              : "Crear y entrar"}
      </button>
      <p className="text-center text-sm text-slate-500">
        <Link href="/" className="text-sky-600 hover:underline dark:text-sky-700">
          Volver a {appConfig.name}
        </Link>
      </p>
    </form>
  );
}
