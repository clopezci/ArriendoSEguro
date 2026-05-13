"use client";

import { DEMO_WATERMARK_TEXT } from "@/domain/contracts/demoWatermark";
import { logGlobalAudit } from "@/features/contracts/wizard-state";
import { BrandLockup } from "@/components/brand/brand-lockup";
import {
  DEMO_BADGE,
  buildDemoContractSnippet,
  demoAnnexes,
  demoCodebtor,
  demoInventoryZones,
  demoLandlord,
  demoPayments,
  demoProperty,
  demoTenant,
  guidedDemoStepMeta,
} from "@/lib/demo/guided-demo-data";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

function logDemoCta() {
  logGlobalAudit("demo_plus_cta_clicked");
}

function WatermarkPreview({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-300 bg-slate-100/80 p-4">
      <div
        className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center text-center text-2xl font-bold leading-tight text-violet-500/25 sm:text-3xl"
        style={{ transform: "rotate(-18deg)" }}
        aria-hidden
      >
        {DEMO_WATERMARK_TEXT}
      </div>
      <div className="relative z-0 max-h-[min(55vh,420px)] overflow-y-auto pr-1">{children}</div>
    </div>
  );
}

function DemoBadge() {
  return (
    <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-100/60 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
      Demo
    </span>
  );
}

