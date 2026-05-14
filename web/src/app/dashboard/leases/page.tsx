"use client";

import { AccessBlocked } from "@/components/contracts/wizard-shell";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
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
  getAllDrafts,
  logGlobalAudit,
} from "@/features/contracts/wizard-state";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * Estado de acceso real del usuario, leído de Firestore mediante
 * `/api/access/entitlements/me`. Antes esta pantalla leía únicamente el
 * `localStorage`, lo que generaba inconsistencias cuando se activaba Plan
 * Plus desde el módulo admin u otra pestaña: la página seguía mostrando
 * "Pendiente de pago" aunque el backend ya tuviera el entitlement activo.
 */
type AccessState = {
  loading: boolean;
  errored: boolean;
  plusActive: boolean;
  demoActive: boolean;
  canCreateRealContract: boolean;
  canUseDemo: boolean;
};

function statusLabel(state: AccessState): string {
  if (state.loading) return "Consultando estado…";
  if (state.errored) return "No disponible";
  if (state.plusActive && !state.canCreateRealContract) {
    return "Plan Plus activo (sin créditos para crear nuevos expedientes)";
  }
  if (state.plusActive) return "Plan Plus activo";
  if (state.demoActive) return "Demo activo";
  return "Pendiente de pago";
}

export default function MisArriendosPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [refreshSeed, setRefreshSeed] = useState(0);
  const [access, setAccess] = useState<AccessState>({
    loading: true,
    errored: false,
    plusActive: false,
    demoActive: false,
    canCreateRealContract: false,
    canUseDemo: false,
  });
  const internal = canSeeInternalDashboardTools(user?.email ?? null);

  const loadEntitlements = useCallback(async () => {
    if (!user) return;
    setAccess((prev) => ({ ...prev, loading: true, errored: false }));
    try {
      const res = await fetch("/api/access/entitlements/me", {
        headers: { ...(await buildAuthHeaders(user)) },
      });
      const data = (await res.json()) as {
        success?: boolean;
        plusActive?: boolean;
        demoActive?: boolean;
        canCreateRealContract?: boolean;
        canUseDemo?: boolean;
      };
      if (!res.ok || !data.success) {
        setAccess({
          loading: false,
          errored: true,
          plusActive: false,
          demoActive: false,
          canCreateRealContract: false,
          canUseDemo: false,
        });
        return;
      }
      setAccess({
        loading: false,
        errored: false,
        plusActive: Boolean(data.plusActive),
        demoActive: Boolean(data.demoActive),
        canCreateRealContract: Boolean(data.canCreateRealContract),
        canUseDemo: Boolean(data.canUseDemo),
      });
    } catch {
      setAccess({
        loading: false,
        errored: true,
        plusActive: false,
        demoActive: false,
        canCreateRealContract: false,
        canUseDemo: false,
      });
    }
  }, [user]);

  useEffect(() => {
    void loadEntitlements();
  }, [loadEntitlements]);

  const drafts = useMemo(
    () => {
      void refreshSeed;
      return user ? getAllDrafts().filter((d) => d.userId === user.uid) : [];
    },
    [user, refreshSeed],
  );

  // `canCreate` mira si queda crédito para CREAR un expediente nuevo.
  // `plusActive` (o `demoActive`) puede ser true incluso cuando el
  // crédito ya se consumió, porque el usuario sigue teniendo derecho a
  // abrir y trabajar el expediente que ya empezó. Por eso solo
  // mostramos el bloqueador cuando NI plus NI demo siguen vigentes.
  const canCreate = access.canCreateRealContract || access.canUseDemo;
  const hasAnyAccess = access.plusActive || access.demoActive;
  const showBlocked = !access.loading && !access.errored && !hasAnyAccess;
  const plusConsumed = access.plusActive && !access.canCreateRealContract;

  useEffect(() => {
    if (showBlocked) {
      logGlobalAudit("access_blocked_pending_payment");
    }
  }, [showBlocked]);

  function onCreate() {
    if (!user || !canCreate) return;
    // Delegamos en /dashboard/contracts/new la creación real del expediente:
    // ahí se consulta entitlements/me otra vez y, si hay Plus, se consume el
    // crédito antes de crear el draft (atomicidad y trazabilidad).
    router.push("/dashboard/contracts/new");
  }

  function refresh() {
    setRefreshSeed((v) => v + 1);
    void loadEntitlements();
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Mis arriendos</h1>
        <p className="max-w-3xl text-sm text-slate-600">
          Expedientes de contrato asociados a tu cuenta. Continúa donde lo dejaste o revisa cada
          parte del proceso.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-300 bg-white/95 p-6 shadow-[0_12px_30px_rgba(139,92,246,0.2)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-slate-600">
              Estado de tu acceso:{" "}
              <strong className="text-slate-800">{statusLabel(access)}</strong>
            </p>
            {showBlocked && (
              <p className="mt-2 text-sm text-amber-800">
                Para crear expedientes necesitas Plan Plus activo o modo demo desde Planes.
              </p>
            )}
            {plusConsumed && (
              <p className="mt-2 text-sm text-amber-800">
                Tu Plan Plus está activo, pero ya usaste el crédito disponible para crear un
                expediente nuevo. Puedes seguir trabajando los expedientes que ya creaste; cuando
                necesites otro, ve a <strong>Planes</strong> para activar un crédito adicional.
              </p>
            )}
            {access.errored && (
              <p className="mt-2 text-sm text-rose-700">
                No pudimos verificar tu acceso. Refresca esta página o inténtalo de nuevo en unos
                minutos.
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => router.push("/dashboard/plans")}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-900 hover:border-violet-500"
            >
              Ver planes
            </button>
            <button
              type="button"
              onClick={onCreate}
              disabled={!canCreate}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-[0_0_16px_rgba(139,92,246,0.35)] disabled:opacity-45"
            >
              Crear expediente
            </button>
          </div>
        </div>

        {internal && (
          <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
            <p className="font-medium text-amber-800">Herramientas internas</p>
            <p className="mt-1 text-amber-700">
              Si modificas el estado del acceso desde otra pestaña (por ejemplo, activando un
              Plan Plus de prueba en <em>Planes</em> o desde el módulo admin), refresca aquí para
              que esta vista lo reconozca.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => refresh()}
                className="rounded border border-amber-400 px-2 py-1"
              >
                Refrescar estado de acceso
              </button>
              <Link
                href="/dashboard/plans"
                className="rounded border border-amber-400 px-2 py-1"
              >
                Ir a Planes (Plus de prueba)
              </Link>
            </div>
          </div>
        )}
      </section>

      {showBlocked && <AccessBlocked reason="pending_payment" />}

      <section className="space-y-4">
        {drafts.length === 0 ? (
          <div className="rounded-2xl border border-slate-300 bg-white/95 p-8 text-center">
            <p className="text-slate-700">Todavía no tienes expedientes.</p>
            <p className="mt-2 text-sm text-slate-500">
              Cuando actives Plus o demo, puedes crear el primero desde el panel principal o desde
              aquí.
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
                  className="rounded-2xl border border-slate-300 bg-white/65 p-4 shadow-[0_10px_26px_rgba(0,0,0,0.25)]"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:justify-between">
                    <div className="min-w-0 space-y-2">
                      <p className="truncate font-medium text-slate-900">
                        Expediente ·{" "}
                        <span className="font-mono text-xs text-slate-600">{d.id}</span>
                      </p>
                      <dl className="grid gap-x-6 gap-y-1 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-3">
                        <div>
                          <dt className="text-slate-500">Estado</dt>
                          <dd className="text-slate-700">{estadoExpedienteResumen(d)}</dd>
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
                        className="inline-flex justify-center rounded-lg border border-slate-300 px-3 py-2 text-center text-sm text-slate-900 hover:border-violet-500"
                      >
                        Ver contrato
                      </Link>
                      <Link
                        href={`/dashboard/contracts/${d.id}/inventory`}
                        className="inline-flex justify-center rounded-lg border border-slate-300 px-3 py-2 text-center text-sm text-slate-900 hover:border-violet-500"
                      >
                        Ver inventario
                      </Link>
                      <Link
                        href={`/dashboard/contracts/${d.id}/payments`}
                        className="inline-flex justify-center rounded-lg border border-slate-300 px-3 py-2 text-center text-sm text-slate-900 hover:border-violet-500"
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
