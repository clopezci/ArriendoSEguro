"use client";

import { SIGNING_CONSENT_TEXTS, SIGNING_DATA_CONFIRMATION_TEXT } from "@/domain/signatures/signingConsentTexts";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type TokenInfoOk = {
  success: true;
  signerName: string;
  signerEmail: string;
  partyType: string;
  contractId: string;
  contractVersionId: string;
  versionNumber: number;
  documentHash: string;
  pdfUrl: string | null;
  signatureStatus: string;
  tokenExpiresAt: string;
  otpVerified: boolean;
};

type TokenInfoErr = { success: false; errors: { field: string; message: string }[] };

export default function SignatureTokenPage() {
  const token = String(useParams<{ token: string }>().token);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState<TokenInfoOk | null>(null);
  const [consentA, setConsentA] = useState(false);
  const [consentB, setConsentB] = useState(false);
  const [consentData, setConsentData] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [okMsg, setOkMsg] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpInfo, setOtpInfo] = useState("");

  async function loadTokenInfo() {
    setLoading(true);
    try {
      const res = await fetch(`/api/signatures/token-info?token=${encodeURIComponent(token)}`);
      const data = (await res.json()) as TokenInfoOk | TokenInfoErr;
      if (!res.ok || !data.success) {
        const msg = !data.success ? data.errors.map((e) => e.message).join(" | ") : "Enlace inválido.";
        setError(msg);
        setInfo(null);
        return;
      }
      setInfo(data);
      setError("");
    } catch {
      setError("No se pudo cargar la información de firma.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTokenInfo();
  }, [token]);

  async function onRequestOtp() {
    setOtpBusy(true);
    setOtpInfo("");
    setError("");
    try {
      const res = await fetch("/api/signatures/request-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = (await res.json()) as { success: boolean; message?: string; errors?: { message: string }[] };
      if (!res.ok || !data.success) {
        const msg = data.errors?.map((e) => e.message).join(" | ") ?? "No se pudo enviar el código.";
        setError(msg);
        return;
      }
      setOtpInfo(data.message ?? "Revisa tu correo e ingresa el código de 6 dígitos.");
    } catch {
      setError("Error de red al solicitar el código.");
    } finally {
      setOtpBusy(false);
    }
  }

  async function onVerifyOtp() {
    if (!/^\d{6}$/.test(otpCode.trim())) {
      setError("El código debe tener 6 dígitos.");
      return;
    }
    setOtpBusy(true);
    setError("");
    try {
      const res = await fetch("/api/signatures/verify-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, code: otpCode.trim() }),
      });
      const data = (await res.json()) as { success: boolean; message?: string; errors?: { message: string }[] };
      if (!res.ok || !data.success) {
        const msg = data.errors?.map((e) => e.message).join(" | ") ?? "Código no válido.";
        setError(msg);
        return;
      }
      setOtpInfo(data.message ?? "Código verificado.");
      setInfo((prev) => (prev ? { ...prev, otpVerified: true } : prev));
      setOtpCode("");
    } catch {
      setError("Error de red al verificar el código.");
    } finally {
      setOtpBusy(false);
    }
  }

  async function onSign() {
    if (!consentA || !consentB || !consentData) {
      setError("Debes aceptar las declaraciones para firmar.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/signatures/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token,
          consentAccepted: true,
          electronicSignatureAccepted: true,
          dataConfirmationAccepted: true,
        }),
      });
      const data = (await res.json()) as
        | {
            success: true;
            contractStatus: string;
            partyEmailDelivery?: "ok" | "partial" | "failed";
          }
        | { success: false; errors: { field: string; message: string }[] };
      if (!res.ok || !data.success) {
        const msg = !data.success ? data.errors.map((e) => e.message).join(" | ") : "No se pudo completar la firma.";
        setError(msg);
        return;
      }
      let msg =
        data.contractStatus === "signed"
          ? "Firma registrada. El contrato quedó completamente firmado."
          : "Firma registrada correctamente.";
      if (data.contractStatus === "signed") {
        if (data.partyEmailDelivery === "partial") {
          msg +=
            " Algunas partes no recibieron el aviso por correo; revisa spam o promociones. El contrato sí quedó firmado.";
        } else if (data.partyEmailDelivery === "failed") {
          msg +=
            " No pudimos enviar el aviso por correo a las partes; el contrato sí quedó firmado. Revisa la configuración del correo del sistema.";
        }
      }
      setOkMsg(msg);
    } catch {
      setError("Error de red al completar la firma.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <main className="mx-auto max-w-3xl p-6 text-slate-800">Cargando enlace de firma...</main>;

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-6 text-slate-900">
      <h1 className="text-2xl font-bold">Firma electrónica del contrato</h1>
      <p className="text-sm text-slate-600">
        Por seguridad, primero validamos un código de un solo uso (OTP) enviado a tu correo; después podrás aceptar
        las declaraciones y firmar. Ley 527 de 1999 (orientación general, no asesoría legal).
      </p>
      {error && <p className="rounded border border-rose-700 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {okMsg && <p className="rounded border border-emerald-500 bg-emerald-50 p-3 text-sm text-emerald-700">{okMsg}</p>}
      {info && (
        <section className="space-y-3 rounded-xl border border-slate-300 bg-white/95 p-4">
          <p>
            <strong>Firmante:</strong> {info.signerName}
          </p>
          <p>
            <strong>Correo:</strong> {info.signerEmail}
          </p>
          <p>
            <strong>Rol:</strong> {info.partyType}
          </p>
          <p>
            <strong>Contrato:</strong> {info.contractId}
          </p>
          <p>
            <strong>Versión:</strong> {info.versionNumber}
          </p>
          <p>
            <strong>Hash documental:</strong> {info.documentHash}
          </p>
          <p>
            <strong>Expira:</strong> {new Date(info.tokenExpiresAt).toLocaleString("es-CO")}
          </p>
          <div className="flex flex-wrap gap-2">
            {info.pdfUrl && (
              <a
                href={info.pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-violet-500 px-3 py-2 text-sm text-violet-700"
              >
                Ver o descargar PDF
              </a>
            )}
          </div>

          {!info.otpVerified ? (
            <div className="space-y-3 rounded-lg border border-violet-200 bg-violet-50/60 p-3">
              <h2 className="text-sm font-semibold text-violet-900">Paso 1 — Código de verificación</h2>
              {otpInfo ? <p className="text-sm text-violet-800">{otpInfo}</p> : null}
              <button
                type="button"
                onClick={() => void onRequestOtp()}
                disabled={otpBusy}
                className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {otpBusy ? "Enviando…" : "Solicitar o reenviar código al correo"}
              </button>
              <div className="flex flex-wrap items-end gap-2">
                <label className="block text-sm">
                  Código de 6 dígitos
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    autoComplete="one-time-code"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="mt-1 block w-40 rounded border border-slate-300 px-2 py-1 font-mono text-lg tracking-widest"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void onVerifyOtp()}
                  disabled={otpBusy || otpCode.length !== 6}
                  className="rounded-lg border border-violet-600 px-3 py-2 text-sm font-medium text-violet-800 disabled:opacity-50"
                >
                  Verificar código
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3">
              <h2 className="text-sm font-semibold text-slate-900">Paso 2 — Declaraciones y firma</h2>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={consentA} onChange={(e) => setConsentA(e.target.checked)} />
                <span>{SIGNING_CONSENT_TEXTS.contractReadingAcceptance}</span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={consentB} onChange={(e) => setConsentB(e.target.checked)} />
                <span>{SIGNING_CONSENT_TEXTS.electronicSignatureAcceptance}</span>
              </label>
              <label className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">
                <input type="checkbox" checked={consentData} onChange={(e) => setConsentData(e.target.checked)} className="mt-0.5" />
                <span>{SIGNING_DATA_CONFIRMATION_TEXT}</span>
              </label>
              <button
                type="button"
                onClick={() => void onSign()}
                disabled={submitting}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {submitting ? "Firmando..." : "Firmar electrónicamente"}
              </button>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
