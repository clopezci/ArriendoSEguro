"use client";

import { useAuth } from "@/contexts/auth-context";
import { DataConsentCheckbox } from "@/components/consent/data-consent-checkbox";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
import { mapFirebaseAuthError } from "@/lib/auth/firebase-errors";
import { CONSENT_CURRENT_VERSION } from "@/domain/consents/consentVersions";
import { getAuthClient } from "@/lib/firebase/client";
import { useMemo, useState } from "react";

/**
 * Registro exprés a mitad del recorrido (50%). Con lo básico ya diligenciado,
 * pedimos crear la cuenta para poder guardar el expediente y continuar con la
 * posventa. Todo en formato tarjeta, fácil: correo prellenado, contraseña con
 * autogenerado + medidor de fuerza, y consentimiento Habeas Data (Ley 1581).
 *
 * No sustituye a /ingresar: reutiliza la MISMA mecánica (signUp/signIn del
 * contexto de auth y POST /api/consents/register) para no divergir.
 */

/** Mensajes claros para fallos típicos del acceso con Google (móvil incluido). */
function googleError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  if (code.includes("popup-blocked") || code.includes("popup-closed") || code.includes("cancelled-popup"))
    return "El navegador bloqueó la ventana de Google. Permite ventanas emergentes, o crea tu cuenta con correo y contraseña aquí abajo.";
  if (code.includes("unauthorized-domain"))
    return "Este enlace aún no está autorizado para Google. Por ahora crea tu cuenta con correo y contraseña.";
  if (code.includes("internal-error") || code.includes("network"))
    return "Google no está disponible aquí en este momento. Crea tu cuenta con correo y contraseña (funciona igual de bien).";
  return (err as { message?: string })?.message || "No se pudo entrar con Google. Usa tu correo y contraseña.";
}

function scorePassword(pw: string): { score: number; label: string; color: string } {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  const score = Math.min(4, s);
  const labels = ["Muy débil", "Débil", "Aceptable", "Fuerte", "Muy fuerte"];
  const colors = ["#F03E3E", "#FF922B", "#FCC419", "#51CF66", "#12B886"];
  return { score, label: labels[score], color: colors[score] };
}

/** Genera una contraseña fuerte y legible (con símbolos seguros). */
function generatePassword(): string {
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const symbols = "!@#$%*?-";
  const all = lower + upper + digits + symbols;
  const pick = (set: string) => set[Math.floor(Math.random() * set.length)];
  let pw = pick(lower) + pick(upper) + pick(digits) + pick(symbols);
  for (let k = 0; k < 10; k++) pw += pick(all);
  return pw
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
}