export function GuidedDemoTour() {
  const [stepIndex, setStepIndex] = useState(0);
  const [withCodebtor, setWithCodebtor] = useState(true);
  const viewedRef = useRef(false);

  useEffect(() => {
    if (viewedRef.current) return;
    viewedRef.current = true;
    logGlobalAudit("demo_viewed");
  }, []);

  useEffect(() => {
    const id = guidedDemoStepMeta[stepIndex]?.id;
    if (id) logGlobalAudit("demo_step_opened", { step: id });
  }, [stepIndex]);

  const goStep = useCallback((i: number) => {
    setStepIndex(Math.max(0, Math.min(guidedDemoStepMeta.length - 1, i)));
  }, []);

  const step = guidedDemoStepMeta[stepIndex];
  if (!step) return null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-300 bg-slate-100/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/" className="text-sm font-semibold text-violet-700 hover:text-violet-700">
              <BrandLockup />
            </Link>
            <DemoBadge />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/"
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-800 hover:border-slate-500"
            >
              Inicio
            </Link>
            <Link
              href="/dashboard/plans"
              onClick={() => logDemoCta()}
              className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow-[0_0_14px_rgba(139,92,246,0.35)] hover:bg-violet-500"
            >
              Activar Plan Plus
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">
          Recorrido sin datos reales
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Cómo funciona Plan Plus</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Todo es de ejemplo: no cargas formularios, no se guarda un expediente real y no puedes firmar ni descargar
          PDF válido desde aquí.
        </p>

        {/* Step chips */}
        <nav
          className="mt-6 flex gap-2 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Pasos del demo"
        >
          {guidedDemoStepMeta.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => goStep(i)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-left text-xs transition ${
                i === stepIndex
                  ? "border-violet-500 bg-violet-100/50 text-violet-800"
                  : "border-slate-300 bg-white/95 text-slate-600 hover:border-slate-300"
              }`}
            >
              <span className="font-mono text-[10px] text-slate-500">{i + 1}</span> {s.title}
            </button>
          ))}
        </nav>

        {/* Main card */}
        <article className="mt-4 rounded-2xl border border-slate-300 bg-white/95 p-4 shadow-[0_12px_40px_rgba(0,0,0,0.35)] sm:p-6">
          <header className="mb-4 flex flex-wrap items-start justify-between gap-2 border-b border-slate-300 pb-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Paso {stepIndex + 1}. {step.title}
              </h2>
              <p className="text-xs text-slate-500">{step.blurb}</p>
            </div>
            <span className="rounded-md border border-slate-300 px-2 py-1 text-[10px] text-slate-600">{DEMO_BADGE}</span>
          </header>

          {step.id === "expediente" && <StepExpediente />}
          {step.id === "contrato" && <StepContrato withCodebtor={withCodebtor} onToggleCodebtor={setWithCodebtor} />}
          {step.id === "firma" && <StepFirma withCodebtor={withCodebtor} />}
          {step.id === "inventario" && <StepInventario />}
          {step.id === "pagos" && <StepPagos />}
          {step.id === "anexos" && <StepAnexos />}
          {step.id === "extras" && <StepExtras />}

          <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-300 pt-4">
            <button
              type="button"
              disabled={stepIndex === 0}
              onClick={() => goStep(stepIndex - 1)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-800 hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Anterior
            </button>
            <div className="flex gap-2">
              {stepIndex < guidedDemoStepMeta.length - 1 ? (
                <button
                  type="button"
                  onClick={() => goStep(stepIndex + 1)}
                  className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
                >
                  Siguiente
                </button>
              ) : (
                <Link
                  href="/dashboard/plans"
                  onClick={() => logDemoCta()}
                  className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
                >
                  Activar Plan Plus
                </Link>
              )}
            </div>
          </footer>
        </article>

        {/* Final CTA block */}
        <section className="mt-8 rounded-2xl border border-violet-300 bg-violet-100/20 p-6 text-center">
          <h2 className="text-xl font-bold text-slate-900">¿Quieres crear tu expediente real?</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-slate-700">
            Activa el Plan Plus y formaliza tu arriendo con contrato, firma, inventario, pagos y soportes.
          </p>
          <Link
            href="/dashboard/plans"
            onClick={() => logDemoCta()}
            className="mt-5 inline-flex rounded-lg bg-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-[0_0_20px_rgba(139,92,246,0.4)] hover:bg-violet-500"
          >
            Activar Plan Plus
          </Link>
          <p className="mt-3 text-[11px] text-slate-500">
            Si no tienes sesión, te pediremos ingresar antes de ver planes.
          </p>
        </section>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-300 bg-slate-100/60 px-3 py-2">
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-sm text-slate-800">{value}</p>
    </div>
  );
}

function StepExpediente() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        En Plan Plus completarías estos datos en formularios guiados. Acá solo ves el resultado ficticio.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-300 bg-slate-100/60 p-3">
          <p className="mb-2 text-xs font-semibold text-violet-700">{demoLandlord.role}</p>
          <div className="space-y-2">
            <Field label="Nombre" value={demoLandlord.fullName} />
            <Field label="Documento" value={demoLandlord.document} />
            <Field label="Ciudad" value={demoLandlord.city} />
            <Field label="Correo" value={demoLandlord.email} />
            <Field label="Teléfono" value={demoLandlord.phone} />
            <Field label="Notificación" value={demoLandlord.address} />
          </div>
        </div>
        <div className="rounded-xl border border-slate-300 bg-slate-100/60 p-3">
          <p className="mb-2 text-xs font-semibold text-violet-700">{demoTenant.role}</p>
          <div className="space-y-2">
            <Field label="Nombre" value={demoTenant.fullName} />
            <Field label="Documento" value={demoTenant.document} />
            <Field label="Ciudad" value={demoTenant.city} />
            <Field label="Correo" value={demoTenant.email} />
            <Field label="Teléfono" value={demoTenant.phone} />
            <Field label="Notificación" value={demoTenant.address} />
          </div>
        </div>
        <div className="rounded-xl border border-slate-300 bg-slate-100/60 p-3">
          <p className="mb-2 text-xs font-semibold text-violet-700">Inmueble</p>
          <div className="space-y-2">
            <Field label="Dirección" value={demoProperty.address} />
            <Field label="Ciudad / Depto." value={`${demoProperty.city} · ${demoProperty.department}`} />
            <Field label="Tipo" value={demoProperty.type} />
            <Field label="Matrícula" value={demoProperty.registry} />
            <Field label="Canon (ejemplo)" value={demoProperty.rent} />
          </div>
        </div>
      </div>
    </div>
  );
}

function StepContrato({
  withCodebtor,
  onToggleCodebtor,
}: {
  withCodebtor: boolean;
  onToggleCodebtor: (v: boolean) => void;
}) {
  const html = buildDemoContractSnippet(withCodebtor);
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        En el Plan Plus podrás generar tu contrato real a partir de tu expediente. Esta vista es solo ilustrativa.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onToggleCodebtor(false)}
          className={`rounded-lg border px-3 py-1.5 text-xs ${
            !withCodebtor ? "border-violet-500 bg-violet-100/50 text-violet-800" : "border-slate-300 text-slate-600"
          }`}
        >
          Ejemplo sin codeudor
        </button>
        <button
          type="button"
          onClick={() => onToggleCodebtor(true)}
          className={`rounded-lg border px-3 py-1.5 text-xs ${
            withCodebtor ? "border-violet-500 bg-violet-100/50 text-violet-800" : "border-slate-300 text-slate-600"
          }`}
        >
          Ejemplo con codeudor
        </button>
      </div>
      <WatermarkPreview>
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </WatermarkPreview>
      <ul className="list-inside list-disc text-xs text-slate-500">
        <li>No hay descarga de PDF desde esta demo.</li>
        <li>No uses esta pantalla como documento legal.</li>
      </ul>
    </div>
  );
}

function StatusRow({ label, status }: { label: string; status: "ok" | "pend" | "na" }) {
  const map = {
    ok: { text: "Firmado (simulado)", cls: "text-emerald-400 border-emerald-300" },
    pend: { text: "Pendiente", cls: "text-amber-700 border-amber-300" },
    na: { text: "No aplica", cls: "text-slate-500 border-slate-300" },
  }[status];
  return (
    <div className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${map.cls}`}>
      <span className="text-slate-800">{label}</span>
      <span className="text-xs font-medium">{map.text}</span>
    </div>
  );
}

