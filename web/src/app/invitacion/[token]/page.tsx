"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PartyDataFields } from "@/components/contracts/party-data-fields";
import { OathEvidenceBadge } from "@/components/contracts/oath-evidence-badge";
import { sanitizePartyFromForm } from "@/features/contracts/party-sanitize";
import { buildWhatsAppUrl } from "@/lib/nuevo/whatsapp";
import { InviteSupportsUpload } from "@/components/contracts/invite-supports-upload";
import type { PartyDraft } from "@/features/contracts/draft-types";

type Info = {
  usable?: boolean;
  status?: string;
  role?: string;
  roleLabel?: string;
  inviterName?: string;
  inviteeName?: string;
  hasEmail?: boolean;
  emailMasked?: string;
  monthlyRent?: number;
  requiredDocs?: string[];
};

type Phase = "loading" | "invalid" | "otp" | "form" | "done";

export default function InvitacionPage() {
  const token = String(useParams<{ token: string }>().token);
  const [phase, setPhase] = useState<Phase>("loading");
  const [info, setInfo] = useState<Info | null>(null);
  const [code, setCode] = useState("");
  const [finished, setFinished] = useState(false);
  // Correo que ingresa la persona cuando el enlace llegó por WhatsApp (sin correo
  // pre-registrado): sirve para enviarle el código de verificación.
  const [otpEmail, setOtpEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [party, setParty] = useState<PartyDraft>({});
  const [formKey, setFormKey] = useState(0);
  const [hasSavedProfile, setHasSavedProfile] = useState(false);
  const [saveProfile, setSaveProfile] = useState(true);
  // Consentimientos adicionales SOLO del codeudor solidario (firma electrónica +
  // aceptación de la obligación solidaria), con su evidencia.
  const [elecSigChecked, setElecSigChecked] = useState(false);
  const [solidaryChecked, setSolidaryChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/party-invite/info?token=${encodeURIComponent(token)}`);
        const j = (await res.json()) as { success?: boolean } & Info;
        if (cancelled) return;
        if (!res.ok || !j.success || !j.usable) {
          setInfo(j);
          setPhase("invalid");
          return;
        }
        setInfo(j);
        // Si ya había completado sus datos (p. ej. recargó la pantalla), lo
        // llevamos directo a documentos, no de vuelta al código ni a error.
        setPhase(j.status === "completed" ? "done" : "otp");
      } catch {
        if (!cancelled) setPhase("invalid");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const requestOtp = useCallback(async () => {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/party-invite/request-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // Si la invitación no traía correo (llegó por WhatsApp), mandamos el que
        // escribió la persona para que le llegue el código.
        body: JSON.stringify({ token, ...(otpEmail.includes("@") ? { email: otpEmail.trim() } : {}) }),
      });
      const j = (await res.json()) as { success?: boolean; errors?: { message?: string }[] };
      setMsg(res.ok && j.success ? "Te enviamos un código a tu correo." : j.errors?.[0]?.message ?? "No se pudo enviar el código.");
    } catch {
      setMsg("Error de red.");
    } finally {
      setBusy(false);
    }
  }, [token, otpEmail]);

  async function verifyOtp() {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/party-invite/verify-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, code: code.trim() }),
      });
      const j = (await res.json()) as { success?: boolean; profile?: PartyDraft | null; errors?: { message?: string }[] };
      if (!res.ok || !j.success) {
        setMsg(j.errors?.[0]?.message ?? "Código inválido.");
        return;
      }
      if (j.profile) {
        setParty({ ...j.profile, truthfulnessOathAccepted: false });
        setHasSavedProfile(true);
        setFormKey((k) => k + 1);
      }
      // Si esta invitación YA estaba completada (la persona llenó sus datos antes),
      // no la mandamos otra vez al formulario: va directo a subir documentos.
      setPhase(info?.status === "completed" ? "done" : "form");
    } catch {
      setMsg("Error de red.");
    } finally {
      setBusy(false);
    }
  }

  function usarMisDatos() {
    // Vuelve a aplicar el perfil guardado (por si el usuario editó y quiere revertir).
    setFormKey((k) => k + 1);
  }

  async function onSubmit(formData: FormData) {
    setMsg("");
    // Datos mínimos: ya no se pide dirección de notificación a las personas.
    const sanitized = sanitizePartyFromForm(formData, { notificationAddress: "" });
    // Ingreso mensual + validación de solvencia: bloqueante si es INFERIOR al canon.
    const income = Number(String(formData.get("supportMonthlyIncome") ?? "").replace(/[^\d]/g, "")) || 0;
    const rent = info?.monthlyRent ?? 0;
    if (income <= 0) {
      setMsg("Indica tu ingreso mensual aproximado para continuar.");
      return;
    }
    if (rent > 0 && income < rent) {
      setMsg("Tu ingreso es inferior al valor del arriendo. Revísalo: no habría cómo respaldar el pago del canon.");
      return;
    }
    const payloadParty = { ...sanitized, notificationAddress: "", economicSupport: { monthlyIncome: income } };
    const isCodebtor = info?.role === "solidaryCoDebtor";
    // Aceptaciones del TITULAR (juramento + autorización de tratamiento de datos).
    // El codeudor además acepta el consentimiento de firma electrónica y la
    // obligación solidaria. Se envían aparte para guardarlas con evidencia.
    const acceptances = {
      truthfulnessOath: formData.get("truthfulnessOath") === "on",
      dataAuthorization: formData.get("dataAuthorizationOath") === "on",
      electronicSignature: formData.get("electronicSignatureConsent") === "on",
      solidaryObligation: formData.get("solidaryObligationAcceptance") === "on",
    };
    if (!acceptances.truthfulnessOath || !acceptances.dataAuthorization) {
      setMsg("Debes aceptar la declaración bajo juramento y la autorización de tratamiento de datos para continuar.");
      return;
    }
    if (isCodebtor && (!acceptances.electronicSignature || !acceptances.solidaryObligation)) {
      setMsg(
        "Como codeudor solidario, debes aceptar el consentimiento de firma electrónica y la obligación solidaria para continuar.",
      );
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/party-invite/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, party: payloadParty, saveProfile, acceptances }),
      });
      const j = (await res.json()) as { success?: boolean; errors?: { message?: string }[] };
      if (!res.ok || !j.success) {
        setMsg(j.errors?.[0]?.message ?? "No se pudieron enviar tus datos. Revisa nombre y documento.");
        return;
      }
      setPhase("done");
    } catch {
      setMsg("Error de red.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[#F5F3EF] text-[#17151F]">
      <div className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full opacity-40 blur-3xl" style={{ background: "radial-gradient(circle,#9B6BFF,#5646E5)" }} />
      <div className="pointer-events-none absolute -bottom-28 -left-24 h-72 w-72 rounded-full opacity-40 blur-3xl" style={{ background: "radial-gradient(circle,#FFB03A,#FF6B4A)" }} />
      <main className="relative z-10 mx-auto max-w-2xl space-y-5 px-4 py-8 sm:px-6">
      <header className="space-y-1">
        <span className="mb-1 inline-flex items-center gap-2 rounded-full bg-[#ECE9FB] px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#5646E5]">🔒 Invitación segura</span>
        <h1 className="text-balance text-3xl font-black tracking-tight sm:text-4xl">Registra tus datos para el arriendo</h1>
        {info?.inviterName && phase !== "invalid" && (
          <p className="text-sm text-slate-600">
            <strong>{info.inviterName}</strong> te invitó a registrar tus datos como{" "}
            <strong>{info.roleLabel ?? "parte del contrato"}</strong>. Tus datos son tuyos; los usaremos solo para este
            contrato (y para reutilizarlos si lo autorizas).
          </p>
        )}
      </header>

      {phase === "loading" && <p className="text-sm text-slate-600">Cargando…</p>}

      {phase === "invalid" && (
        <div className="rounded-2xl border-2 border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          Este enlace no es válido o ya expiró. Pídele a quien te invitó que te envíe uno nuevo.
        </div>
      )}

      {phase === "otp" && (
        <section className="space-y-3 rounded-3xl border border-slate-200 bg-white/95 shadow-[0_10px_30px_rgba(86,70,229,0.08)] p-4">
          <p className="text-sm text-slate-700">
            Para validar que eres tú, te enviaremos un <strong>código</strong> a tu correo
            {info?.hasEmail && info?.emailMasked ? ` (${info.emailMasked})` : ""}.
          </p>
          {!info?.hasEmail && (
            <label className="block text-sm">
              <span className="mb-1 block text-slate-700">Tu correo (para recibir el código)</span>
              <input
                type="email"
                value={otpEmail}
                onChange={(e) => setOtpEmail(e.target.value)}
                placeholder="tucorreo@ejemplo.com"
                className="w-64 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          )}
          <button
            type="button"
            onClick={() => void requestOtp()}
            disabled={busy || (!info?.hasEmail && !otpEmail.includes("@"))}
            className="rounded-xl bg-[#5646E5] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Enviando…" : "Enviar código a mi correo"}
          </button>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-sm">
              <span className="mb-1 block text-slate-700">Código de 6 dígitos</span>
              <input
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="w-40 rounded-lg border border-slate-300 px-3 py-2 text-center text-lg tracking-widest"
              />
            </label>
            <button
              type="button"
              onClick={() => void verifyOtp()}
              disabled={busy || code.length < 6}
              className="rounded-2xl border-2 border-[#5646E5]/30 px-4 py-2 text-sm font-semibold text-violet-700 disabled:opacity-50"
            >
              Validar
            </button>
          </div>
          {msg && <p className="text-xs text-slate-700">{msg}</p>}
        </section>
      )}

      {phase === "form" && (
        <section className="space-y-3">
          {hasSavedProfile && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-[#5646E5]/30 bg-violet-50/60 p-3 text-sm">
              <span className="text-slate-700">Tienes datos guardados de un arriendo anterior.</span>
              <button type="button" onClick={usarMisDatos} className="rounded-xl bg-[#5646E5] px-3 py-1.5 text-sm font-semibold text-white">
                Usar mis datos
              </button>
            </div>
          )}
          <form
            id="invite-form"
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              void onSubmit(new FormData(e.currentTarget));
            }}
          >
            <PartyDataFields
              key={formKey}
              party={party}
              oathId="invitee_truthfulness_oath"
              contractDraftId={token}
              selfDataAuthorization
              rentReference={info?.monthlyRent ?? 0}
              who={info?.role === "solidaryCoDebtor" ? "el codeudor" : "el inquilino"}
            />

            {info?.role === "solidaryCoDebtor" && (
              <div className="sm:col-span-2 space-y-2 rounded-xl border border-amber-500/40 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
                <p className="font-semibold text-amber-900">Como codeudor solidario, además:</p>
                <label className="flex cursor-pointer items-start gap-2">
                  <input
                    type="checkbox"
                    name="electronicSignatureConsent"
                    required
                    checked={elecSigChecked}
                    onChange={(e) => setElecSigChecked(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-amber-300"
                  />
                  <span>
                    <strong>Consentimiento de firma electrónica.</strong> Acepto firmar este contrato de forma
                    electrónica y que la firma tenga plena validez (Ley 527 de 1999).
                  </span>
                </label>
                <OathEvidenceBadge
                  active={elecSigChecked}
                  oathId="invitee_codebtor_electronic_signature_consent"
                  contractDraftId={token}
                />
                <label className="flex cursor-pointer items-start gap-2">
                  <input
                    type="checkbox"
                    name="solidaryObligationAcceptance"
                    required
                    checked={solidaryChecked}
                    onChange={(e) => setSolidaryChecked(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-amber-300"
                  />
                  <span>
                    <strong>Aceptación de la obligación solidaria.</strong> Acepto constituirme como{" "}
                    <strong>codeudor solidario</strong> del arrendatario y responder solidariamente por las obligaciones
                    del contrato (pago del canon, servicios y demás), conforme a los artículos 1568 y siguientes del
                    Código Civil.
                  </span>
                </label>
                <OathEvidenceBadge
                  active={solidaryChecked}
                  oathId="invitee_codebtor_solidary_obligation_acceptance"
                  contractDraftId={token}
                />
              </div>
            )}

            <label className="sm:col-span-2 flex items-start gap-2 rounded-lg border border-slate-200 bg-white/75 p-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={saveProfile}
                onChange={(e) => setSaveProfile(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-violet-600"
              />
              <span>
                <strong>Guardar mis datos para futuros arriendos</strong> (solo tú, con un código a tu correo, podrás
                volver a cargarlos).
              </span>
            </label>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={busy}
                className="rounded-xl bg-[#5646E5] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy ? "Enviando…" : "Enviar mis datos al contrato"}
              </button>
            </div>
          </form>
          {msg && <p className="text-sm text-rose-700">{msg}</p>}
        </section>
      )}

      {phase === "done" && !finished && (
        <div className="space-y-4">
          <div className="rounded-2xl border-2 border-[#12B886]/40 bg-[#12B886]/10 p-4 text-sm text-emerald-800">
            <p className="font-semibold">¡Listo! Tus datos se enviaron al contrato.</p>
            <p className="mt-1">Quien te invitó podrá verlos e incluirlos. Ahora puedes subir tus documentos (opcional) y, al terminar, pulsar «Finalizar».</p>
          </div>

          {/* Subir documentos (soportes) desde el mismo enlace. */}
          <InviteSupportsUpload token={token} roleLabel={info?.role === "solidaryCoDebtor" ? "como codeudor" : "como arrendatario"} requiredDocs={info?.requiredDocs ?? []} />

          {info?.role === "tenant" && <CodebtorSection tenantToken={token} rentReference={info?.monthlyRent ?? 0} />}

          <button
            type="button"
            onClick={() => setFinished(true)}
            className="w-full rounded-2xl bg-[#5646E5] px-6 py-4 text-base font-bold text-white shadow-lg shadow-violet-500/30 transition hover:brightness-105 active:scale-95"
          >
            Finalizar ✓
          </button>
          <p className="text-center text-[11px] text-slate-400">Puedes volver a abrir este enlace cuando quieras para subir más documentos.</p>
        </div>
      )}

      {phase === "done" && finished && (
        <div className="space-y-4 text-center">
          <div className="rounded-3xl border-2 border-[#12B886]/40 bg-[#12B886]/10 p-8">
            <div className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-2xl bg-[#12B886] text-3xl text-white">✓</div>
            <p className="text-xl font-black text-emerald-800">¡Terminaste tu parte!</p>
            <p className="mt-1 text-sm text-emerald-800/90">
              Tus datos {info?.role === "solidaryCoDebtor" ? "de codeudor" : ""} y documentos quedaron guardados.{" "}
              <strong>{info?.inviterName || "Quien te invitó"}</strong> continúa desde su cuenta con la revisión, el
              contrato y la firma. <strong>Ya puedes cerrar esta página.</strong>
            </p>
            <p className="mt-2 text-xs text-emerald-800/70">Si necesitas subir otro documento, vuelve a abrir este mismo enlace.</p>
          </div>
          <button type="button" onClick={() => setFinished(false)} className="text-sm font-semibold text-[#5646E5] underline">← Volver a subir documentos</button>
        </div>
      )}
      </main>
    </div>
  );
}

/**
 * Sección para que el INQUILINO gestione al codeudor desde su propio enlace:
 * puede invitarlo (el codeudor completa y acepta por su cuenta) o ingresar sus
 * datos declarando que cuenta con su autorización (Ley 1581). Quien tiene la
 * relación con el codeudor es el inquilino, no el dueño.
 */
function CodebtorSection({ tenantToken, rentReference = 0 }: { tenantToken: string; rentReference?: number }) {
  const [mode, setMode] = useState<"choose" | "invite" | "enter">("choose");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState<"invited" | "entered" | "none" | null>(null);
  const [inviteUrl, setInviteUrl] = useState("");
  const [phone, setPhone] = useState("");
  // Slot del codeudor que el inquilino está agregando (0 = principal; 1, 2… más).
  const [slot, setSlot] = useState(0);

  function addAnother() {
    setSlot((s) => s + 1);
    setDone(null);
    setMode("choose");
    setEmail("");
    setName("");
    setPhone("");
    setInviteUrl("");
    setMsg("");
  }

  // Crea la invitación del codeudor y devuelve su enlace. El correo con el
  // código (OTP) se envía desde el servidor; `channel` solo cambia el mensaje.
  async function ensureCodebtorInvite(channel: "email" | "whatsapp"): Promise<string | null> {
    // Por correo se necesita el correo; por WhatsApp no (el codeudor lo ingresa
    // al abrir el enlace para recibir el código). Envío a elección del usuario.
    if (channel === "email" && !email.includes("@")) {
      setMsg("Para enviar por correo, escribe un correo válido del codeudor.");
      return null;
    }
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/party-invite/create-codebtor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenantToken, inviteeEmail: email.trim(), inviteeName: name.trim(), ...(slot > 0 ? { assignNewSlot: true } : {}) }),
      });
      const j = (await res.json()) as {
        success?: boolean;
        emailStatus?: string;
        invitationUrl?: string;
        errors?: { message?: string }[];
      };
      if (!res.ok || !j.success) {
        setMsg(j.errors?.[0]?.message ?? "No se pudo enviar la invitación al codeudor.");
        return null;
      }
      const url = j.invitationUrl ?? "";
      if (url) setInviteUrl(url);
      setDone("invited");
      return url || null;
    } catch {
      setMsg("Error de red.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function sendByEmail() {
    await ensureCodebtorInvite("email");
  }

  async function sendByWhatsApp() {
    const url = await ensureCodebtorInvite("whatsapp");
    if (url) {
      const msgTxt = `Hola 👋 Te comparto el enlace para completar tus datos y subir tus documentos como codeudor del contrato de arriendo en ArriendoSeguro: ${url}`;
      window.open(buildWhatsAppUrl(phone, msgTxt), "_blank", "noopener,noreferrer");
    }
  }

  async function submitCodebtor(formData: FormData) {
    setMsg("");
    if (formData.get("thirdPartyAuthorizationOath") !== "on") {
      setMsg("Debes declarar que cuentas con la autorización del codeudor.");
      return;
    }
    if (formData.get("truthfulnessOath") !== "on") {
      setMsg("Debes aceptar la declaración bajo gravedad de juramento.");
      return;
    }
    const income = Number(String(formData.get("supportMonthlyIncome") ?? "").replace(/[^\d]/g, "")) || 0;
    if (income <= 0) {
      setMsg("Indica el ingreso mensual aproximado del codeudor.");
      return;
    }
    if (rentReference > 0 && income < rentReference) {
      setMsg("El ingreso del codeudor es inferior al valor del arriendo. Revísalo para continuar.");
      return;
    }
    const sanitized = sanitizePartyFromForm(formData, { notificationAddress: "" });
    setBusy(true);
    try {
      const res = await fetch("/api/party-invite/submit-codebtor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tenantToken,
          party: { ...sanitized, notificationAddress: "", economicSupport: { monthlyIncome: income } },
          thirdPartyAuthorization: true,
          ...(slot > 0 ? { assignNewSlot: true } : {}),
        }),
      });
      const j = (await res.json()) as { success?: boolean; errors?: { message?: string }[] };
      if (!res.ok || !j.success) {
        setMsg(j.errors?.[0]?.message ?? "No se pudieron enviar los datos del codeudor.");
        return;
      }
      setDone("entered");
    } catch {
      setMsg("Error de red.");
    } finally {
      setBusy(false);
    }
  }

  if (done === "none") {
    return (
      <div className="rounded-2xl border-2 border-[#12B886]/40 bg-[#12B886]/10 p-4 text-sm text-emerald-800">
        <p className="font-semibold">¡Todo listo! Este arriendo no tiene codeudor.</p>
        <p className="mt-1">Ya puedes cerrar esta página.</p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="rounded-2xl border-2 border-[#12B886]/40 bg-[#12B886]/10 p-4 text-sm text-emerald-800">
        <p className="font-semibold">
          {done === "invited"
            ? "Le enviamos el enlace al codeudor ✓"
            : "Registramos los datos del codeudor ✓"}
        </p>
        <p className="mt-1">
          {done === "invited"
            ? "El codeudor registrará sus datos y aceptará el juramento y la autorización por su enlace. Ya puedes cerrar esta página."
            : "Quien te invitó los verá e incluirá. El codeudor confirmará al firmar. Ya puedes cerrar esta página."}
        </p>
        {done === "invited" && inviteUrl && (
          <div className="mt-2 space-y-2">
            <div className="rounded-2xl border-2 border-[#25D366]/40 bg-[#25D366]/[0.06] p-3 text-slate-700">
              <p className="text-sm font-bold text-[#0B6E4E]">💬 También puedes enviárselo por WhatsApp</p>
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <input
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                  placeholder="📱 Celular (ej. 3001234567)"
                  className="w-52 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <a
                  href={buildWhatsAppUrl(phone, `Hola 👋 Te comparto el enlace para completar tus datos y subir tus documentos como codeudor del contrato de arriendo en ArriendoSeguro: ${inviteUrl}`)}
                  target="_blank"
                  rel="noreferrer"
                  className={`rounded-xl px-4 py-2 text-sm font-bold text-white transition ${phone.length >= 7 ? "bg-[#25D366] hover:brightness-105" : "pointer-events-none bg-slate-300"}`}
                >
                  Enviar por WhatsApp
                </a>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/85 p-2 text-[11px] text-slate-600">
              <p className="font-semibold">Enlace de la invitación (copiar / compartir):</p>
              <a href={inviteUrl} target="_blank" rel="noreferrer" className="mt-0.5 block break-all font-mono text-[#5646E5] underline">
                {inviteUrl}
              </a>
            </div>
          </div>
        )}
        <button type="button" onClick={addAnother} className="mt-3 rounded-2xl border-2 border-[#5646E5]/40 bg-white px-4 py-2 text-sm font-bold text-[#5646E5] transition hover:bg-[#ECE9FB]">
          + Agregar otro codeudor
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-violet-300 bg-white p-4">
      <p className="text-sm font-semibold text-violet-900">¿Este arriendo tiene codeudor solidario?</p>
      <p className="mt-0.5 text-xs text-slate-600">
        Como tú tienes la relación con el codeudor, puedes <strong>invitarlo</strong> (él registra y acepta sus datos) o{" "}
        <strong>ingresar sus datos</strong> si cuentas con su autorización. Si no hay codeudor, cierra esta página.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setMode("invite")}
          className={`rounded-lg border px-3 py-1.5 text-sm ${mode === "invite" ? "border-violet-500 bg-violet-100/70 text-violet-800" : "border-slate-300 text-slate-800"}`}
        >
          Invitar al codeudor (correo o WhatsApp)
        </button>
        <button
          type="button"
          onClick={() => setMode("enter")}
          className={`rounded-lg border px-3 py-1.5 text-sm ${mode === "enter" ? "border-violet-500 bg-violet-100/70 text-violet-800" : "border-slate-300 text-slate-800"}`}
        >
          Ingresar sus datos yo
        </button>
        <button
          type="button"
          onClick={() => setDone("none")}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:border-emerald-500 hover:text-emerald-700"
        >
          No hay codeudor · Finalizar
        </button>
      </div>

      {mode === "invite" && (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-white/70 p-3">
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-slate-700">
              <span className="mb-1 block">Correo del codeudor</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="correo@ejemplo.com"
                className="w-56 rounded border border-slate-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="text-xs text-slate-700">
              <span className="mb-1 block">Nombre (opcional)</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre"
                className="w-40 rounded border border-slate-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="text-xs text-slate-700">
              <span className="mb-1 block">Celular (para WhatsApp)</span>
              <input
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                placeholder="3001234567"
                className="w-44 rounded border border-slate-300 px-2 py-1.5 text-sm"
              />
            </label>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            Elige cómo enviarle el enlace. <b>Por correo</b>: escribe su correo. <b>Por WhatsApp</b>: basta el
            celular — el codeudor escribirá su correo al abrir el enlace para recibir el <b>código</b>.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !email.includes("@")}
              onClick={() => void sendByEmail()}
              className="rounded-xl bg-[#5646E5] px-4 py-2 text-sm font-bold text-white transition hover:brightness-105 disabled:opacity-50"
            >
              {busy ? "Enviando…" : "📧 Enviar por correo"}
            </button>
            <button
              type="button"
              disabled={busy || phone.length < 7}
              onClick={() => void sendByWhatsApp()}
              className="rounded-xl bg-[#25D366] px-4 py-2 text-sm font-bold text-white transition hover:brightness-105 disabled:opacity-50"
              title={phone.length < 7 ? "Escribe el celular para enviar por WhatsApp" : undefined}
            >
              💬 Enviar por WhatsApp
            </button>
          </div>
        </div>
      )}

      {mode === "enter" && (
        <form
          className="mt-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submitCodebtor(new FormData(e.currentTarget));
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <PartyDataFields
              party={{}}
              oathId="tenant_entered_codebtor_oath"
              contractDraftId={tenantToken}
              thirdPartyAuthorization
              rentReference={rentReference}
              who="el codeudor"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="mt-3 rounded-xl bg-[#5646E5] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Enviando…" : "Guardar datos del codeudor"}
          </button>
        </form>
      )}

      {msg && <p className="mt-2 text-sm text-rose-700">{msg}</p>}
    </div>
  );
}
