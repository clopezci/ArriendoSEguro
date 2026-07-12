"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
import type { InviteAttestation, PartyDraft } from "@/features/contracts/draft-types";

/**
 * Tercera opción del paso de codeudor: **lo gestiona el inquilino**. En muchos
 * casos es el inquilino quien tiene la relación con el codeudor (no el dueño).
 * El inquilino, desde su propia invitación, invita al codeudor o ingresa sus
 * datos con autorización. Aquí el dueño solo **espera** y ve cuándo quedó listo
 * para importarlo — reusa la misma colección de invitaciones (`role=solidaryCoDebtor`,
 * con `inviterUid` del dueño), así que el estado se detecta con el endpoint normal.
 */
export function CodebtorViaTenantPanel({
  contractDraftId,
  tenantInvited,
  onImport,
}: {
  contractDraftId: string;
  tenantInvited: boolean;
  onImport: (party: PartyDraft) => void;
}) {
  const { user } = useAuth();
  const [status, setStatus] = useState<"none" | "active" | "completed">("none");
  const [contribution, setContribution] = useState<PartyDraft | null>(null);
  const [attestation, setAttestation] = useState<InviteAttestation | null>(null);

  const refreshStatus = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(
        `/api/party-invite/status?contractDraftId=${encodeURIComponent(contractDraftId)}&role=solidaryCoDebtor`,
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
      }
    } catch {
      /* noop */
    }
  }, [user, contractDraftId]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  // Se actualiza sola mientras aún no está completo, para que el dueño vea sin
  // pulsar nada cuando el inquilino ya gestionó al codeudor.
  useEffect(() => {
    if (status === "completed") return;
    const t = setInterval(() => void refreshStatus(), 12000);
    return () => clearInterval(t);
  }, [status, refreshStatus]);

  return (
    <div className="rounded-3xl border-2 border-[#5646E5]/20 bg-[#ECE9FB]/40 p-4">
      <p className="text-sm font-bold text-[#5646E5]">Lo gestiona el inquilino</p>
      <p className="mt-1 text-xs text-slate-600">
        El inquilino, desde su invitación, invitará al codeudor o ingresará sus datos con su autorización. Tú no tienes
        que hacer nada más aquí: esta pantalla te avisa cuando queden listos para importarlos.
      </p>

      {!tenantInvited && (
        <div className="mt-3 rounded-2xl border-2 border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-950">
          <p className="font-semibold">Falta un paso: envíale primero el enlace al inquilino.</p>
          <p className="mt-1 text-amber-900/80">
            Para que el inquilino pueda gestionar al codeudor, primero debes elegir <b>“Se lo pido a él/ella”</b> en el
            paso del inquilino y enviarle el enlace. Sin esa invitación, el inquilino no tiene dónde gestionarlo.
          </p>
        </div>
      )}

      {tenantInvited && status !== "completed" && (
        <div className="mt-3 rounded-2xl border-2 border-amber-200 bg-amber-50/70 p-3 text-sm text-amber-950">
          <p className="flex items-center gap-2 font-semibold">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-500" aria-hidden="true" />
            Esperando a que el inquilino gestione al codeudor
          </p>
          <p className="mt-1 text-xs text-amber-900/80">
            Esta pantalla se actualiza sola. Puedes <b>esperar aquí</b> a que aparezca “✓ listo”, o <b>continuar</b> y
            volver luego a importar. Aún no podrás finalizar el contrato hasta que estén sus datos.
          </p>
          <button type="button" onClick={() => void refreshStatus()} className="mt-1 text-xs font-bold text-[#5646E5] underline">
            Actualizar ahora
          </button>
        </div>
      )}

      {status === "completed" && contribution && (
        <div className="mt-3 rounded-2xl border-2 border-[#12B886]/40 bg-[#12B886]/10 p-3 text-sm text-emerald-800">
          <p className="font-semibold">El inquilino ya gestionó al codeudor ✓</p>
          {attestation ? (
            attestation.mode === "third_party" ? (
              <p className="mt-1 text-xs text-emerald-800/90">
                Datos ingresados por <strong>{attestation.attestedByName ?? "el arrendatario"}</strong>, que declaró
                contar con la <strong>autorización del codeudor</strong> (con evidencia). El codeudor lo confirmará al
                firmar; no tendrás que marcarlo tú.
              </p>
            ) : (
              <p className="mt-1 text-xs text-emerald-800/90">
                El codeudor aceptó el <strong>juramento</strong> y la <strong>autorización de datos</strong> con su
                identidad y evidencia (fecha/IP). Al importar, esa evidencia queda registrada.
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
            Importar los datos del codeudor
          </button>
          <p className="mt-1 text-[11px] text-emerald-800/80">
            Al importar se reemplazan los datos actuales del codeudor con los que gestionó el inquilino.
          </p>
        </div>
      )}
    </div>
  );
}
