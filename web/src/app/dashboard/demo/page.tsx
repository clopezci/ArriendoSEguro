"use client";

import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DashboardDemoPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  async function startDemo() {
    if (!user) return;
    setLoading(true);
    setMsg("");
    setError("");
    try {
      const res = await fetch("/api/access/demo/start", {
        method: "POST",
        headers: { ...(await buildAuthHeaders(user)) },
      });
      const data = (await res.json()) as { success?: boolean; errors?: { message: string }[] };
      if (!res.ok || !data.success) throw new Error(data.errors?.[0]?.message ?? "No se pudo activar demo.");
      setMsg("Demo activado. Los documentos demo llevan marca de no validez.");
      router.push("/dashboard/contracts/new");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al activar demo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-white">Demo guiado</h1>
        <p className="text-sm text-slate-400">
          Explorá cómo funciona ArriendoSeguro con datos de ejemplo. El demo no genera contratos reales ni
          documentos válidos para usar ante terceros.
        </p>
      </header>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-[0_12px_30px_rgba(139,92,246,0.18)]">
        <p className="text-sm text-slate-300">
          Te vamos a crear un expediente de demostración para que recorras los pasos sin pagar Plan Plus.
          Cuando quieras un expediente válido, activá Plus desde Planes.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            disabled={loading || !user}
            onClick={() => void startDemo()}
            className="rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-[0_0_18px_rgba(139,92,246,0.35)] hover:bg-violet-500 disabled:opacity-50"
          >
            {loading ? "Activando…" : "Ver demo"}
          </button>
          <Link
            href="/dashboard/plans"
            className="inline-flex items-center justify-center rounded-lg border border-slate-600 px-4 py-3 text-sm text-slate-200 hover:border-violet-400"
          >
            Ver planes (contrato real)
          </Link>
        </div>
        {msg && <p className="mt-4 text-sm text-emerald-300">{msg}</p>}
        {error && <p className="mt-4 text-sm text-rose-300">{error}</p>}
      </div>
    </section>
  );
}
