"use client";

import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
import { isExpedienteCompleto } from "@/lib/dashboard/expediente-ui";
import { getAllDrafts, type ContractDraft } from "@/features/contracts/wizard-state";
import { freeTierEnabled } from "@/lib/config";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type Entitlements = {
  success?: boolean;
  plusActive?: boolean;
  demoActive?: boolean;
};

const STEPS: { n: number; label: string; hint: string }[] = [
  { n: 1, label: "Arma tu expediente", hint: "Quién diligencia, dueño, inmueble, inquilino y codeudor." },
  { n: 2, label: "Condiciones", hint: "Canon con tope legal, pago, fechas, servicios y cláusulas." },
  { n: 3, label: "Revisión y vista previa", hint: "Revisa los datos y el contrato completo." },
  { n: 4, label: "Firma de las partes", hint: "Firma electrónica con evidencia (Ley 527)." },
  { n: 5, label: "Acta e inventario", hint: "Inventario con fotos y acta de entrega a ambas partes." },
];

export function HomeDashboardPanel() {
  const { user } = useAuth();
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);
  const [tick, setTick] = useState(0);

  const refreshDrafts = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    const onFocus = () => refreshDrafts();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refreshDrafts]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) return;
      const res = await fetch("/api/access/entitlements/me", { headers: { ...(await buildAuthHeaders(user)) } });
      const data = (await res.json()) as Entitlements;
      if (!cancelled) setEntitlements(res.ok && data.success ? data : { success: false });
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const primaryDraft: ContractDraft | null = useMemo(() => {
    void tick;
    if (!user) return null;
    const drafts = getAllDrafts()
      .filter((d) => d.userId === user.uid)
      .sort((a, b) => new Date(b.lastUpdatedAt).getTime() - new Date(a.lastUpdatedAt).getTime());
    return drafts[0] ?? null;
  }, [user, tick]);

  const plusActive = !!entitlements?.plusActive;
  const demoActive = !!entitlements?.demoActive;
  const interactive = plusActive || demoActive;
  // Crear el contrato es gratis; firma/inventario/posventa se activan con Plus.
  const canCreate = interactive || freeTierEnabled;
  const loadingEnt = entitlements === null;

  const id = primaryDraft?.id;
  const completo = primaryDraft ? isExpedienteCompleto(primaryDraft) : false;

  const cta = !canCreate
    ? null
    : !id
      ? { href: "/dashboard/contracts/new", label: "Crear mi contrato gratis" }
      : completo
        ? { href: `/dashboard/contracts/${id}/preview`, label: "Ver mi contrato" }
        : { href: `/dashboard/contracts/${id}/contract-type`, label: "Continuar mi contrato" };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Tu arriendo, paso a paso</h1>
        <p className="text-slate-600">Crea, firma y gestiona tu arriendo entre particulares, en un flujo guiado.</p>
      </header>

      {/* Acción principal */}
      <section className="rounded-2xl border border-violet-300 bg-gradient-to-br from-violet-50 to-white p-5 shadow-[0_10px_28px_rgba(139,92,246,0.16)]">
        {loadingEnt ? (
          <p className="text-sm text-slate-600">Cargando tu estado…</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                  plusActive
                    ? "bg-emerald-600 text-white"
                    : demoActive
                      ? "bg-amber-500 text-white"
                      : "bg-emerald-100 text-emerald-800"
                }`}
              >
                {plusActive ? "Plan Plus" : demoActive ? "Modo demo" : "Gratis"}
              </span>
              <p className="text-sm font-semibold text-slate-800">
                {id ? (completo ? "Tu contrato está listo para revisar." : "Tienes un contrato en progreso.") : "Empieza tu contrato de arriendo."}
              </p>
            </div>
            {cta && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={cta.href}
                  className="inline-flex min-h-11 items-center justify-center rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_6px_20px_rgba(124,58,237,0.35)] hover:bg-violet-700"
                >
                  {cta.label}
                </Link>
                <Link
                  href="/dashboard/leases"
                  className="inline-flex min-h-11 items-center justify-center rounded-lg border border-violet-400 px-5 py-2.5 text-sm font-semibold text-violet-700 hover:bg-violet-50"
                >
                  Mis arriendos
                </Link>
              </div>
            )}
            {!plusActive && !demoActive && (
              <p className="mt-3 text-xs text-slate-600">
                Generas y descargas tu contrato gratis. La <strong>firma, el inventario y la posventa</strong> se activan
                con <Link href="/dashboard/plans" className="text-violet-700 underline">Plan Plus</Link>.
              </p>
            )}
          </>
        )}
      </section>

      {/* Los 5 pasos (informativo, coherente con el flujo) */}
      <section aria-labelledby="flow-steps" className="space-y-3">
        <h2 id="flow-steps" className="text-lg font-semibold text-slate-900">
          Cómo funciona — 5 pasos
        </h2>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.n} className="flex gap-3 rounded-xl border border-slate-300 bg-white/95 p-4 shadow-sm">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-violet-500 text-sm font-black text-white">
                {s.n}
              </span>
              <div>
                <p className="text-sm font-bold text-slate-900">{s.label}</p>
                <p className="mt-0.5 text-xs text-slate-600">{s.hint}</p>
              </div>
            </li>
          ))}
          <li className="flex gap-3 rounded-xl border border-dashed border-emerald-400/80 bg-emerald-50/60 p-4 shadow-sm">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-emerald-500 text-base font-black text-white">
              ★
            </span>
            <div>
              <p className="text-sm font-bold text-slate-900">Gestiona tu arriendo</p>
              <p className="mt-0.5 text-xs text-slate-600">Pagos, novedades, renovación y calificación.</p>
            </div>
          </li>
        </ol>
      </section>
    </div>
  );
}
