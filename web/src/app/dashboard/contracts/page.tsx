"use client";

import { AccessBlocked } from "@/components/contracts/wizard-shell";
import { useAuth } from "@/contexts/auth-context";
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
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

function statusLabel(status: AccessStatus): string {
  if (status === "demo") return "Demo activo";
  if (status === "paid") return "Pago confirmado";
  if (status === "pending_payment") return "Pendiente de pago";
  return "Demo expirado";
}

export default function ContractsDashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [refreshSeed, setRefreshSeed] = useState(0);
  const [msg, setMsg] = useState("");

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
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-[0_12px_30px_rgba(139,92,246,0.2)]">
        <h1 className="text-2xl font-bold">Módulo contractual</h1>
        <p className="mt-2 text-slate-300">
          Estado de acceso: <strong>{statusLabel(accessStatus)}</strong>
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onCreate}
            disabled={!gate.allowed}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-[0_0_16px_rgba(139,92,246,0.35)] disabled:opacity-50"
          >
            Crear expediente de contrato
          </button>
          {process.env.NODE_ENV !== "production" && user && (
            <>
              <button
                type="button"
                onClick={() => {
                  setUserAccessStatus(user.uid, "demo");
                  logGlobalAudit("access_granted_demo", { userId: user.uid });
                  setMsg("Demo activado (MVP).");
                  refresh();
                }}
                className="rounded-lg border border-violet-400 px-4 py-2 text-sm font-medium text-violet-200"
              >
                Activar demo
              </button>
              <button
                type="button"
                onClick={() => {
                  setUserAccessStatus(user.uid, "paid");
                  setMsg("Acceso paid activado (MVP).");
                  refresh();
                }}
                className="rounded-lg border border-sky-400 px-4 py-2 text-sm font-medium text-sky-200"
              >
                Marcar paid (MVP)
              </button>
            </>
          )}
        </div>
        {msg && <p className="mt-2 text-sm text-emerald-300">{msg}</p>}
      </section>

      {!gate.allowed &&
        (gate.reason === "pending_payment" || gate.reason === "expired") && (
          <AccessBlocked reason={gate.reason} />
        )}

      <section className="rounded-2xl border border-slate-800 bg-slate-900/65 p-6">
        <h2 className="text-lg font-semibold">Expedientes recientes</h2>
        {drafts.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">
            Aún no tienes expedientes. Crea uno cuando tengas acceso habilitado.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {drafts.map((d) => (
              <li key={d.id} className="rounded-lg border border-slate-800 p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{d.id}</p>
                    <p className="text-xs text-slate-400">
                      Estado: {d.status} · {d.isDemo ? "Demo" : "No demo"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href={`/dashboard/contracts/${d.id}/review`}
                      className="rounded border border-slate-700 px-3 py-1 text-sm text-slate-200 hover:border-violet-400"
                    >
                      Abrir
                    </Link>
                    <Link
                      href={`/dashboard/contracts/${d.id}/preview`}
                      className="rounded border border-sky-700 px-3 py-1 text-sm text-sky-200"
                    >
                      Vista previa
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

