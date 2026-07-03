"use client";

import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
import { useCallback, useEffect, useState } from "react";

type LogRow = {
  id: string;
  to: string;
  subject: string;
  templateCode: string;
  provider: string;
  status: string;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  errorMessage: string | null;
  createdAt: string | null;
};

function statusStyle(status: string): string {
  if (status === "sent") return "bg-emerald-100 text-emerald-800";
  if (status === "failed") return "bg-rose-100 text-rose-800";
  if (status === "mock") return "bg-amber-100 text-amber-800";
  return "bg-slate-100 text-slate-700";
}

export default function EmailLogsPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/email-logs", { headers: { ...(await buildAuthHeaders(user)) } });
      const j = (await res.json()) as {
        success?: boolean;
        logs?: LogRow[];
        summary?: Record<string, number>;
        errors?: { message?: string }[];
      };
      if (!res.ok || !j.success) {
        setError(j.errors?.[0]?.message ?? "No autorizado o error al consultar.");
        return;
      }
      setLogs(j.logs ?? []);
      setSummary(j.summary ?? {});
    } catch {
      setError("Error de red.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-6 text-slate-900">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Diagnóstico de correos</h1>
          <p className="text-sm text-slate-600">
            Últimos 60 envíos. <strong>sent</strong> = Resend lo aceptó (si no llega, es spam/entrega del destinatario).{" "}
            <strong>failed</strong> = falló (mira el error). <strong>mock</strong> = Resend no configurado en ese entorno.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-lg border border-violet-500 px-3 py-1.5 text-sm font-medium text-violet-700 disabled:opacity-60"
        >
          {loading ? "Actualizando…" : "↻ Actualizar"}
        </button>
      </header>

      <div className="flex flex-wrap gap-2 text-sm">
        {Object.entries(summary).map(([k, v]) => (
          <span key={k} className={`rounded-full px-3 py-1 font-medium ${statusStyle(k)}`}>
            {k}: {v}
          </span>
        ))}
      </div>

      {error && <p className="rounded border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

      <div className="overflow-auto rounded-lg border border-slate-300 bg-white">
        <table className="min-w-full text-xs text-slate-700">
          <thead>
            <tr className="border-b border-slate-300 bg-slate-50 text-left">
              <th className="px-2 py-2">Fecha</th>
              <th className="px-2 py-2">Estado</th>
              <th className="px-2 py-2">Proveedor</th>
              <th className="px-2 py-2">Para</th>
              <th className="px-2 py-2">Plantilla</th>
              <th className="px-2 py-2">Asunto</th>
              <th className="px-2 py-2">Error</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-b border-slate-200 align-top">
                <td className="whitespace-nowrap px-2 py-1.5">
                  {l.createdAt ? new Date(l.createdAt).toLocaleString("es-CO") : "-"}
                </td>
                <td className="px-2 py-1.5">
                  <span className={`rounded px-1.5 py-0.5 font-medium ${statusStyle(l.status)}`}>{l.status}</span>
                </td>
                <td className="px-2 py-1.5">{l.provider}</td>
                <td className="px-2 py-1.5">{l.to}</td>
                <td className="px-2 py-1.5">{l.templateCode}</td>
                <td className="px-2 py-1.5">{l.subject}</td>
                <td className="max-w-[18rem] px-2 py-1.5 text-rose-700">{l.errorMessage ?? ""}</td>
              </tr>
            ))}
            {logs.length === 0 && !loading && (
              <tr>
                <td colSpan={7} className="px-2 py-4 text-center text-slate-500">
                  No hay registros de correo todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
