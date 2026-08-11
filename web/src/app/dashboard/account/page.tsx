"use client";

import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
import { getAllDrafts } from "@/features/contracts/wizard-state";
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
  const { user, resetPassword, signOut } = useAuth();
  const [ent, setEnt] = useState<EntitlementsResponse | null>(null);
  const [signedCount, setSignedCount] = useState<number | null>(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    (async () => {
      if (!user) return;
      const [resEnt, resSum] = await Promise.all([
        fetch("/api/access/entitlements/me", {
          headers: { ...(await buildAuthHeaders(user)) },
        }),
        fetch("/api/cuenta/resumen", {
          headers: { ...(await buildAuthHeaders(user)) },
        }),
      ]);
      const data = (await resEnt.json()) as EntitlementsResponse;
      if (resEnt.ok && data.success) setEnt(data);
      else setEnt({ success: false });
      const sum = (await resSum.json()) as { success?: boolean; signedContractsCount?: number };
      if (resSum.ok && sum.success) setSignedCount(Number(sum.signedContractsCount ?? 0));
      else setSignedCount(null);
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

  const draftsCount = useMemo(() => {
    if (!user) return 0;
    return getAllDrafts().filter((d) => d.userId === user.uid).length;
  }, [user]);

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-violet-700">Área personal</p>
        <h1 className="text-2xl font-bold text-slate-900">Mi cuenta y seguridad</h1>
        <p className="text-sm text-slate-600">Aquí puedes revisar tu plan y gestionar opciones de acceso.</p>
      </header>

      <article className="rounded-2xl border border-slate-300 bg-white/95 p-5">
        <h2 className="text-lg font-semibold text-slate-900">Datos de cuenta</h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <Item label="Correo">{user?.email ?? "—"}</Item>
          <Item label="UID">{user?.uid ?? "—"}</Item>
          <Item label="Plan">{planLabel}</Item>
          <Item label="Fecha de registro">{user?.metadata?.creationTime ?? "—"}</Item>
          <Item label="Último acceso">{user?.metadata?.lastSignInTime ?? "—"}</Item>
          <Item label="Correo verificado">{user?.emailVerified ? "Sí" : "No"}</Item>
        </dl>
      </article>

      <article className="rounded-2xl border border-slate-300 bg-white/95 p-5">
        <h2 className="text-lg font-semibold text-slate-900">Seguridad</h2>
        <div className="mt-3 space-y-3 text-sm text-slate-700">
          <p>
            Contraseña actual: <strong className="text-slate-900">oculta por seguridad</strong>
          </p>
          <button
            type="button"
            onClick={() => void onSendReset()}
            disabled={sending || !user?.email}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:border-violet-500 disabled:opacity-50"
          >
            {sending ? "Enviando…" : "Cambiar contraseña (enlace por correo)"}
          </button>
          {msg && <p className="text-emerald-700">{msg}</p>}
          {err && <p className="text-rose-700">{err}</p>}
          <div className="rounded-lg border border-slate-300 bg-slate-100/60 p-3">
            <p className="font-medium text-slate-900">Verificación en dos pasos (MFA)</p>
            <p className="mt-1 text-slate-600">
              Factores inscritos actualmente: <strong className="text-slate-800">{factors.length}</strong>
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Si tu proyecto Firebase habilita MFA, aquí verás factores activos. Para habilitación operativa completa
              en producción te recomendamos activar MFA en consola y agregar flujo dedicado por SMS/TOTP.
            </p>
          </div>
        </div>
      </article>

      <article className="rounded-2xl border border-slate-300 bg-white/95 p-5">
        <h2 className="text-lg font-semibold text-slate-900">Mis expedientes (resumen)</h2>
        <div className="mt-3 space-y-2 text-sm text-slate-700">
          <p>
            Borradores en este navegador: <strong className="text-slate-900">{draftsCount}</strong>
          </p>
          <p>
            Contratos firmados en la plataforma con tu correo (referencia):{" "}
            <strong className="text-slate-900">{signedCount === null ? "—" : signedCount}</strong>
          </p>
          <p className="text-xs text-slate-500">
            Los borradores viven en tu equipo hasta que guardes versión en el servidor. El conteo de firmados se basa en
            registros de firma y estado del expediente.
          </p>
        </div>
        <Link href="/dashboard/leases" className="mt-3 inline-block text-sm text-violet-700 hover:underline">
          Ir a Mis arriendos
        </Link>
      </article>

      <article className="rounded-2xl border border-slate-300 bg-white/95 p-5">
        <h2 className="text-lg font-semibold text-slate-900">Derechos Habeas Data (Ley 1581 de 2012)</h2>
        <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-slate-700">
          <li>Acceso, actualización y rectificación de tus datos.</li>
          <li>Supresión cuando proceda y revocatoria del consentimiento.</li>
          <li>Consulta sobre el uso que damos a la información.</li>
          <li>Prueba del consentimiento, salvo excepciones legales.</li>
          <li>Presentar queja ante la Superintendencia de Industria y Comercio cuando corresponda.</li>
          <li>Conocer las políticas de tratamiento y los canales habilitados.</li>
        </ul>
        <div className="mt-4 rounded-lg border border-violet-200 bg-violet-50/60 p-3">
          <p className="text-sm font-medium text-slate-900">Ejerce tus derechos al instante</p>
          <p className="mt-1 text-sm text-slate-600">
            Sin correos ni esperas: en <strong>Mis datos</strong> puedes <strong>consultar y descargar</strong> tu
            información, <strong>rectificar</strong> tu nombre y teléfono, y <strong>eliminar tu cuenta</strong>.
          </p>
          <Link
            href="/dashboard/cuenta/mis-datos"
            className="mt-3 inline-block rounded-lg bg-violet-700 px-4 py-2 text-sm font-medium text-white hover:bg-violet-800"
          >
            Ir a Mis datos (Habeas Data)
          </Link>
        </div>
        <p className="mt-3 text-sm text-slate-700">
          Plazos orientativos de respuesta: hasta <strong>diez días hábiles</strong> para consultas y hasta{" "}
          <strong>quince días hábiles</strong> para reclamos, sin perjuicio de acuse de recibo y complejidad del caso.
        </p>
        <p className="mt-2 text-sm text-slate-700">
          Canal:{" "}
          <a href="mailto:contacto@arriendoseguro.app" className="text-violet-700 underline">
            contacto@arriendoseguro.app
          </a>
          . Aviso completo:{" "}
          <Link href="/legal/aviso-privacidad" className="text-violet-700 hover:underline">
            Aviso de privacidad
          </Link>
          .
        </p>
      </article>

      <article className="rounded-2xl border border-slate-300 bg-white/95 p-5">
        <h2 className="text-lg font-semibold text-slate-900">Estado de acceso</h2>
        <div className="mt-3 text-sm text-slate-700">
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
        <Link href="/dashboard/plans" className="mt-3 inline-block text-sm text-violet-700 hover:underline">
          Ver o cambiar plan
        </Link>
      </article>

      <article className="rounded-2xl border border-rose-200 bg-rose-50/40 p-5">
        <h2 className="text-lg font-semibold text-rose-950">Zona sensible</h2>
        <p className="mt-2 text-sm text-slate-700">
          Puedes cerrar sesión desde aquí o eliminar tu cuenta. La eliminación es definitiva para el acceso con este
          correo y está sujeta a retención legal cuando hay contratos firmados.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void signOut()}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-800 hover:border-violet-500"
          >
            Cerrar sesión
          </button>
          <Link
            href="/dashboard/cuenta/eliminar"
            className="rounded-lg border border-rose-400 bg-white px-4 py-2 text-sm font-medium text-rose-900 hover:bg-rose-100"
          >
            Eliminar mi cuenta
          </Link>
        </div>
      </article>
    </section>
  );
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-300 bg-slate-100/60 p-3">
      <dt className="text-[11px] uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 break-all text-sm text-slate-900">{children}</dd>
    </div>
  );
}

