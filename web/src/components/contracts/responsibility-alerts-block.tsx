"use client";

import type { ResponsibilitySignal, AlertSeverity } from "@/domain/contracts/responsibilityAlerts";

/**
 * Bloque "Constancia de alertas y responsabilidad" que ve el dueño o el inquilino
 * antes de firmar. Tono informativo, nunca acusatorio. Deja claro que es
 * responsabilidad de las partes verificar; queda archivado en el expediente.
 */
const SEVERITY_STYLE: Record<AlertSeverity, { box: string; dot: string; label: string }> = {
  info: { box: "border-sky-200 bg-sky-50", dot: "bg-sky-500", label: "Informativo" },
  warn: { box: "border-amber-300 bg-amber-50", dot: "bg-amber-500", label: "Atención" },
  high: { box: "border-rose-300 bg-rose-50", dot: "bg-rose-500", label: "Revisar" },
};

export function ResponsibilityAlertsBlock({
  intro,
  signals,
  audience,
}: {
  intro: string;
  signals: ResponsibilitySignal[];
  audience: "owner" | "tenant";
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <span aria-hidden="true">🛡️</span>
        <h2 className="text-sm font-bold text-slate-900">Constancia de alertas y responsabilidad</h2>
      </div>
      <p className="mt-1 text-[13px] leading-relaxed text-slate-600">{intro}</p>

      {signals.length === 0 ? (
        <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-[13px] text-emerald-800">
          No se identificaron puntos de atención adicionales. Aun así, la verificación de la información y de los
          documentos es responsabilidad de las partes.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {signals.map((s) => {
            const st = SEVERITY_STYLE[s.severity];
            return (
              <li key={s.id} className={`rounded-xl border p-3 ${st.box}`}>
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${st.dot}`} aria-hidden="true" />
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{st.label}</span>
                </div>
                <p className="mt-1 text-[13px] font-semibold text-slate-900">{s.title}</p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-slate-700">{s.detail}</p>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
        {audience === "owner"
          ? "Al continuar, dejas constancia de que conociste estos puntos. Esta constancia se archiva en el expediente del contrato."
          : "Al firmar, dejas constancia de que conociste estos puntos. Esta constancia queda archivada en el expediente del contrato."}
      </p>
    </section>
  );
}
