"use client";

import type {
  ComplianceCheck,
  ComplianceStatus,
} from "@/domain/contracts/legalCompliance";
import { summarizeCompliance } from "@/domain/contracts/legalCompliance";

const STATUS_META: Record<
  ComplianceStatus,
  { dot: string; ring: string; text: string; bg: string; border: string; icon: string; sr: string }
> = {
  pass: {
    dot: "bg-emerald-500",
    ring: "ring-emerald-200",
    text: "text-emerald-800",
    bg: "bg-emerald-50",
    border: "border-emerald-300",
    icon: "✓",
    sr: "Cumple",
  },
  fail: {
    dot: "bg-rose-500",
    ring: "ring-rose-200",
    text: "text-rose-800",
    bg: "bg-rose-50",
    border: "border-rose-300",
    icon: "✕",
    sr: "No cumple",
  },
  warn: {
    dot: "bg-amber-500",
    ring: "ring-amber-200",
    text: "text-amber-900",
    bg: "bg-amber-50",
    border: "border-amber-300",
    icon: "!",
    sr: "Pendiente",
  },
  info: {
    dot: "bg-slate-400",
    ring: "ring-slate-200",
    text: "text-slate-700",
    bg: "bg-slate-50",
    border: "border-slate-300",
    icon: "i",
    sr: "Información",
  },
};

/** Punto/insignia de estado con icono y etiqueta accesible. */
export function StatusBadge({ status }: { status: ComplianceStatus }) {
  const m = STATUS_META[status];
  return (
    <span
      className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${m.dot} ring-2 ${m.ring}`}
      aria-hidden="true"
    >
      {m.icon}
      <span className="sr-only">{m.sr}</span>
    </span>
  );
}

/**
 * Semáforo en vivo (una sola verificación). Úsalo junto a un campo para dar
 * feedback inmediato mientras la persona digita.
 */
export function LegalSemaphore({
  status,
  label,
  detail,
}: {
  status: ComplianceStatus;
  label: string;
  detail?: string;
}) {
  const m = STATUS_META[status];
  return (
    <div
      className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${m.bg} ${m.border} ${m.text}`}
      role="status"
    >
      <StatusBadge status={status} />
      <span>
        <strong>{label}</strong>
        {detail && <span className="mt-0.5 block font-normal">{detail}</span>}
      </span>
    </div>
  );
}

const OVERALL_META = {
  pass: {
    title: "Tu contrato cumple la Ley 820",
    blurb: "Todas las verificaciones aplicables están en verde.",
    badge: "bg-emerald-600",
    border: "border-emerald-300",
    bg: "bg-emerald-50/70",
  },
  warn: {
    title: "Casi listo: hay puntos por revisar",
    blurb: "Resuelve los puntos en ámbar para dejar el contrato blindado.",
    badge: "bg-amber-500",
    border: "border-amber-300",
    bg: "bg-amber-50/70",
  },
  fail: {
    title: "Hay un punto que incumple la ley",
    blurb: "Corrige lo marcado en rojo antes de generar el contrato.",
    badge: "bg-rose-600",
    border: "border-rose-300",
    bg: "bg-rose-50/70",
  },
} as const;

/**
 * "Sello de cumplimiento Ley 820": panel-resumen con el estado global y el
 * detalle de cada verificación (en vivo + cumplimiento por diseño).
 */
export function LegalComplianceSeal({ checks }: { checks: ComplianceCheck[] }) {
  const summary = summarizeCompliance(checks);
  const o = OVERALL_META[summary.overall];

  return (
    <section
      className={`rounded-2xl border ${o.border} ${o.bg} p-4`}
      aria-label="Sello de cumplimiento legal"
    >
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg text-white ${o.badge}`}
          aria-hidden="true"
        >
          ⚖️
        </span>
        <div>
          <h3 className="text-sm font-bold text-slate-900">{o.title}</h3>
          <p className="text-xs text-slate-600">{o.blurb}</p>
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {checks.map((c) => {
          const m = STATUS_META[c.status];
          return (
            <li
              key={c.id}
              className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white/80 px-3 py-2"
            >
              <StatusBadge status={c.status} />
              <div className="min-w-0">
                <p className={`text-sm font-medium ${m.text}`}>{c.label}</p>
                <p className="text-xs text-slate-600">{c.detail}</p>
                <p className="mt-0.5 text-[11px] text-slate-400">{c.legalRef}</p>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
        Verificación orientativa basada en la Ley 820 de 2003 y normas citadas. Confirma los valores aplicados; no
        sustituye asesoría legal.
      </p>
    </section>
  );
}
