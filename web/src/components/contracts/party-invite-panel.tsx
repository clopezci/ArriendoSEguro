"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
import { buildWhatsAppUrl } from "@/lib/nuevo/whatsapp";
import type { InviteAttestation, PartyDraft } from "@/features/contracts/draft-types";

type Mode = "self" | "invite";

/**
 * Permite al dueño elegir entre ingresar él mismo los datos del inquilino/codeudor
 * o **enviar un enlace** para que la persona los ingrese (validándose por OTP).
 * Cuando el invitado completa, el dueño **importa** los datos al borrador.
 */
export function PartyInvitePanel({
  contractDraftId,
  role,
  roleLabel,
  inviterName,
  onImport,
}: {
  contractDraftId: string;
  role: "tenant" | "solidaryCoDebtor";
  roleLabel: string;
  inviterName: string;
  onImport: (party: PartyDraft) => void;
}) {
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>("self");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"none" | "active" | "completed">("none");
  const [contribution, setContribution] = useState<PartyDraft | null>(null);
  const [attestation, setAttestation] = useState<InviteAttestation | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [phone, setPhone] = useState("");
  const [currentInviteeEmail, setCurrentInviteeEmail] = useState("");

  const refreshStatus = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(
        `/api/party-invite/status?contractDraftId=${encodeURIComponent(contractDraftId)}&role=${role}`,
        { headers: { ...(await buildAuthHeaders(user)) } },
      );
      const j = (await res.json()) as {
        success?: boolean;
        invite?: {
          status?: string;
          inviteeEmail?: string;
          contribution?: PartyDraft | null;
          selfAttestation?: InviteAttestation | null;
        } | null;
      };
      if (res.ok && j.success && j.invite) {
        setStatus((j.invite.status as "active" | "completed") ?? "none");
        setContribution(j.invite.contribution ?? null);
        setAttestation(j.invite.selfAttestation ?? null);
        setCurrentInviteeEmail(j.invite.inviteeEmail ?? "");
        // Precargamos el correo actual para que el dueño VEA a quién va la
        // invitación y pueda cambiarlo si es otra persona (antes el campo
        // quedaba vacío y el enlace seguía yendo al correo anterior).
        setEmail((prev) => prev || j.invite?.inviteeEmail || "");
        if (j.invite.status) setMode("invite");
      }
    } catch {
      /* noop */
    }
  }, [user, contractDraftId, role]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  // Auto-actualización mientras la invitación está activa: así el dueño ve solo
  // (sin pulsar nada) cuando la persona completa sus datos, y sabe cuándo avanzar.
  useEffect(() => {
    if (mode !== "invite" || status !== "active") return;
    const t = setInterval(() => void refreshStatus(), 12000);
    return () => clearInterval(t);
  }, [mode, status, refreshStatus]);

  // Crea (o reutiliza) la invitación y devuelve su enlace. El correo con el
  // código de verificación (OTP) siempre se envía desde el servidor. `channel`
  // solo cambia el mensaje que ve el dueño.
  async function ensureInvite(channel: "email" | "whatsapp"): Promise<string | null> {
    if (!user) return null;
    if (!email.includes("@")) {
      setMsg("Ingresa un correo válido de la persona (allí llega el código de verificación).");
      return null;
    }
    if (inviteUrl && status === "active") {
      if (channel === "email") setMsg(`Reenviado por correo a ${email.trim()}.`);
      return inviteUrl;
    }
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/party-invite/create", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({ contractDraftId, role, inviteeEmail: email.trim(), inviteeName: name.trim(), inviterName }),
      });
      const j = (await res.json()) as {
        success?: boolean;
        emailStatus?: string;
        invitationUrl?: string;
        errors?: { message?: string }[];
      };
      if (!res.ok || !j.success) {
        setMsg(j.errors?.[0]?.message ?? "No se pudo crear la invitación.");
        return null;
      }
      setStatus("active");
      const url = j.invitationUrl ?? "";
      setInviteUrl(url);
      if (channel === "whatsapp") {
        setMsg("Enlace listo para WhatsApp. El código de verificación va aparte, al correo de la persona.");
      } else if (j.emailStatus === "sent") {
        setMsg(`Enviamos el enlace por correo a ${email.trim()}. Si no llega en unos minutos, revisa spam y pulsa «Actualizar».`);
      } else if (j.emailStatus === "mock") {
        setMsg("Modo prueba: el correo no está configurado aquí. Usa WhatsApp o copia el enlace de abajo.");
      } else {
        setMsg("La invitación quedó creada, pero el correo no se pudo enviar. Envíala por WhatsApp o comparte el enlace de abajo.");
      }
      return url || null;
    } catch {
      setMsg("Error de red.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function sendByEmail() {
    await ensureInvite("email");
  }

  async function sendByWhatsApp() {
    const url = await ensureInvite("whatsapp");
    if (url) {
      const msgTxt = `Hola 👋 Te comparto el enlace para completar tus datos del contrato de arriendo en ArriendoSeguro: ${url}`;
      window.open(buildWhatsAppUrl(phone, msgTxt), "_blank", "noopener,noreferrer");
    }
  }

  return (
    <div className="rounded-3xl border-2 border-[#5646E5]/20 bg-[#ECE9FB]/40 p-4">
      <p className="text-sm font-bold text-[#5646E5]">¿Quién ingresa los datos del {roleLabel.toLowerCase()}?</p>
      <div className="mt-2 flex flex-wrap gap-2.5" role="radiogroup">
        <button
          type="button"
          role="radio"
          aria-checked={mode === "self"}
          onClick={() => setMode("self")}
          className={`rounded-2xl border-2 px-4 py-2.5 text-sm font-medium transition ${mode === "self" ? "border-[#5646E5] bg-[#ECE9FB] text-[#5646E5]" : "border-slate-200 bg-white text-slate-700 hover:border-[#5646E5]"}`}
        >
          Los ingreso yo
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={mode === "invite"}
          onClick={() => setMode("invite")}
          className={`rounded-2xl border-2 px-4 py-2.5 text-sm font-medium transition ${mode === "invite" ? "border-[#5646E5] bg-[#ECE9FB] text-[#5646E5]" : "border-slate-200 bg-white text-slate-700 hover:border-[#5646E5]"}`}
        >
          Enviar enlace a la persona
        </button>
      </div>

      {mode === "invite" && (
        <div className="mt-3 space-y-2">
          {currentInviteeEmail && status !== "completed" && (
            <p className="rounded-md border border-sky-200 bg-sky-50 p-2 text-[11px] text-sky-900">
              Invitación actual para: <strong>{currentInviteeEmail}</strong>. Si es otra persona, cambia el correo abajo
              y reenvía: el enlace se enviará al <strong>correo que dejes aquí</strong> (el anterior se invalida).
            </p>
          )}
          {status !== "completed" && (
            <div className="rounded-2xl border border-slate-200 bg-white/70 p-3">
              <div className="flex flex-wrap items-end gap-2">
                <label className="text-xs text-slate-700">
                  <span className="mb-1 block">Correo de la persona <span className="text-rose-500">*</span></span>
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
                El <b>código de verificación</b> siempre llega al <b>correo</b>. Elige cómo enviarle el enlace:
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy || !email.includes("@")}
                  onClick={() => void sendByEmail()}
                  className="rounded-xl bg-[#5646E5] px-4 py-2 text-sm font-bold text-white transition hover:brightness-105 disabled:opacity-50"
                >
                  {busy ? "Enviando…" : status === "active" ? "📧 Reenviar por correo" : "📧 Enviar por correo"}
                </button>
                <button
                  type="button"
                  disabled={busy || !email.includes("@") || phone.length < 7}
                  onClick={() => void sendByWhatsApp()}
                  className="rounded-xl bg-[#25D366] px-4 py-2 text-sm font-bold text-white transition hover:brightness-105 disabled:opacity-50"
                  title={phone.length < 7 ? "Escribe el celular para enviar por WhatsApp" : undefined}
                >
                  💬 Enviar por WhatsApp
                </button>
              </div>
            </div>
          )}

          {status === "active" && (
            <div className="rounded-2xl border-2 border-amber-200 bg-amber-50/70 p-3 text-sm text-amber-950">
              <p className="flex items-center gap-2 font-semibold">
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-500" aria-hidden="true" />
                Enviado — esperando que la persona complete sus datos
              </p>
              <p className="mt-1 text-xs text-amber-900/80">
                Esta pantalla se actualiza sola. Puedes <b>esperar aquí</b> a que aparezca “✓ completó”, o <b>continuar</b> y
                volver luego a importar. Aún no podrás finalizar el contrato hasta que estén sus datos.
              </p>
              <button type="button" onClick={() => void refreshStatus()} className="mt-1 text-xs font-bold text-[#5646E5] underline">
                Actualizar ahora
              </button>
            </div>
          )}

          {status === "completed" && contribution && (
            <div className="rounded-2xl border-2 border-[#12B886]/40 bg-[#12B886]/10 p-3 text-sm text-emerald-800">
              <p className="font-semibold">La persona completó sus datos ✓</p>
              {attestation ? (
                attestation.mode === "third_party" ? (
                  <p className="mt-1 text-xs text-emerald-800/90">
                    Ingresado por <strong>{attestation.attestedByName ?? "el arrendatario"}</strong>, que declaró contar
                    con la <strong>autorización del codeudor</strong> (con evidencia). El codeudor confirmará al firmar.
                    No tendrás que marcarlo tú.
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-emerald-800/90">
                    Aceptó el <strong>juramento</strong> y la <strong>autorización de datos</strong> con su identidad y
                    evidencia (fecha/IP). Al importar, esa evidencia queda registrada; no tendrás que marcarla tú.
                  </p>
                )
              ) : null}
              <button
                type="button"
                onClick={() =>
                  onImport({
                    ...contribution,
                    inviteAttestation: attestation ?? undefined,
                    truthfulnessOathAccepted: Boolean(attestation?.truthfulnessOathAccepted),
                  })
                }
                className="mt-2 rounded-xl bg-[#12B886] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105"
              >
                Importar sus datos al contrato
              </button>
              <p className="mt-1 text-[11px] text-emerald-800/80">
                Al importar se reemplazan los datos actuales de esta parte con los que envió la persona.
              </p>
            </div>
          )}

          {msg && <p className="text-xs text-slate-700">{msg}</p>}

          {/* Respaldo por si el navegador bloqueó la apertura automática de WhatsApp. */}
          {inviteUrl && status !== "completed" && (
            <div className="rounded-2xl border border-slate-200 bg-white/85 p-2 text-[11px] text-slate-600">
              <p className="font-semibold">Enlace de la invitación (copiar / compartir):</p>
              <a href={inviteUrl} target="_blank" rel="noreferrer" className="mt-0.5 block break-all font-mono text-[#5646E5] underline">
                {inviteUrl}
              </a>
              {phone.length >= 7 && (
                <a
                  href={buildWhatsAppUrl(phone, `Hola 👋 Te comparto el enlace para completar tus datos del contrato de arriendo en ArriendoSeguro: ${inviteUrl}`)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-bold text-white transition hover:brightness-105"
                >
                  💬 Abrir WhatsApp con el enlace
                </a>
              )}
            </div>
          )}
          <p className="text-[11px] text-slate-500">
            La persona valida su identidad con un código a su correo y acepta, por el enlace, el juramento y la
            autorización de tratamiento de datos (con evidencia). Al importar, esa evidencia queda registrada.
          </p>
        </div>
      )}
    </div>
  );
}
