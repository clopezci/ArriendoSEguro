"use client";

import { useAuth } from "@/contexts/auth-context";
import { mapFirebaseAuthError } from "@/lib/auth/firebase-errors";
import { appConfig } from "@/lib/config";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";

export function IngresarForm() {
  const { user, signIn, signUp, configError, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"iniciar" | "crear">("iniciar");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const redirect = searchParams.get("redirect") || "/panel";

  const goPanel = useCallback(() => {
    router.replace(redirect);
  }, [router, redirect]);

  useEffect(() => {
    if (authLoading || configError) return;
    if (user) goPanel();
  }, [user, authLoading, configError, goPanel]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      if (mode === "iniciar") await signIn(email, password);
      else await signUp(email, password);
      goPanel();
    } catch (err) {
      setError(mapFirebaseAuthError(err));
    } finally {
      setSending(false);
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
      {error && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-100">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={sending || authLoading}
        className="w-full rounded-lg bg-sky-600 py-2.5 text-sm font-medium text-white shadow transition hover:bg-sky-700 disabled:opacity-60"
      >
        {sending ? "Procesando…" : mode === "iniciar" ? "Entrar" : "Crear y entrar"}
      </button>
      <p className="text-center text-sm text-slate-500">
        <Link href="/" className="text-sky-600 hover:underline dark:text-sky-400">
          Volver a {appConfig.name}
        </Link>
      </p>
    </form>
  );
}
