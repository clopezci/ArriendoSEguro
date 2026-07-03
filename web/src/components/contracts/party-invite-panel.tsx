"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
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

  async function sendInvite() {
    if (!user) return;
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
        return;
      }
      setStatus("active");
      setInviteUrl(j.invitationUrl ?? "");
      if (j.emailStatus === "sent") {
        setMsg(`Enviamos el enlace por correo a ${email.trim()}. Si no llega en unos minutos, revisa spam y pulsa «Actualizar».`);
      } else if (j.emailStatus === "mock") {
        setMsg(
          "Modo prueba: en este entorno el correo NO está configurado (Resend), así que no se envió correo. Copia el enlace de abajo para probar.",
        );
      } else {
        setMsg(
          "La invitación quedó creada, pero el correo no se pudo enviar. Revisa «Admin → Diagnóstico de correos». Mientras tanto, comparte el enlace de abajo.",
        );
      }
    } catch {
      setMsg("Error de red.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-4 rounded-xl border border-violet-300 bg-violet-50/50 p-4">
      <p className="text-sm font-semibold text-violet-900">¿Quién ingresa los datos del {roleLabel.toLowerCase()}?</p>
      <div className="mt-2 flex flex-wrap gap-2" role="radiogroup">
        <button
          type="button"
          role="radio"
          aria-checked={mode === "self"}
          onClick={() => setMode("self")}
          className={`rounded-lg border px-3 py-1.5 text-sm ${mode === "self" ? "border-violet-500 bg-violet-100/70 text-violet-800" : "border-slate-300 text-slate-800"}`}
        >
          Los ingreso yo
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={mode === "invite"}
          onClick={() => setMode("invite")}
          className={`rounded-lg border px-3 py-1.5 text-sm ${mode === "invite" ? "border-violet-500 bg-violet-100/70 text-violet-800" : "border-slate-300 text-slate-800"}`}
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
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-xs text-slate-700">
                <span className="mb-1 block">Correo de la persona</span>
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
                  className="w-44 rounded border border-slate-300 px-2 py-1.5 text-sm"
                />
              </label>
              <button
                type="button"
                disabled={busy || !email.includes("@")}
                onClick={() => void sendInvite()}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy ? "Enviando…" : status === "active" ? "Reenviar enlace" : "Enviar invitación"}
              </button>
            </div>
          )}

          {status === "active" && (
            <button type="button" onClick={() => void refreshStatus()} className="text-xs font-semibold text-violet-700 underline">
              Actualizar estado
            </button>
          )}

          {status === "completed" && contribution && (
            <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">
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
                className="mt-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
              >
                Importar sus datos al contrato
              </button>
            </div>
          )}

          {msg && <p className="text-xs text-slate-700">{msg}</p>}
          {inviteUrl && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-[11px] text-amber-900">
              <p className="font-semibold">Enlace de la invitación (para probar / compartir):</p>
              <a href={inviteUrl} target="_blank" rel="noreferrer" className="mt-0.5 block break-all font-mono text-violet-800 underline">
                {inviteUrl}
              </a>
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
