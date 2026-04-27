"use client";

import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
import {
  estadoExpedienteResumen,
  isExpedienteCompleto,
  tieneTerminosContrato,
} from "@/lib/dashboard/expediente-ui";
import { getAllDrafts, type ContractDraft } from "@/features/contracts/wizard-state";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

type Entitlements = {
  success?: boolean;
  plusActive?: boolean;
  demoActive?: boolean;
};

function StepShell({
  step,
  title,
  description,
  beneficioIlustrativo,
  children,
  status,
}: {
  step: number;
  title: string;
  description: string;
  beneficioIlustrativo?: string;
  children: ReactNode;
  status: "locked" | "available" | "done" | "soon";
}) {
  const ring =
    status === "done"
      ? "border-emerald-600/50"
      : status === "available"
        ? "border-violet-500/45"
        : status === "soon"
          ? "border-slate-600/60"
          : "border-slate-700/80";

  return (
    <li
      className={`rounded-2xl border ${ring} bg-slate-900/50 p-4 shadow-[0_8px_22px_rgba(0,0,0,0.25)]`}
    >
      <div className="flex flex-wrap items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-800 text-sm font-semibold text-violet-200">
          {step}
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <h3 className="font-semibold text-slate-100">{title}</h3>
            <p className="mt-1 text-sm text-slate-400">{description}</p>
            {beneficioIlustrativo && (
              <p className="mt-2 rounded-lg border border-slate-700/60 bg-slate-950/40 p-2 text-xs text-slate-400">
                {beneficioIlustrativo}
              </p>
            )}
          </div>
          {children}
        </div>
      </div>
    </li>
  );
}

