"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import type { User } from "firebase/auth";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";

/**
 * Compuerta de segundo factor del panel admin. Si el admin no ha enrolado su
 * autenticador, lo guía a enrolarlo (QR + código + códigos de respaldo). Si ya
 * está enrolado pero sin sesión MFA vigente, pide el código. Al validar, llama
 * `onVerified` (la página recarga para que todo cargue con la sesión MFA).
 */
export function AdminMfaGate({ user, enrolled, onVerified }: { user: User; enrolled: boolean; onVerified: () => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Enrolamiento
  const [otpauthUri, setOtpauthUri] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);

  async function startEnroll() {
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/mfa/enroll", { method: "POST", headers: { ...(await buildAuthHeaders(user)) } });
      const json = (await res.json()) as { success?: boolean; otpauthUri?: string; secret?: string; errors?: { message?: string }[] };
      if (!res.ok || !json.success || !json.otpauthUri) {
        setErr(json.errors?.[0]?.message ?? "No se pudo iniciar el enrolamiento.");
      } else {
        setOtpauthUri(json.otpauthUri);
        setSecret(json.secret ?? null);
        setQrDataUrl(await QRCode.toDataURL(json.otpauthUri, { width: 220, margin: 1 }));
      }
    } catch {
      setErr("Error de red.");
    } finally {
      setBusy(false);
    }
  }

  // Si no está enrolado, arranca el enrolamiento automáticamente.
  useEffect(() => {
    if (!enrolled) void startEnroll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enrolled]);

  async function submit() {
    setErr(null);
    setBusy(true);
    try {
      const endpoint = enrolled ? "/api/admin/mfa/verify" : "/api/admin/mfa/confirm";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({ code: code.trim() }),
      });
      const json = (await res.json()) as { success?: boolean; backupCodes?: string[]; errors?: { message?: string }[] };
      if (!res.ok || !json.success) {
        setErr(json.errors?.[0]?.message ?? "Código incorrecto.");
        return;
      }
      if (!enrolled && json.backupCodes) {
        setBackupCodes(json.backupCodes); // muestra los códigos antes de continuar
      } else {
        onVerified();
      }
    } catch {
      setErr("Error de red.");
    } finally {
      setBusy(false);
    }
  }

  const box = "min-h-screen bg-slate-50 text-slate-800 flex items-center justify-center px-4";
  const card = "w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm";

  // Pantalla de códigos de respaldo (tras enrolar).
  if (backupCodes) {
    return (
      <div className={box}>
        <div className={card}>
          <h1 className="text-lg font-black text-slate-900">Guarda tus códigos de respaldo</h1>
          <p className="mt-1 text-sm text-slate-600">
            Úsalos para entrar si pierdes el teléfono. Cada uno sirve una vez. Guárdalos en un lugar seguro — no se volverán a mostrar.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-sm text-slate-800">
            {backupCodes.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>
          <button
            type="button"
            onClick={onVerified}
            className="mt-4 w-full rounded-lg bg-[#5646E5] px-4 py-2.5 text-sm font-bold text-white hover:brightness-110"
          >
            Ya los guardé, continuar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={box}>
      <div className={card}>
        <p className="text-xs font-medium uppercase tracking-wide text-violet-400">Panel administrativo</p>
        <h1 className="mt-1 text-lg font-black text-slate-900">
          {enrolled ? "Verificación en dos pasos" : "Configura tu segundo factor"}
        </h1>

        {!enrolled && (
          <>
            <p className="mt-1 text-sm text-slate-600">
              Escanea este código con <strong>Google Authenticator</strong> (o Authy) y luego escribe el código de 6 dígitos.
            </p>
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrDataUrl} alt="Código QR para el autenticador" className="mx-auto mt-3 h-[220px] w-[220px]" />
            ) : (
              <p className="mt-3 text-sm text-slate-500">Generando código…</p>
            )}
            {secret && (
              <p className="mt-2 break-all text-center text-xs text-slate-500">
                ¿No puedes escanear? Ingresa esta clave: <span className="font-mono text-slate-700">{secret}</span>
              </p>
            )}
          </>
        )}

        {enrolled && (
          <p className="mt-1 text-sm text-slate-600">
            Escribe el código de 6 dígitos de tu app autenticadora (o un código de respaldo).
          </p>
        )}

        <input
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && code.trim() && void submit()}
          placeholder="123456"
          className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-center text-lg tracking-widest text-slate-900"
        />

        {err && <p className="mt-2 text-sm text-rose-600">{err}</p>}

        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy || code.trim().length < 6}
          className="mt-4 w-full rounded-lg bg-[#5646E5] px-4 py-2.5 text-sm font-bold text-white hover:brightness-110 disabled:opacity-40"
        >
          {busy ? "Validando…" : enrolled ? "Verificar" : "Activar segundo factor"}
        </button>
      </div>
    </div>
  );
}
