"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PartyDataFields } from "@/components/contracts/party-data-fields";
import { sanitizePartyFromForm } from "@/features/contracts/party-sanitize";
import type { PartyDraft } from "@/features/contracts/draft-types";

type Info = {
  usable?: boolean;
  status?: string;
  roleLabel?: string;
  inviterName?: string;
  inviteeName?: string;
  emailMasked?: string;
};

type Phase = "loading" | "invalid" | "otp" | "form" | "done";

export default function InvitacionPage() {
  const token = String(useParams<{ token: string }>().token);
  const [phase, setPhase] = useState<Phase>("loading");
  const [info, setInfo] = useState<Info | null>(null);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [party, setParty] = useState<PartyDraft>({});
  const [formKey, setFormKey] = useState(0);
  const [hasSavedProfile, setHasSavedProfile] = useState(false);
  const [saveProfile, setSaveProfile] = useState(true);

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
        setPhase("otp");
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
        body: JSON.stringify({ token }),
      });
      const j = (await res.json()) as { success?: boolean; errors?: { message?: string }[] };
      setMsg(res.ok && j.success ? "Te enviamos un código a tu correo." : j.errors?.[0]?.message ?? "No se pudo enviar el código.");
    } catch {
      setMsg("Error de red.");
    } finally {
      setBusy(false);
    }
  }, [token]);

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
      setPhase("form");
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
    const payloadParty = { ...sanitized, notificationAddress: "" };
    setBusy(true);
    try {
      const res = await fetch("/api/party-invite/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, party: payloadParty, saveProfile }),
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
    <main className="mx-auto max-w-2xl space-y-5 p-4 sm:p-6 text-slate-900">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Registra tus datos para el arriendo</h1>
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
        <div className="rounded-lg border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800">
          Este enlace no es válido o ya expiró. Pídele a quien te invitó que te envíe uno nuevo.
        </div>
      )}

      {phase === "otp" && (
        <section className="space-y-3 rounded-xl border border-slate-300 bg-white p-4">
          <p className="text-sm text-slate-700">
            Para validar que eres tú, te enviaremos un <strong>código</strong> a tu correo
            {info?.emailMasked ? ` (${info.emailMasked})` : ""}.
          </p>
          <button
            type="button"
            onClick={() => void requestOtp()}
            disabled={busy}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
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
              className="rounded-lg border border-violet-500 px-4 py-2 text-sm font-semibold text-violet-700 disabled:opacity-50"
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
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-violet-300 bg-violet-50/60 p-3 text-sm">
              <span className="text-slate-700">Tienes datos guardados de un arriendo anterior.</span>
              <button type="button" onClick={usarMisDatos} className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-semibold text-white">
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
            />
            <label className="sm:col-span-2 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
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
                className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy ? "Enviando…" : "Enviar mis datos al contrato"}
              </button>
            </div>
          </form>
          {msg && <p className="text-sm text-rose-700">{msg}</p>}
        </section>
      )}

      {phase === "done" && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-800">
          <p className="font-semibold">¡Listo! Tus datos se enviaron al contrato.</p>
          <p className="mt-1">Quien te invitó podrá verlos e incluirlos. Ya puedes cerrar esta página.</p>
        </div>
      )}
    </main>
  );
}