function StepFirma({ withCodebtor }: { withCodebtor: boolean }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        En el Plan Plus cada parte podrá recibir un enlace de firma electrónica simple.
      </p>
      <div className="space-y-2">
        <StatusRow label={demoLandlord.role} status="ok" />
        <StatusRow label={demoTenant.role} status="pend" />
        <StatusRow label={demoCodebtor.role} status={withCodebtor ? "pend" : "na"} />
      </div>
      <p className="text-xs text-slate-500">
        Estado inventado para la demo. No se envían enlaces ni correos desde esta pantalla.
      </p>
    </div>
  );
}

function StepInventario() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        En el Plan Plus podrás cargar fotos reales y generar un reporte PDF del inventario.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {demoInventoryZones.map((z) => (
          <div key={z.zone} className="rounded-xl border border-slate-300 bg-slate-100/60 p-3">
            <p className="text-sm font-semibold text-slate-900">{z.zone}</p>
            <p className="mt-1 text-xs text-slate-600">{z.items}</p>
            <div className="mt-3 flex gap-1">
              {Array.from({ length: Math.min(z.photos, 5) }).map((_, i) => (
                <div
                  key={i}
                  className="flex h-14 w-14 items-center justify-center rounded border border-dashed border-slate-300 bg-white text-[10px] text-slate-600"
                >
                  foto
                </div>
              ))}
              {z.photos > 5 ? (
                <div className="flex h-14 items-center px-1 text-[10px] text-slate-500">+{z.photos - 5}</div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StepPagos() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        En el Plan Plus podrás programar pagos, recordatorios y registrar soportes asociados al canon.
      </p>
      <div className="rounded-xl border border-violet-300 bg-violet-100/20 p-3 text-sm">
        <p className="font-medium text-violet-700">Próximo vencimiento (ejemplo)</p>
        <p className="mt-1 text-slate-700">5 de marzo de 2026 · {demoProperty.rent}</p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-300">
        <table className="w-full min-w-[280px] text-left text-xs">
          <thead className="border-b border-slate-300 bg-slate-100/80 text-[10px] uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Mes</th>
              <th className="px-3 py-2">Vence</th>
              <th className="px-3 py-2">Monto</th>
              <th className="px-3 py-2">Estado</th>
            </tr>
          </thead>
          <tbody>
            {demoPayments.map((row) => (
              <tr key={row.month} className="border-b border-slate-300 text-slate-700">
                <td className="px-3 py-2">{row.month}</td>
                <td className="px-3 py-2">{row.due}</td>
                <td className="px-3 py-2">{row.amount}</td>
                <td className="px-3 py-2">{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-2">
        <span className="rounded-lg border border-slate-300 px-2 py-1 text-[11px] text-slate-600">
          Soporte simulado: comprobante #DEMO-001
        </span>
        <span className="rounded-lg border border-slate-300 px-2 py-1 text-[11px] text-slate-600">
          Recordatorio simulado: correo 2 días antes
        </span>
      </div>
    </div>
  );
}

function StepAnexos() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        En el Plan Plus estos documentos quedarán asociados a tu expediente real con trazabilidad.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {demoAnnexes.map((a) => (
          <div
            key={a.name}
            className="flex items-center justify-between rounded-xl border border-slate-300 bg-slate-100/60 px-3 py-3"
          >
            <div>
              <p className="text-sm font-medium text-slate-900">{a.name}</p>
              <p className="text-[10px] text-slate-500">{a.kind}</p>
            </div>
            <span className="shrink-0 text-[10px] text-slate-500">{a.state}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StepExtras() {
  return (
    <div className="space-y-3 text-sm text-slate-600">
      <p>Plan Plus también contempla, según tu flujo:</p>
      <ul className="list-inside list-disc space-y-1 text-slate-700">
        <li>Recordatorios por correo y hitos del expediente.</li>
        <li>Revisión de borrador y guardado de versión antes de firmar.</li>
        <li>Evaluación estructurada al cierre del arriendo (reputación).</li>
        <li>Soporte para anexos adicionales acordados entre partes.</li>
      </ul>
      <p className="text-xs text-slate-500">
        Los detalles pueden variar; esta lista resume el alcance orientativo del producto.
      </p>
    </div>
  );
}
