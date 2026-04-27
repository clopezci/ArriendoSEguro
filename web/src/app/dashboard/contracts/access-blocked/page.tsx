"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";

export default function AccessBlockedNoPlusPage() {
  const { user } = useAuth();
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  async function startDemo() {
    if (!user) return;
    setError("");
    setMsg("");
    const res = await fetch("/api/access/demo/start", {
      method: "POST",
      headers: { ...(await buildAuthHeaders(user)) },
    });
    const data = (await res.json()) as { success?: boolean; errors?: { message: string }[] };
    if (!res.ok || !data.success) {
      setError(data.errors?.[0]?.message ?? "No se pudo activar demo.");
      return;
    }
    setMsg("Demo activado. Ahora puedes crear un expediente demo.");
  }

  return (
    <section className="mx-auto max-w-2xl rounded-2xl border border-amber-500/50 bg-amber-900/20 p-6 text-center shadow-[0_10px_24px_rgba(245,158,11,0.2)]">
      <h1 className="text-xl font-semibold text-amber-200">
        Para crear un contrato real debes activar el Plan Plus.
      </h1>
      <p className="mt-2 text-amber-100/90">
        El plan demo es gratuito para explorar la plataforma, pero no habilita contratos reales.
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-3">
        <Link
          href="/dashboard/plans"
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-[0_0_18px_rgba(139,92,246,0.35)]"
        >
          Activar Plan Plus
        </Link>
        <button
          type="button"
          onClick={startDemo}
          className="rounded-lg border border-violet-400 px-4 py-2 text-sm font-medium text-violet-200"
        >
          Probar demo
        </button>
      </div>
      {msg && <p className="mt-3 text-sm text-emerald-200">{msg}</p>}
      {error && <p className="mt-3 text-sm text-rose-200">{error}</p>}
    </section>
  );
}

