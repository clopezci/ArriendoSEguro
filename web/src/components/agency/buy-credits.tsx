"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";

type Plan = { code: string; name: string; credits: number; priceCop: number };

function money(n: number) {
  return "$" + (n || 0).toLocaleString("es-CO");
}

export function BuyCredits({ agencyId }: { agencyId: string }) {
  const { user } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/agency/${agencyId}/buy-credits`, { headers: { ...(await buildAuthHeaders(user)) } });
      const json = (await res.json()) as { success?: boolean; plans?: Plan[] };
      if (json?.success) setPlans(json.plans ?? []);
    } finally {
      setLoading(false);
    }
  }, [agencyId, user]);

  useEffect(() => {
    void load();
  }, [load]);

  async function buy(planCode: string) {
    setErr(null);
    setBusy(planCode);
    try {
      const res = await fetch(`/api/agency/${agencyId}/buy-credits`, {
        method: "POST",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({ planCode }),
      });
      const json = (await res.json()) as { success?: boolean; checkoutUrl?: string; errors?: { message?: string }[] };
      if (!res.ok || !json.success || !json.checkoutUrl) {
        setErr(json.errors?.[0]?.message ?? "No se pudo iniciar la compra.");
      } else {
        window.location.href = json.checkoutUrl;
      }
    } catch {
      setErr("Error de red al comprar.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-violet-200 bg-violet-50/40 p-4">
        <p className="text-sm font-bold text-violet-900">💳 Comprar créditos</p>
        <p className="mt-1 text-xs text-slate-600">Cada crédito = un contrato que puedes enviar a firma. Al pagar, se recargan automáticamente en tu saldo.</p>
      </div>
      {loading && <p className="text-sm text-slate-500">Cargando planes…</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {plans.map((p) => (
          <div key={p.code} className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-bold text-slate-800">{p.name}</p>
            <p className="mt-1 text-2xl font-black text-slate-900">{money(p.priceCop)}</p>
            <p className="text-xs text-slate-500">{p.credits} créditos · {money(Math.round(p.priceCop / p.credits))} c/u</p>
            <button
              type="button"
              onClick={() => void buy(p.code)}
              disabled={busy !== null}
              className="mt-3 w-full rounded-lg bg-[#5646E5] px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
            >
              {busy === p.code ? "Redirigiendo…" : "Comprar"}
            </button>
          </div>
        ))}
      </div>
      {err && <p className="text-xs text-rose-600">{err}</p>}
    </div>
  );
}
