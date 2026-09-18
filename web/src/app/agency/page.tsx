"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";

type AgencyLite = { id: string; name: string; status: string };

export default function AgencyHomePage() {
  const { user, loading } = useAuth();
  const [agencies, setAgencies] = useState<AgencyLite[] | null>(null);
  const [fetching, setFetching] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setFetching(true);
    try {
      const res = await fetch("/api/agency/me", { headers: { ...(await buildAuthHeaders(user)) } });
      const json = (await res.json()) as { success?: boolean; agencies?: AgencyLite[] };
      setAgencies(json?.success ? json.agencies ?? [] : []);
    } catch {
      setAgencies([]);
    } finally {
      setFetching(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">Panel de Agencia</h1>
      <p className="mt-1 text-sm text-slate-600">Gestiona tus contratos en volumen: arrendadores, inmuebles y cartera.</p>

      {loading && <p className="mt-6 text-sm text-slate-500">Cargando…</p>}

      {!loading && !user && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 text-sm">
          <p className="text-slate-700">Inicia sesión para entrar a tu panel de agencia.</p>
          <Link href="/ingresar" className="mt-3 inline-block rounded-lg bg-[#5646E5] px-4 py-2 text-sm font-bold text-white">Ingresar</Link>
        </div>
      )}

      {!loading && user && (
        <div className="mt-6 space-y-3">
          {fetching && <p className="text-sm text-slate-500">Buscando tus agencias…</p>}
          {agencies && agencies.length === 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-6 text-sm text-slate-700">
              <p className="font-semibold text-amber-900">No perteneces a ninguna agencia todavía.</p>
              <p className="mt-1">Si eres una arrendadora/inmobiliaria y quieres usar el panel de volumen, escríbenos a contacto@arriendoseguro.app para activarte.</p>
            </div>
          )}
          {agencies && agencies.length > 0 && (
            <ul className="space-y-2">
              {agencies.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/agency/${a.id}`}
                    className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm hover:border-violet-300"
                  >
                    <span className="font-semibold text-slate-800">🏢 {a.name}</span>
                    <span className="text-xs text-slate-400">Entrar →</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </main>
  );
}
