"use client";

import { SIGNING_CONSENT_TEXTS, SIGNING_DATA_CONFIRMATION_TEXT } from "@/domain/signatures/signingConsentTexts";
import { ReadAloudButton } from "@/components/a11y/read-aloud-button";
import { ResponsibilityAlertsBlock } from "@/components/contracts/responsibility-alerts-block";
import type { ResponsibilitySignal } from "@/domain/contracts/responsibilityAlerts";
import { formatAppDateTime } from "@/lib/datetime/appTime";
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

/** Etiqueta amigable del rol del firmante (no el código crudo). */
function friendlyRole(partyType: string): string {
  const p = (partyType || "").toLowerCase();
  if (p.includes("landlord") || p.includes("arrendador")) return "Arrendador (dueño)";
  if (p.includes("tenant") || p.includes("arrendatario") || p.includes("inquilino")) return "Arrendatario (inquilino)";
  if (partyType.startsWith("solidaryCoDebtor_")) return `Codeudor solidario ${partyType.slice("solidaryCoDebtor_".length)}`;
  if (p.includes("solidary") || p.includes("codebtor") || p.includes("codeudor")) return "Codeudor solidario";
  return partyType;
}

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
  const [completed, setCompleted] = useState(false);
  const [fullySigned, setFullySigned] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpInfo, setOtpInfo] = useState("");
  const [resp, setResp] = useState<{ intro: string; signals: ResponsibilitySignal[] } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/contracts/responsibility-alerts/by-token?token=${encodeURIComponent(token)}`);
        const j = (await r.json()) as { success?: boolean; intro?: string; signals?: ResponsibilitySignal[] };
        if (!cancelled && j.success && j.intro) setResp({ intro: j.intro, signals: j.signals ?? [] });
      } catch {
        /* si no hay constancia aún, no se muestra el bloque */
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

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
      setFullySigned(data.contractStatus === "signed");
      setCompleted(true);
      setError("");
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("Error de red al completar la firma.");
    } finally {
      setSubmitting(false);
    }
  }

  function nextStepsForRole(partyType: string): { title: string; body: string } {
    const t = (partyType || "").toLowerCase();
    if (t.includes("landlord") || t.includes("arrendador") || t.includes("owner") || t.includes("propietario")) {
      return {
        title: "Eres el arrendador (dueño)",
        body: "Cuando todas las partes firmen, recibirás el contrato firmado por correo. Puedes entrar a arriendoseguro.app para hacerle seguimiento al arriendo, registrar pagos y la posventa.",
      };
    }
    if (t.includes("codebtor") || t.includes("codeudor") || t.includes("solidary") || t.includes("solidario")) {
      return {
        title: "Eres el codeudor solidario",
        body: "¡Listo! Completaste tu parte del proceso. Te avisaremos por correo cuando el contrato quede totalmente firmado. Te invitamos a conocer arriendoseguro.app para tus propios arriendos.",
      };
    }
    if (t.includes("tenant") || t.includes("arrendatario") || t.includes("inquilino")) {
      return {
        title: "Eres el inquilino (arrendatario)",
        body: "¡Listo! Ya firmaste. Cuando todas las partes firmen, recibirás el contrato firmado por correo. Ponte en contacto con el arrendador (dueño) para coordinar la entrega del inmueble y continuar.",
      };
    }
    return {
      title: "Firma completada",
      body: "Cuando todas las partes firmen, recibirás el contrato firmado por correo.",
    };
  }

  if (loading) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-[#F5F3EF] text-[#17151F]">
        <div className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full opacity-40 blur-3xl" style={{ background: "radial-gradient(circle,#9B6BFF,#5646E5)" }} />
        <main className="relative z-10 mx-auto max-w-2xl px-6 py-10 text-slate-500">Cargando enlace de firma…</main>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#F5F3EF] text-[#17151F]">
      <div className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full opacity-40 blur-3xl" style={{ background: "radial-gradient(circle,#9B6BFF,#5646E5)" }} />
      <div className="pointer-events-none absolute -bottom-28 -left-24 h-72 w-72 rounded-full opacity-40 blur-3xl" style={{ background: "radial-gradient(circle,#FFB03A,#FF6B4A)" }} />
      <main className="relative z-10 mx-auto max-w-2xl space-y-4 px-6 py-8">
      <h1 className="text-balance text-3xl font-extrabold tracking-tight">Firma electrónica del contrato</h1>
      <p className="text-sm text-slate-600">
        Por seguridad, primero validamos un código de un solo uso (OTP) enviado a tu correo; después podrás aceptar
        las declaraciones y firmar. Ley 527 de 1999 (orientación general, no asesoría legal).
      </p>
      {/* El error se muestra arriba solo durante el paso del código (OTP). En el
          paso de firma se muestra junto al botón, para no duplicar el mensaje. */}
      {error && !completed && !info?.otpVerified && (
        <p className="rounded border border-rose-700 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>
      )}

      {completed && (
        <section className="space-y-3 rounded-2xl border-2 border-emerald-500 bg-emerald-50 p-5">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-lg font-bold text-white">
              ✓
            </span>
            <h2 className="text-xl font-bold text-emerald-900">{okMsg}</h2>
          </div>
          {fullySigned ? (
            <p className="text-sm text-emerald-900">
              El contrato quedó <strong>completamente firmado por todas las partes</strong>. Cada firmante recibirá el
              documento final por correo.
            </p>
          ) : (
            <p className="text-sm text-emerald-900">
              Tu firma quedó registrada. Aún faltan otras partes por firmar; te avisaremos por correo cuando el contrato
              quede totalmente firmado.
            </p>
          )}

          {info && (
            <div className="rounded-xl border border-emerald-300 bg-white/70 p-3">
              <p className="text-sm font-semibold text-slate-900">{nextStepsForRole(info.partyType).title}</p>
              <p className="mt-1 text-sm text-slate-700">{nextStepsForRole(info.partyType).body}</p>
            </div>
          )}

          {(() => {
            const role = (info?.partyType ?? "").toLowerCase();
            const isLandlord =
              role.includes("landlord") ||
              role.includes("arrendador") ||
              role.includes("owner") ||
              role.includes("propietario");
            return isLandlord ? (
              <div className="rounded-xl border border-emerald-300 bg-white/70 p-3 text-sm text-slate-800">
                <p className="font-semibold text-slate-900">¿Qué haces ahora, como dueño?</p>
                <p className="mt-1">
                  Entra a tu cuenta en ArriendoSeguro para seguir el proceso: ver quién ha firmado, descargar el
                  contrato final y continuar con la posventa (pagos, inventario y más).
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                <p className="font-semibold">Un último paso de tu parte</p>
                <p className="mt-1">
                  <strong>Ponte en contacto con el arrendador (dueño)</strong> para continuar con el proceso (por
                  ejemplo, coordinar la entrega del inmueble). No necesitas crear una cuenta para esto.
                </p>
              </div>
            );
          })()}

          <p className="text-sm font-medium text-slate-800">
            Ya puedes cerrar esta pantalla con tranquilidad. 👋
          </p>

          <div className="flex flex-wrap gap-2 pt-1">
            {info?.pdfUrl && (
              <a
                href={info.pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-emerald-600 bg-white px-3 py-2 text-sm font-medium text-emerald-800"
              >
                Ver o descargar el contrato (PDF)
              </a>
            )}
            {(() => {
              const role = (info?.partyType ?? "").toLowerCase();
              const isLandlord =
                role.includes("landlord") ||
                role.includes("arrendador") ||
                role.includes("owner") ||
                role.includes("propietario");
              return isLandlord ? (
                <a
                  href="https://arriendoseguro.app/ingresar"
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white"
                >
                  Entrar a mi cuenta →
                </a>
              ) : (
                <a
                  href="https://arriendoseguro.app"
                  className="rounded-lg border border-emerald-600 bg-white px-3 py-2 text-sm font-medium text-emerald-800"
                >
                  Conocer arriendoseguro.app
                </a>
              );
            })()}
          </div>
        </section>
      )}

      {info && !completed && info.signatureStatus === "signed" && (
        <section className="space-y-3 rounded-2xl border-2 border-emerald-500 bg-emerald-50 p-5">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-lg font-bold text-white">
              ✓
            </span>
            <h2 className="text-xl font-bold text-emerald-900">Ya firmaste este contrato</h2>
          </div>
          <p className="text-sm text-emerald-900">
            Tu firma ya quedó registrada con su evidencia (fecha, IP y hash). No necesitas volver a firmar.
          </p>
          <div className="rounded-xl border border-emerald-300 bg-white/70 p-3">
            <p className="text-sm font-semibold text-slate-900">{nextStepsForRole(info.partyType).title}</p>
            <p className="mt-1 text-sm text-slate-700">{nextStepsForRole(info.partyType).body}</p>
          </div>
          <p className="text-sm font-medium text-slate-800">Ya puedes cerrar esta pantalla con tranquilidad. 👋</p>
          {info.pdfUrl && (
            <a
              href={info.pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex rounded-lg border border-emerald-600 bg-white px-3 py-2 text-sm font-medium text-emerald-800"
            >
              Ver o descargar el contrato (PDF)
            </a>
          )}
        </section>
      )}

      {info && !completed && info.signatureStatus !== "signed" && (
        <section className="space-y-3 rounded-xl border border-slate-300 bg-white/95 p-4">
          <p>
            <strong>Firmante:</strong> {info.signerName}
          </p>
          <p>
            <strong>Correo:</strong> {info.signerEmail}
          </p>
          <p>
            <strong>Rol:</strong> {friendlyRole(info.partyType)}
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
            <strong>Expira:</strong> {formatAppDateTime(info.tokenExpiresAt)}
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
                {otpBusy ? "Enviando…" : "Solicitar código de seguridad"}
              </button>
              <p className="text-xs text-slate-600">
                El código llega a <strong>{info.signerEmail}</strong>. Si no te llega en un par de minutos, revisa la carpeta
                de <strong>spam / correo no deseado</strong> o promociones, o <strong>vuelve a pulsar el botón</strong> para
                reenviarlo.
              </p>
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
              {resp && (
                <ResponsibilityAlertsBlock intro={resp.intro} signals={resp.signals} audience="tenant" />
              )}
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-900">Paso 2 — Declaraciones y firma</h2>
                <ReadAloudButton
                  text={`${SIGNING_CONSENT_TEXTS.contractReadingAcceptance}. ${SIGNING_CONSENT_TEXTS.electronicSignatureAcceptance}. ${SIGNING_DATA_CONFIRMATION_TEXT}`}
                  label="Escuchar las declaraciones"
                />
              </div>
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
              {error && (
                <p className="rounded border border-rose-400 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>
              )}
            </div>
          )}
        </section>
      )}
      </main>
    </div>
  );
}
