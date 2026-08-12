"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";

type Metric = { yes: number; pct: number };
type Resp = {
  success?: boolean;
  total?: number;
  metrics?: { easy: Metric; liked: Metric; recommend: Metric };
  recent?: { createdAt: string; easy: boolean; liked: boolean; recommend: boolean; respondentEmail: string | null; contractId: string | null }[];
  error?: string;
};

export default function AdminSatisfaccionPage() {
  const { user, loading } = useAuth();
  const [data, setData] = useState<Resp | null>(null);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    setErr("");
    try {
      const res = await fetch("/api/admin/contract-surveys", { headers: { ...(await buildAuthHeaders(user)) } });
      const j = (await res.json()) as Resp;
      if (!res.ok || !j.success) {
        setErr(j.error ?? "No autorizado o error al cargar.");
        return;
      }
      setData(j);
    } catch {
      setErr("Error de red.");
    }
  }, [user]);

  useEffect(() => {
    if (!loading && user) void load();
  }, [loading, user, load]);

  const M = ({ label, m }: { label: string; m?: Metric }) => (
    <div className="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm">
      <p className="text-3xl font-bold text-violet-700">{m ? `${m.pct}%` : "—"}</p>
      <p className="mt-1 text-sm text-slate-600">{label}</p>
      <p className="text-xs text-slate-400">{m ? `${m.yes} 👍` : ""}</p>
    </div>
  );

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6 text-slate-900">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Satisfacción post-contrato</h1>
          <p className="text-sm text-slate-600">Encuesta de 3 preguntas al terminar un contrato. Total: {data?.total ?? "—"}.</p>
        </div>
        <Link href="/admin" className="text-sm text-violet-700 underline">← Volver a admin</Link>
      </header>

      {err && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{err}</p>}

      <div className="grid gap-4 sm:grid-cols-3">
        <M label="¿Fue fácil?" m={data?.metrics?.easy} />
        <M label="¿Les gustó?" m={data?.metrics?.liked} />
        <M label="¿Lo recomiendan?" m={data?.metrics?.recommend} />
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Respuestas recientes</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-300 text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-2 py-2">Fecha</th>
                <th className="px-2 py-2">Fácil</th>
                <th className="px-2 py-2">Gustó</th>
                <th className="px-2 py-2">Recomienda</th>
                <th className="px-2 py-2">Usuario</th>
              </tr>
            </thead>
            <tbody>
              {(data?.recent ?? []).map((r, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="px-2 py-1.5">{r.createdAt.slice(0, 16).replace("T", " ")}</td>
                  <td className="px-2 py-1.5">{r.easy ? "👍" : "👎"}</td>
                  <td className="px-2 py-1.5">{r.liked ? "👍" : "👎"}</td>
                  <td className="px-2 py-1.5">{r.recommend ? "👍" : "👎"}</td>
                  <td className="px-2 py-1.5 text-slate-500">{r.respondentEmail ?? "—"}</td>
                </tr>
              ))}
              {(data?.recent ?? []).length === 0 && !err && (
                <tr><td colSpan={5} className="px-2 py-3 text-slate-500">Sin respuestas todavía.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