export function ExpressRegister({
  defaultEmail,
  onAuthenticated,
  onGoogleRedirect,
}: {
  defaultEmail: string;
  onAuthenticated: (uid: string) => void;
  /** En móvil el popup de Google falla; el padre guarda el avance y usa redirect. */
  onGoogleRedirect?: () => Promise<void>;
}) {
  const { signUp, signIn, signInWithGoogle } = useAuth();
  const [mode, setMode] = useState<"crear" | "iniciar">("crear");
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [consent, setConsent] = useState(false);
  const [consentInvalid, setConsentInvalid] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const strength = useMemo(() => scorePassword(password), [password]);

  function autogenerate() {
    const pw = generatePassword();
    setPassword(pw);
    setShowPw(true);
    setError(null);
    try {
      void navigator.clipboard?.writeText(pw).then(
        () => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2500);
        },
        () => {},
      );
    } catch {
      /* clipboard opcional */
    }
  }

  /** Registra el consentimiento con el token recién emitido (misma ruta que /ingresar). */
  async function recordConsent() {
    try {
      const current = getAuthClient().currentUser;
      if (current) {
        await fetch("/api/consents/register", {
          method: "POST",
          headers: { "content-type": "application/json", ...(await buildAuthHeaders(current)) },
          body: JSON.stringify({ version: CONSENT_CURRENT_VERSION, surface: "REGISTRATION" }),
        });
      }
    } catch {
      // Si falla, el wizard volverá a pedir el consentimiento; no bloqueamos.
    }
  }

  async function submitGoogle() {
    setError(null);
    if (!consent) {
      setConsentInvalid(true);
      setError("Marca la aceptación de tratamiento de datos para continuar con Google.");
      return;
    }
    const isMobile = typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    // En móvil el popup de Google falla (auth/internal-error); usamos redirect:
    // el padre guarda el avance y navega a Google. Al volver, continúa solo.
    if (isMobile && onGoogleRedirect) {
      setBusy(true);
      try {
        await onGoogleRedirect(); // navega fuera; la vuelta la maneja el padre
      } catch (err) {
        setError(googleError(err));
        setBusy(false);
      }
      return;
    }
    setBusy(true);
    try {
      const uid = await signInWithGoogle();
      await recordConsent();
      onAuthenticated(uid); // ya quedó logueado, seguimos en el recorrido
    } catch (err) {
      // Fallback: si el popup falla por error interno/red (iframe bloqueado, etc.),
      // reintentamos con REDIRECT (no usa iframe). El padre guarda el avance.
      const code = (err as { code?: string })?.code ?? "";
      if ((code.includes("internal-error") || code.includes("network")) && onGoogleRedirect) {
        try {
          await onGoogleRedirect(); // navega fuera; la vuelta la maneja el padre
          return;
        } catch {
          /* si el redirect tampoco puede, mostramos el mensaje claro abajo */
        }
      }
      setError(googleError(err));
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    setError(null);
    const mail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
      setError("Escribe un correo válido.");
      return;
    }
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (mode === "crear" && !consent) {
      setConsentInvalid(true);
      setError("Para crear tu cuenta debes aceptar el tratamiento de datos (Ley 1581 de 2012).");
      return;
    }
    setBusy(true);
    try {
      const uid = mode === "iniciar"
        ? await signIn(mail, password, remember)
        : await (async () => { const u = await signUp(mail, password, remember); await recordConsent(); return u; })();
      onAuthenticated(uid); // continúa el recorrido con la sesión ya activa
    } catch (err) {
      setError(mapFirebaseAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-xl shadow-violet-500/10">
      <div className="mb-1 inline-flex items-center gap-2 rounded-full bg-violet-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-violet-700">
        🔒 Vas a mitad de camino
      </div>
      <h2 className="mt-2 text-2xl font-black text-[#17151F]">
        {mode === "crear" ? "Crea tu cuenta y guarda tu avance" : "Entra a tu cuenta"}
      </h2>
      <p className="mt-1.5 text-sm text-slate-500">
        {mode === "crear"
          ? "Regístrate para guardar tu información y verla en cualquier momento y desde cualquier dispositivo. Además podrás firmar, invitar y administrar tu arriendo. Toma 20 segundos."
          : "Ingresa con tu correo y contraseña para continuar el expediente."}
      </p>

      {/* Esta pantalla es SOLO para acceder: sin promociones ni distractores, para
          que el registro pase desapercibido y sea fácil. La promo de introducción
          se muestra como banner cerrable en otras partes (nunca aquí ni en el pago). */}

      <div className="mt-5 space-y-4">
        {mode === "crear" && (
          <>
            {/* Consentimiento ARRIBA: Google lo exige, así se ve y se marca antes
                de tocar el botón (antes quedaba abajo y "no pasaba nada"). */}
            <DataConsentCheckbox
              checked={consent}
              onChange={(v) => {
                setConsent(v);
                if (v) setConsentInvalid(false);
              }}
              invalid={consentInvalid}
              errorMessage="Debes aceptar el tratamiento de datos para crear tu cuenta."
            />
            {error && (
              <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700" role="alert">
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={() => void submitGoogle()}
              disabled={busy}
              className="flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09a6.6 6.6 0 0 1 0-4.18V7.07H2.18a11 11 0 0 0 0 9.86l3.66-2.84z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
              </svg>
              Continuar con Google
            </button>
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span className="h-px flex-1 bg-slate-200" />o con tu correo<span className="h-px flex-1 bg-slate-200" />
            </div>
          </>
        )}
        <div>
          <label htmlFor="er-email" className="mb-1 block text-sm font-medium text-slate-700">
            Tu correo
          </label>
          <input
            id="er-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tucorreo@ejemplo.com"
            className="w-full rounded-xl border-2 border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-violet-500"
          />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label htmlFor="er-pw" className="block text-sm font-medium text-slate-700">
              Contraseña
            </label>
            <button
              type="button"
              onClick={autogenerate}
              className="rounded-lg bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-700 transition hover:bg-violet-200"
            >
              ✨ Autogenerar segura
            </button>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="er-pw"
              type={showPw ? "text" : "password"}
              autoComplete={mode === "iniciar" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(null);
              }}
              placeholder="Mínimo 6 caracteres"
              className="w-full rounded-xl border-2 border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-violet-500"
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="shrink-0 rounded-xl border-2 border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-600 transition hover:border-violet-400"
              aria-label={showPw ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {showPw ? "Ocultar" : "Ver"}
            </button>
          </div>

          {mode === "crear" && password.length > 0 && (
            <div className="mt-2">
              <div className="flex h-1.5 gap-1">
                {[0, 1, 2, 3].map((k) => (
                  <div
                    key={k}
                    className="h-full flex-1 rounded-full transition"
                    style={{ background: k < strength.score ? strength.color : "#E9ECEF" }}
                  />
                ))}
              </div>
              <p className="mt-1 text-[11px] font-medium" style={{ color: strength.color }}>
                Seguridad: {strength.label}
              </p>
            </div>
          )}
          {copied && <p className="mt-1 text-[11px] font-medium text-emerald-600">Copiada al portapapeles. Guárdala en un lugar seguro.</p>}
          {mode === "crear" && (
            <p className="mt-1.5 text-[11px] text-slate-400">
              Consejo: usa 12+ caracteres, mezcla mayúsculas, números y un símbolo. O toca “Autogenerar”.
            </p>
          )}
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="h-4 w-4 accent-[#5646E5]"
          />
          Recordarme en este dispositivo (no cierres la sesión al salir)
        </label>

        {mode === "iniciar" && error && (
          <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700" role="alert">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy}
          className="w-full rounded-2xl bg-[#FF6B4A] px-6 py-3.5 text-base font-bold text-white shadow-lg shadow-orange-500/30 transition hover:brightness-105 active:scale-95 disabled:opacity-50"
        >
          {busy ? "Procesando…" : mode === "crear" ? "Crear cuenta y entrar con mis datos →" : "Entrar con mis datos →"}
        </button>

        <p className="text-center text-sm text-slate-500">
          {mode === "crear" ? "¿Ya tienes cuenta?" : "¿Aún no tienes cuenta?"}{" "}
          <button
            type="button"
            onClick={() => {
              setMode((m) => (m === "crear" ? "iniciar" : "crear"));
              setError(null);
            }}
            className="font-semibold text-violet-700 underline"
          >
            {mode === "crear" ? "Inicia sesión" : "Créala aquí"}
          </button>
        </p>
      </div>
    </div>
  );
}
