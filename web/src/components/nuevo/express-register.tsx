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
}: {
  defaultEmail: string;
  onAuthenticated: (uid: string) => void;
}) {
  const { signUp, signIn } = useAuth();
  const [mode, setMode] = useState<"crear" | "iniciar">("crear");
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
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
      if (mode === "iniciar") {
        await signIn(mail, password);
      } else {
        await signUp(mail, password);
        // Registra el consentimiento con el token recién emitido (misma ruta que /ingresar).
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
      const uid = getAuthClient().currentUser?.uid;
      if (!uid) {
        setError("No se pudo confirmar la sesión. Intenta de nuevo.");
        return;
      }
      onAuthenticated(uid);
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
          ? "Así guardamos tu expediente y podrás firmar, invitar y hacer la posventa. Toma 20 segundos."
          : "Ingresa con tu correo y contraseña para continuar el expediente."}
      </p>

      <div className="mt-5 space-y-4">
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

        {mode === "crear" && (
          <DataConsentCheckbox
            checked={consent}
            onChange={(v) => {
              setConsent(v);
              if (v) setConsentInvalid(false);
            }}
            invalid={consentInvalid}
            errorMessage="Debes aceptar el tratamiento de datos para crear tu cuenta."
          />
        )}

        {error && (
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
          {busy ? "Procesando…" : mode === "crear" ? "Crear cuenta y continuar →" : "Entrar y continuar →"}
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
