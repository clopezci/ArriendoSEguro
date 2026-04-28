"use client";

import { useAuth } from "@/contexts/auth-context";
import { TurnstileWidget } from "@/components/security/turnstile-widget";
import { mapFirebaseAuthError } from "@/lib/auth/firebase-errors";
import { appConfig } from "@/lib/config";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

export function IngresarForm() {
  const { user, signIn, signUp, resetPassword, configError, loading: authLoading } = useAuth();
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
  }, [mode, regenerateHumanChallenge]);

  useEffect(() => {
    if (authLoading || configError) return;
    if (user) goPanel();
  }, [user, authLoading, configError, goPanel]);

  const humanExpected = useMemo(() => {
    if (humanA == null || humanB == null) return null;
    return humanA + humanB;
  }, [humanA, humanB]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (submitBlocked) {
      setError(`Demasiados intentos. Esperá ${cooldownSeconds} segundos e intentá de nuevo.`);
      return;
    }
    if (botField.trim().length > 0) {
      setError("No se pudo validar el formulario. Recargá e intentá de nuevo.");
      return;
    }
    if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !turnstileToken) {
      setError("Completá primero el control anti-bot.");
      return;
    }
    if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) {
      const sec = await fetch("/api/security/turnstile/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: turnstileToken, action: "auth_form" }),
      });
      if (!sec.ok) {
        setError("No se pudo validar el control anti-bot. Recargá la página e intentá de nuevo.");
        return;
      }
    }
    if (humanExpected == null || Number(humanCheck) !== humanExpected) {
      setError("Control de seguridad incorrecto. Revisá la suma y probá de nuevo.");
      regenerateHumanChallenge();
      return;
    }
    setSending(true);
    try {
      if (mode === "iniciar") await signIn(email, password);
      else await signUp(email, password);
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
      setError("Escribí primero tu correo para enviar el enlace de recuperación.");
      return;
    }
    try {
      await resetPassword(normalized);
      setNotice(
        "Te enviamos un enlace para restablecer la contraseña. Revisá bandeja principal, spam o promociones.",
      );
    } catch (err) {
      setError(mapFirebaseAuthError(err));
    }
  }

  if (configError) {
    return (
      <p className="text-center text-sm text-amber-800 dark:text-amber-200/90">
        Falta configurar las variables de Firebase. El desarrollador debe añadir{" "}
        <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/50">NEXT_PUBLIC_FIREBASE_*</code>{" "}
        en <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/50">.env.local</code>.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <div className="flex rounded-lg border border-slate-200 p-0.5 text-sm dark:border-slate-600">
        <button
          type="button"
          onClick={() => setMode("iniciar")}
          className={`flex-1 rounded-md py-2 font-medium ${
            mode === "iniciar"
              ? "bg-sky-600 text-white"
              : "text-slate-600 dark:text-slate-300"
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
              : "text-slate-600 dark:text-slate-300"
          }`}
        >
          Crear cuenta
        </button>
      </div>
      <div>
        <label htmlFor="email" className="mb-1 block text-sm text-slate-600 dark:text-slate-300">
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
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-sm text-slate-600 dark:text-slate-300">
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
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        />
      </div>
      <div>
        <label htmlFor="humanCheck" className="mb-1 block text-sm text-slate-600 dark:text-slate-300">
          Control de seguridad: {humanA ?? "?"} + {humanB ?? "?"}
        </label>
        <input
          id="humanCheck"
          name="humanCheck"
          inputMode="numeric"
          required
          value={humanCheck}
          onChange={(e) => setHumanCheck(e.target.value.replace(/\D/g, ""))}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
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
      <TurnstileWidget onToken={setTurnstileToken} action="auth_form" />
      {notice && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-100">
          {notice}
        </p>
      )}
      {error && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-100">
          {error}
        </p>
      )}
      {mode === "iniciar" && (
        <button
          type="button"
          onClick={() => void onForgotPassword()}
          className="text-sm text-sky-600 underline-offset-4 hover:underline dark:text-sky-400"
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
        <Link href="/" className="text-sky-600 hover:underline dark:text-sky-400">
          Volver a {appConfig.name}
        </Link>
      </p>
    </form>
  );
}
