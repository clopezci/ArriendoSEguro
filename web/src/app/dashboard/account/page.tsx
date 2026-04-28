"use client";

import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
import { multiFactor } from "firebase/auth";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type EntitlementsResponse = {
  success: boolean;
  plusActive?: boolean;
  demoActive?: boolean;
  plusEntitlement?: {
    id: string;
    contractsUsed: number;
    maxContractsAllowed: number;
    validUntil?: string | null;
  } | null;
  demoEntitlement?: { id: string; validUntil?: string | null } | null;
};

export default function AccountPage() {
  const { user, resetPassword } = useAuth();
  const [ent, setEnt] = useState<EntitlementsResponse | null>(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    (async () => {
      if (!user) return;
      const res = await fetch("/api/access/entitlements/me", {
        headers: { ...(await buildAuthHeaders(user)) },
      });
      const data = (await res.json()) as EntitlementsResponse;
      if (res.ok && data.success) setEnt(data);
      else setEnt({ success: false });
    })();
  }, [user]);

  const planLabel = useMemo(() => {
    if (!ent) return "Cargando…";
    if (ent.plusActive) return "Plan Plus activo";
    if (ent.demoActive) return "Modo demo activo";
    return "Sin plan activo";
  }, [ent]);

  async function onSendReset() {
    if (!user?.email) return;
    setErr("");
    setMsg("");
    setSending(true);
    try {
      await resetPassword(user.email);
      setMsg("Te enviamos un enlace para cambiar la contraseña.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo enviar el enlace de cambio.");
    } finally {
      setSending(false);
    }
  }

  const factors = user ? multiFactor(user).enrolledFactors : [];

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-violet-300">Área personal</p>
        <h1 className="text-2xl font-bold text-white">Mi cuenta y seguridad</h1>
        <p className="text-sm text-slate-400">Aquí puedes revisar tu plan y gestionar opciones de acceso.</p>
      </header>

      <article className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <h2 className="text-lg font-semibold text-white">Datos de cuenta</h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <Item label="Correo">{user?.email ?? "—"}</Item>
          <Item label="UID">{user?.uid ?? "—"}</Item>
          <Item label="Plan">{planLabel}</Item>
          <Item label="Fecha de registro">{user?.metadata?.creationTime ?? "—"}</Item>
          <Item label="Último acceso">{user?.metadata?.lastSignInTime ?? "—"}</Item>
          <Item label="Correo verificado">{user?.emailVerified ? "Sí" : "No"}</Item>
        </dl>
      </article>

      <article className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <h2 className="text-lg font-semibold text-white">Seguridad</h2>
        <div className="mt-3 space-y-3 text-sm text-slate-300">
          <p>
            Contraseña actual: <strong className="text-slate-100">oculta por seguridad</strong>
          </p>
          <button
            type="button"
            onClick={() => void onSendReset()}
            disabled={sending || !user?.email}
            className="rounded-lg border border-slate-600 px-3 py-2 text-sm hover:border-violet-400 disabled:opacity-50"
          >
            {sending ? "Enviando…" : "Cambiar contraseña (enlace por correo)"}
          </button>
          {msg && <p className="text-emerald-300">{msg}</p>}
          {err && <p className="text-rose-300">{err}</p>}
          <div className="rounded-lg border border-slate-700 bg-slate-950/40 p-3">
            <p className="font-medium text-slate-100">Verificación en dos pasos (MFA)</p>
            <p className="mt-1 text-slate-400">
              Factores inscritos actualmente: <strong className="text-slate-200">{factors.length}</strong>
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Si tu proyecto Firebase habilita MFA, aquí verás factores activos. Para habilitación operativa completa
              en producción te recomendamos activar MFA en consola y agregar flujo dedicado por SMS/TOTP.
            </p>
          </div>
        </div>
      </article>

      <article className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <h2 className="text-lg font-semibold text-white">Estado de acceso</h2>
        <div className="mt-3 text-sm text-slate-300">
          {!ent ? (
            <p>Cargando…</p>
          ) : (
            <ul className="list-inside list-disc space-y-1">
              <li>Plan Plus activo: {ent.plusActive ? "sí" : "no"}</li>
              <li>Demo activo: {ent.demoActive ? "sí" : "no"}</li>
              <li>
                Contratos usados (Plus):{" "}
                {ent.plusEntitlement
                  ? `${ent.plusEntitlement.contractsUsed}/${ent.plusEntitlement.maxContractsAllowed}`
                  : "—"}
              </li>
            </ul>
          )}
        </div>
        <Link href="/dashboard/plans" className="mt-3 inline-block text-sm text-violet-300 hover:underline">
          Ver o cambiar plan
        </Link>
      </article>
    </section>
  );
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
      <dt className="text-[11px] uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 break-all text-sm text-slate-100">{children}</dd>
    </div>
  );
}

