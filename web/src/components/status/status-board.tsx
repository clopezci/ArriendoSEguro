"use client";

import { useEffect, useState } from "react";

type Service = { key: string; label: string; status: "operational" | "degraded" | "down"; detail: string };
type Incident = { id: string; title: string; body: string; severity: string; status: string; createdAt: string };
type StatusResponse = {
  success: boolean;
  overall: "operational" | "degraded" | "down";
  services: Service[];
  incidents: Incident[];
};

const DOT: Record<Service["status"], string> = {
  operational: "bg-emerald-500",
  degraded: "bg-amber-500",
  down: "bg-rose-500",
};
const LABEL: Record<Service["status"], string> = {
  operational: "Operativo",
  degraded: "Degradado",
  down: "Caído",
};
const OVERALL_TEXT: Record<StatusResponse["overall"], string> = {
  operational: "Todos los sistemas operativos",
  degraded: "Funcionamiento con incidencias",
  down: "Hay un servicio caído",
};

export function StatusBoard() {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/status", { cache: "no-store" });
        const j = (await res.json()) as StatusResponse;
        if (!cancelled && res.ok && j.success) setData(j);
        else if (!cancelled) setError("No se pudo cargar el estado.");
      } catch {
        if (!cancelled) setError("No se pudo conectar.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <p className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>;
  if (!data) return <p className="text-sm text-slate-600">Consultando estado…</p>;

  return (
    <div className="space-y-6">
      <div
        className={`rounded-2xl border p-4 ${
          data.overall === "operational"
            ? "border-emerald-300 bg-emerald-50"
            : data.overall === "degraded"
              ? "border-amber-300 bg-amber-50"
              : "border-rose-300 bg-rose-50"
        }`}
      >
        <p className="flex items-center gap-2 text-base font-semibold text-slate-900">
          <span className={`inline-block h-3 w-3 rounded-full ${DOT[data.overall]}`} aria-hidden="true" />
          {OVERALL_TEXT[data.overall]}
        </p>
      </div>

      <ul className="space-y-2">
        {data.services.map((s) => (
          <li
            key={s.key}
            className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/90 px-4 py-3"
          >
            <span className="min-w-0">
              <span className="block text-sm font-medium text-slate-900">{s.label}</span>
              <span className="block text-xs text-slate-500">{s.detail}</span>
            </span>
            <span className="flex items-center gap-2 text-xs font-medium text-slate-700">
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${DOT[s.status]}`} aria-hidden="true" />
              {LABEL[s.status]}
            </span>
          </li>
        ))}
      </ul>

      <section>
        <h2 className="text-sm font-semibold text-slate-900">Incidentes</h2>
        {data.incidents.length === 0 ? (
          <p className="mt-1 text-sm text-slate-600">Sin incidentes abiertos.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {data.incidents.map((i) => (
              <li key={i.id} className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
                <p className="text-sm font-semibold text-slate-900">
                  {i.title} <span className="text-xs font-normal text-amber-700">· {i.status}</span>
                </p>
                {i.body && <p className="mt-1 text-xs text-slate-600">{i.body}</p>}
                {i.createdAt && (
                  <p className="mt-1 text-[11px] text-slate-400">{new Date(i.createdAt).toLocaleString("es-CO")}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
