"use client";

import { AccessBlocked } from "@/components/contracts/wizard-shell";
import { useAuth } from "@/contexts/auth-context";
import {
  etiquetaContrato,
  etiquetaFirma,
  etiquetaInventario,
  etiquetaModalidad,
  etiquetaPagos,
  estadoExpedienteResumen,
  isExpedienteCompleto,
} from "@/lib/dashboard/expediente-ui";
import { canSeeInternalDashboardTools } from "@/lib/dashboard/internal-tools";
import {
  canCreateContract,
  createContractDraft,
  getAllDrafts,
  getUserAccessStatus,
  logGlobalAudit,
  setUserAccessStatus,
  type AccessStatus,
} from "@/features/contracts/wizard-state";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

function statusLabel(access: AccessStatus): string {
  if (access === "demo") return "Demo activo";
  if (access === "paid") return "Pago confirmado";
  if (access === "pending_payment") return "Pendiente de pago";
  return "Demo expirado";
}

export default function MisArriendosPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [refreshSeed, setRefreshSeed] = useState(0);
  const [msg, setMsg] = useState("");
  const internal = canSeeInternalDashboardTools(user?.email ?? null);

  const accessStatus = useMemo(
    () => {
      void refreshSeed;
      return user ? getUserAccessStatus(user.uid) : "pending_payment";
    },
    [user, refreshSeed],
  );

  const gate = canCreateContract(user, accessStatus);

  const drafts = useMemo(
    () => {
      void refreshSeed;
      return user ? getAllDrafts().filter((d) => d.userId === user.uid) : [];
    },
    [user, refreshSeed],
  );

  function refresh() {
    setRefreshSeed((v) => v + 1);
  }

  useEffect(() => {
    if (gate.reason === "pending_payment") {
      logGlobalAudit("access_blocked_pending_payment");
    }
  }, [gate.reason]);

  function onCreate() {
    if (!user || !gate.allowed) return;
    const draft = createContractDraft({
      userId: user.uid,
      accessStatus,
      isDemo: accessStatus === "demo",
    });
    router.push(`/dashboard/contracts/${draft.id}/landlord`);
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-white">Mis arriendos</h1>
        <p className="max-w-3xl text-sm text-slate-400">
          Expedientes de contrato asociados a tu cuenta. Continuá donde lo dejaste o revisá cada
          parte del proceso.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-[0_12px_30px_rgba(139,92,246,0.2)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-slate-400">
              Estado local del navegador (MVP):{" "}
              <strong className="text-slate-200">{statusLabel(accessStatus)}</strong>
            </p>
            {!gate.allowed && (
              <p className="mt-2 text-sm text-amber-100/90">
                Para crear expedientes necesitás Plan Plus activo o modo demo desde Planes.
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => router.push("/dashboard/plans")}
              className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-100 hover:border-violet-400"
            >
              Ver planes
            </button>
            <button
              type="button"
              onClick={onCreate}
              disabled={!gate.allowed}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-[0_0_16px_rgba(139,92,246,0.35)] disabled:opacity-45"
            >
              Crear expediente
            </button>
          </div>
        </div>

        {internal && (
          <div className="mt-4 rounded-lg border border-amber-700/50 bg-amber-950/25 p-3 text-xs text-amber-50">
            <p className="font-medium text-amber-100">Herramientas internas</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  if (!user) return;
                  setUserAccessStatus(user.uid, "demo");
                  logGlobalAudit("access_granted_demo", { userId: user.uid });
                  setMsg("Demo local activado (solo desarrollo).");
                  refresh();
                }}
                className="rounded border border-amber-500/60 px-2 py-1"
              >
                Activar demo local
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!user) return;
                  setUserAccessStatus(user.uid, "paid");
                  setMsg("Acceso paid local activado (solo desarrollo).");
                  refresh();
                }}
                className="rounded border border-sky-500/60 px-2 py-1"
              >
                Marcar paid local
              </button>
            </div>
          </div>
        )}
        {msg && <p className="mt-3 text-sm text-emerald-300">{msg}</p>}
      </section>

      {!gate.allowed &&
        (gate.reason === "pending_payment" || gate.reason === "expired") && (
          <AccessBlocked reason={gate.reason} />
        )}

      <section className="space-y-4">
        {drafts.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center">
            <p className="text-slate-300">Todavía no tenés expedientes.</p>
            <p className="mt-2 text-sm text-slate-500">
              Cuando actives Plus o demo, podés crear el primero desde el panel principal o desde
              acá.
            </p>
          </div>
        ) : (
          <ul className="space-y-4">
            {drafts.map((d) => {
              const completo = isExpedienteCompleto(d);
              const continuarLabel = completo ? "Continuar" : "Continuar expediente";
              const continuarHref = completo
                ? `/dashboard/contracts/${d.id}/review`
                : `/dashboard/contracts/${d.id}/landlord`;

              return (
                <li
                  key={d.id}
                  className="rounded-2xl border border-slate-800 bg-slate-900/65 p-4 shadow-[0_10px_26px_rgba(0,0,0,0.25)]"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:justify-between">
                    <div className="min-w-0 space-y-2">
                      <p className="truncate font-medium text-slate-100">
                        Expediente ·{" "}
                        <span className="font-mono text-xs text-slate-400">{d.id}</span>
                      </p>
                      <dl className="grid gap-x-6 gap-y-1 text-xs text-slate-400 sm:grid-cols-2 lg:grid-cols-3">
                        <div>
                          <dt className="text-slate-500">Estado</dt>
                          <dd className="text-slate-300">{estadoExpedienteResumen(d)}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">Modalidad</dt>
                          <dd>{etiquetaModalidad(d)}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">Contrato</dt>
                          <dd>{etiquetaContrato(d)}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">Firma</dt>
                          <dd>{etiquetaFirma(d)}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">Inventario</dt>
                          <dd>{etiquetaInventario(d)}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">Pagos</dt>
                          <dd>{etiquetaPagos(d)}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">Creado</dt>
                          <dd>{new Date(d.generatedAt).toLocaleString("es-CO")}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">Última actualización</dt>
                          <dd>{new Date(d.lastUpdatedAt).toLocaleString("es-CO")}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">Tipo</dt>
                          <dd>{d.isDemo ? "Demo" : "Real"}</dd>
                        </div>
                      </dl>
                    </div>
                    <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap lg:flex-col lg:items-end">
                      <Link
                        href={continuarHref}
                        className="inline-flex justify-center rounded-lg bg-violet-600 px-3 py-2 text-center text-sm font-medium text-white hover:bg-violet-500"
                      >
                        {continuarLabel}
                      </Link>
                      <Link
                        href={`/dashboard/contracts/${d.id}/preview`}
                        className="inline-flex justify-center rounded-lg border border-slate-600 px-3 py-2 text-center text-sm text-slate-100 hover:border-violet-400"
                      >
                        Ver contrato
                      </Link>
                      <Link
                        href={`/dashboard/contracts/${d.id}/inventory`}
                        className="inline-flex justify-center rounded-lg border border-slate-600 px-3 py-2 text-center text-sm text-slate-100 hover:border-violet-400"
                      >
                        Ver inventario
                      </Link>
                      <Link
                        href={`/dashboard/contracts/${d.id}/payments`}
                        className="inline-flex justify-center rounded-lg border border-slate-600 px-3 py-2 text-center text-sm text-slate-100 hover:border-violet-400"
                      >
                        Ver pagos
                      </Link>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
