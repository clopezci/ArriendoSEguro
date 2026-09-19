"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
import { LandlordsManager } from "@/components/agency/landlords-manager";
import { PropertiesManager } from "@/components/agency/properties-manager";
import { BulkGenerator } from "@/components/agency/bulk-generator";
import { CarteraManager } from "@/components/agency/cartera-manager";
import { IdentityCheck } from "@/components/agency/identity-check";

type Summary = {
  agency: { id: string; name: string; nit: string | null; contactEmail: string; status: string };
  credits: number;
  counts: { landlords: number; properties: number };
};

type Tab = "resumen" | "cartera" | "arrendadores" | "inmuebles" | "generar" | "identidad";

export default function AgencyDashboardPage() {
  const params = useParams<{ agencyId: string }>();
  const agencyId = params.agencyId;
  const { user, loading } = useAuth();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [denied, setDenied] = useState(false);
  const [tab, setTab] = useState<Tab>("resumen");

  const load = useCallback(async () => {
    if (!user || !agencyId) return;
    try {
      const res = await fetch(`/api/agency/${agencyId}/summary`, { headers: { ...(await buildAuthHeaders(user)) } });
      if (res.status === 403 || res.status === 404) {
        setDenied(true);
        return;
      }
      const json = (await res.json()) as { success?: boolean } & Summary;
      if (json?.success) setSummary(json);
    } catch {
      /* noop */
    }
  }, [user, agencyId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <main className="mx-auto max-w-4xl px-4 py-10 text-sm text-slate-500">Cargando…</main>;

  if (!user) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10 text-sm">
        <p className="text-slate-700">Inicia sesión para entrar.</p>
        <Link href="/ingresar" className="mt-3 inline-block rounded-lg bg-[#5646E5] px-4 py-2 font-bold text-white">Ingresar</Link>
      </main>
    );
  }

  if (denied) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10 text-sm">
        <p className="text-rose-600">No tienes acceso a esta agencia.</p>
        <Link href="/agency" className="mt-3 inline-block text-violet-700 underline">Volver</Link>
      </main>
    );
  }

  const tabs: [Tab, string][] = [
    ["resumen", "Resumen"],
    ["cartera", "Cartera"],
    ["arrendadores", "Arrendadores"],
    ["inmuebles", "Inmuebles"],
    ["generar", "Generar en lote"],
    ["identidad", "Identidad"],
  ];

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link href="/agency" className="text-xs text-slate-400 hover:underline">← Mis agencias</Link>
          <h1 className="text-2xl font-bold text-slate-900">🏢 {summary?.agency.name ?? "Agencia"}</h1>
        </div>
        <span className="rounded-lg bg-amber-100 px-3 py-1.5 text-sm font-bold text-amber-800">
          {summary?.credits ?? 0} créditos
        </span>
      </div>

      <nav className="mt-4 flex flex-wrap gap-2">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-full border px-3 py-1.5 text-xs ${
              tab === id ? "border-violet-500 bg-violet-100/50 text-violet-800" : "border-slate-300 text-slate-600"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="mt-5">
        {tab === "resumen" && summary && (
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Créditos disponibles" value={summary.credits} />
            <Stat label="Arrendadores" value={summary.counts.landlords} />
            <Stat label="Inmuebles" value={summary.counts.properties} />
            <div className="sm:col-span-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
              <p className="font-semibold text-slate-800">Cómo funciona</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                <li>Carga tus <strong>arrendadores</strong> e <strong>inmuebles</strong> una vez (se reutilizan).</li>
                <li>Genera contratos en <strong>lote</strong> (próximamente en esta pantalla).</li>
                <li>Envía las firmas y sigue tu <strong>cartera</strong> desde aquí.</li>
              </ol>
              <p className="mt-3 text-xs text-slate-400">Cada contrato firmado consume 1 crédito. ¿Sin créditos? Escríbenos para recargar.</p>
            </div>
          </div>
        )}
        {tab === "cartera" && <CarteraManager agencyId={agencyId} />}
        {tab === "arrendadores" && <LandlordsManager agencyId={agencyId} />}
        {tab === "inmuebles" && <PropertiesManager agencyId={agencyId} />}
        {tab === "generar" && <BulkGenerator agencyId={agencyId} onGenerated={() => void load()} />}
        {tab === "identidad" && <IdentityCheck agencyId={agencyId} />}
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}