const BENEFICIOS: Record<number, string> = {
  1: "Reunís en un solo lugar a arrendador, arrendatario e inmueble, sin perder datos en chats sueltos.",
  2: "Obtenés un contrato ordenado según tu caso, con o sin codeudor, listo para revisar con calma.",
  3: "Ambas partes firman de forma simple, con registro para no quedar en lo informal.",
  4: "Dejás registro fotográfico y claro del estado del inmueble al inicio.",
  5: "Sincronizás fechas de pago y recordatorios sin depender solo de memoria.",
  6: "Llevás constancia de lo que efectivamente se pagó, con soporte adjunto.",
  7: "Al cierre, documentás la entrega final y una evaluación estructurada.",
};

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
      const res = await fetch("/api/access/entitlements/me", {
        headers: { ...(await buildAuthHeaders(user)) },
      });
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
      .sort(
        (a, b) =>
          new Date(b.lastUpdatedAt).getTime() - new Date(a.lastUpdatedAt).getTime(),
      );
    return drafts[0] ?? null;
  }, [user, tick]);

  const plusActive = !!entitlements?.plusActive;
  const demoActive = !!entitlements?.demoActive;
  const interactive = plusActive || demoActive;
  const loadingEnt = entitlements === null;

  const id = primaryDraft?.id;
  const completo = primaryDraft ? isExpedienteCompleto(primaryDraft) : false;
  const termsOk = primaryDraft ? tieneTerminosContrato(primaryDraft) : false;
  const hasVersion =
    primaryDraft &&
    (primaryDraft.status === "version_saved" || primaryDraft.status === "ready_for_signature");

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-violet-300/90">
          Panel principal de ArriendoSeguro
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Tu arriendo, paso a paso
        </h1>
        <p className="max-w-3xl text-slate-300">
          Formaliza un arriendo entre particulares con contrato, firma, inventario, pagos y soportes,
          en un flujo guiado.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900/90 to-slate-950 p-6 shadow-[0_14px_36px_rgba(139,92,246,0.18)]">
        <h2 className="text-lg font-semibold text-white">Tu acceso</h2>
        {loadingEnt ? (
          <p className="mt-2 text-sm text-slate-400">Cargando estado de tu plan…</p>
        ) : plusActive ? (
          <div className="mt-3 space-y-1">
            <p className="font-medium text-emerald-200">Plan Plus activo</p>
            <p className="text-sm text-slate-300">
              Podés crear un expediente real de arriendo con todas las herramientas habilitadas.
            </p>
          </div>
        ) : demoActive ? (
          <div className="mt-3 space-y-1">
            <p className="font-medium text-amber-100">Estás en modo demo</p>
            <p className="text-sm text-slate-300">
              Podés explorar cómo funciona la plataforma con datos de ejemplo. El demo no genera
              contratos reales ni documentos válidos.
            </p>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <p className="font-medium text-slate-100">
              Para crear un contrato real debés activar el Plan Plus.
            </p>
            <p className="text-sm text-slate-400">
              Igual podés ver abajo cómo es el recorrido completo y por qué cada paso te ahorra
              tiempo y malos entendidos.
            </p>
            <Link
              href="/dashboard/plans"
              className="inline-flex rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-[0_0_18px_rgba(139,92,246,0.35)] hover:bg-violet-500"
            >
              Ver planes
            </Link>
          </div>
        )}
      </section>

      {!interactive && !loadingEnt && (
        <div className="flex flex-wrap gap-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
          <Link
            href="/dashboard/plans"
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
          >
            Ver planes y activar Plus
          </Link>
          <Link
            href="/dashboard/demo"
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:border-violet-400"
          >
            Ver demo guiado
          </Link>
        </div>
      )}

      <section aria-labelledby="flow-steps">
        <h2 id="flow-steps" className="sr-only">
          Pasos del flujo de arriendo
        </h2>
        <ol className="space-y-4">
          <StepShell
            step={1}
            title="Crear expediente de arriendo"
            description="Registrá los datos básicos del arriendo y de las partes."
            beneficioIlustrativo={!interactive ? BENEFICIOS[1] : undefined}
            status={!interactive ? "locked" : id ? "available" : "available"}
          >
            {!interactive ? (
              <p className="text-xs text-slate-500">Activá Plus o demo para crear un expediente.</p>
            ) : !id ? (
              <Link
                href="/dashboard/contracts/new"
                className="inline-flex rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-500"
              >
                Crear expediente
              </Link>
            ) : !completo ? (
              <Link
                href={`/dashboard/contracts/${id}/landlord`}
                className="inline-flex rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-500"
              >
                Continuar expediente
              </Link>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/dashboard/contracts/${id}/review`}
                  className="inline-flex rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-500"
                >
                  Ver expediente
                </Link>
                <span className="self-center text-xs text-slate-500">
                  {estadoExpedienteResumen(primaryDraft!)}
                </span>
              </div>
            )}
          </StepShell>

          <StepShell
            step={2}
            title="Crear contrato"
            description="Generá el contrato de arrendamiento con o sin codeudor."
            beneficioIlustrativo={!interactive ? BENEFICIOS[2] : undefined}
            status={!interactive ? "locked" : id ? "available" : "locked"}
          >
            {!interactive ? (
              <p className="text-xs text-slate-500">Incluido cuando tengas expediente activo.</p>
            ) : !id ? (
              <p className="text-sm text-slate-500">Bloqueado: primero creá el expediente.</p>
            ) : (
              <Link
                href={completo ? `/dashboard/contracts/${id}/preview` : `/dashboard/contracts/${id}/landlord`}
                className="inline-flex rounded-lg border border-violet-500/60 bg-violet-950/40 px-3 py-2 text-sm font-medium text-violet-100 hover:border-violet-400"
              >
                Crear o revisar contrato
              </Link>
            )}
          </StepShell>

          <StepShell
            step={3}
            title="Firmar contrato"
            description="Enviá el contrato para firma electrónica simple."
            beneficioIlustrativo={!interactive ? BENEFICIOS[3] : undefined}
            status={
              !interactive ? "locked" : hasVersion ? "available" : id ? "locked" : "locked"
            }
          >
            {!interactive ? (
              <p className="text-xs text-slate-500">Recibirás enlaces para firmar cuando corresponda.</p>
            ) : !id ? (
              <p className="text-sm text-slate-500">Bloqueado: necesitás contrato guardado.</p>
            ) : !hasVersion ? (
              <p className="text-sm text-slate-500">
                Bloqueado: primero generá y guardá una versión del contrato en la vista previa.
              </p>
            ) : (
              <Link
                href={`/dashboard/contracts/${id}/preview`}
                className="inline-flex rounded-lg border border-violet-500/60 px-3 py-2 text-sm text-violet-100 hover:border-violet-400"
              >
                Ir a firma
              </Link>
            )}
          </StepShell>

          <StepShell
            step={4}
            title="Inventario y acta de entrega"
            description="Registrá fotos, estado del inmueble, medidores, llaves y generá acta de entrega."
            beneficioIlustrativo={!interactive ? BENEFICIOS[4] : undefined}
            status={!interactive ? "locked" : id ? "available" : "locked"}
          >
            {!interactive ? (
              <p className="text-xs text-slate-500">Podés documentar cada detalle con fotos.</p>
            ) : !id ? (
              <p className="text-sm text-slate-500">Creá primero un expediente.</p>
            ) : (
              <Link
                href={`/dashboard/contracts/${id}/inventory`}
                className="inline-flex rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-100 hover:border-violet-400"
              >
                Crear inventario
              </Link>
            )}
          </StepShell>

          <StepShell
            step={5}
            title="Pagos y recordatorios"
            description="Programá los pagos del contrato y configurá avisos por correo."
            beneficioIlustrativo={!interactive ? BENEFICIOS[5] : undefined}
            status={!interactive ? "locked" : id && termsOk ? "available" : "locked"}
          >
            {!interactive ? (
              <p className="text-xs text-slate-500">Organizás canon y recordatorios sin olvidos.</p>
            ) : !id || !termsOk ? (
              <p className="text-sm text-slate-500">
                Bloqueado hasta tener los términos del contrato cargados en el expediente.
              </p>
            ) : (
              <Link
                href={`/dashboard/contracts/${id}/payment-schedule`}
                className="inline-flex rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-100 hover:border-violet-400"
              >
                Programar pagos
              </Link>
            )}
          </StepShell>

          <StepShell
            step={6}
            title="Registro de pagos"
            description="Registrá pagos realizados por fuera de la plataforma y adjuntá soporte."
            beneficioIlustrativo={!interactive ? BENEFICIOS[6] : undefined}
            status={!interactive ? "locked" : id && termsOk ? "available" : "locked"}
          >
            {!interactive ? (
              <p className="text-xs text-slate-500">Útil cuando el dinero circula fuera del sistema.</p>
            ) : !id || !termsOk ? (
              <p className="text-sm text-slate-500">
                Bloqueado hasta tener los términos del contrato y el calendario de pagos configurado.
              </p>
            ) : (
              <Link
                href={`/dashboard/contracts/${id}/payments`}
                className="inline-flex rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-100 hover:border-violet-400"
              >
                Registrar pago
              </Link>
            )}
          </StepShell>

          <StepShell
            step={7}
            title="Cierre y evaluación"
            description="Al finalizar, generá acta de cierre y registrá evaluación estructurada."
            beneficioIlustrativo={!interactive ? BENEFICIOS[7] : undefined}
            status="soon"
          >
            <button
              type="button"
              disabled
              className="cursor-not-allowed rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-500"
            >
              Ver cierre — próximamente
            </button>
          </StepShell>
        </ol>
      </section>

      <p className="text-center text-xs text-slate-500">
        ¿Necesitás ver todos tus expedientes?{" "}
        <Link href="/dashboard/leases" className="text-violet-300 underline-offset-4 hover:underline">
          Ir a Mis arriendos
        </Link>
      </p>
    </div>
  );
}
