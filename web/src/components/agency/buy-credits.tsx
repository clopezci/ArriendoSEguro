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

  // Auto-recarga (plan Ilimitado)
  const [ar, setAr] = useState<{ enabled: boolean; planCode: string; thresholdCredits: number }>({ enabled: false, planCode: "", thresholdCredits: 3 });
  const [arBusy, setArBusy] = useState(false);
  const [arMsg, setArMsg] = useState<string | null>(null);

  // Dudas / solicitudes (llegan al equipo por correo + Telegram)
  const [inq, setInq] = useState("");
  const [inqTopic, setInqTopic] = useState<"prueba_ampliada" | "plan" | "duda" | "soporte" | "otro">("prueba_ampliada");
  const [inqBusy, setInqBusy] = useState(false);
  const [inqMsg, setInqMsg] = useState<string | null>(null);

  async function sendInquiry() {
    setInqMsg(null);
    if (inq.trim().length < 3) {
      setInqMsg("Escribe tu mensaje.");
      return;
    }
    setInqBusy(true);
    try {
      const res = await fetch(`/api/agency/${agencyId}/inquiry`, {
        method: "POST",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({ topic: inqTopic, message: inq.trim() }),
      });
      const json = (await res.json()) as { success?: boolean; errors?: { message?: string }[] };
      if (res.ok && json.success) {
        setInqMsg("¡Enviado! Te responderemos pronto.");
        setInq("");
      } else {
        setInqMsg(json.errors?.[0]?.message ?? "No se pudo enviar.");
      }
    } catch {
      setInqMsg("Error de red al enviar.");
    } finally {
      setInqBusy(false);
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, arRes] = await Promise.all([
        fetch(`/api/agency/${agencyId}/buy-credits`, { headers: { ...(await buildAuthHeaders(user)) } }),
        fetch(`/api/agency/${agencyId}/auto-recharge`, { headers: { ...(await buildAuthHeaders(user)) } }),
      ]);
      const pJson = (await pRes.json()) as { success?: boolean; plans?: Plan[] };
      if (pJson?.success) setPlans(pJson.plans ?? []);
      const arJson = (await arRes.json()) as { success?: boolean; autoRecharge?: { enabled: boolean; planCode: string; thresholdCredits: number } };
      if (arJson?.success && arJson.autoRecharge) setAr(arJson.autoRecharge);
    } finally {
      setLoading(false);
    }
  }, [agencyId, user]);

  async function saveAutoRecharge() {
    setArMsg(null);
    if (ar.enabled && !ar.planCode) {
      setArMsg("Elige un plan para la auto-recarga.");
      return;
    }
    setArBusy(true);
    try {
      const res = await fetch(`/api/agency/${agencyId}/auto-recharge`, {
        method: "PUT",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify(ar),
      });
      const json = (await res.json()) as { success?: boolean; errors?: { message?: string }[] };
      setArMsg(res.ok && json.success ? "Guardado ✅" : json.errors?.[0]?.message ?? "No se pudo guardar.");
    } catch {
      setArMsg("Error de red al guardar.");
    } finally {
      setArBusy(false);
    }
  }

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

      <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4">
        <label className="flex items-center gap-2 text-sm font-bold text-amber-900">
          <input
            type="checkbox"
            checked={ar.enabled}
            onChange={(e) => setAr((s) => ({ ...s, enabled: e.target.checked }))}
            className="h-4 w-4"
          />
          ♾️ Auto-recarga (plan Ilimitado)
        </label>
        <p className="mt-1 text-xs text-slate-600">
          Cuando tu saldo baje del umbral, generamos la orden del plan elegido y te enviamos el link de pago por correo, para que nunca frenes tus contratos.
        </p>
        {ar.enabled && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-slate-700">
              Plan a recargar
              <select
                value={ar.planCode}
                onChange={(e) => setAr((s) => ({ ...s, planCode: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Elige un plan…</option>
                {plans.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name} · {p.credits} créditos · {money(p.priceCop)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-700">
              Recargar cuando el saldo sea ≤
              <input
                type="number"
                min={0}
                max={100}
                value={ar.thresholdCredits}
                onChange={(e) => setAr((s) => ({ ...s, thresholdCredits: Math.max(0, Math.floor(Number(e.target.value) || 0)) }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
        )}
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => void saveAutoRecharge()}
            disabled={arBusy}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
          >
            {arBusy ? "Guardando…" : "Guardar auto-recarga"}
          </button>
          {arMsg && <span className="text-xs text-slate-600">{arMsg}</span>}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-bold text-slate-800">💬 ¿Quieres probar más antes de comprar, o tienes dudas?</p>
        <p className="mt-1 text-xs text-slate-600">Si se te acabó la prueba y quieres ver más antes de decidir, cuéntanos y te ampliamos la prueba. También puedes preguntar cualquier cosa o pedir un plan a tu medida.</p>
        <div className="mt-3 flex flex-col gap-2">
          <select
            value={inqTopic}
            onChange={(e) => setInqTopic(e.target.value as typeof inqTopic)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm sm:w-72"
          >
            <option value="prueba_ampliada">Quiero probar más antes de comprar</option>
            <option value="plan">Quiero un plan / más créditos</option>
            <option value="duda">Tengo una duda</option>
            <option value="soporte">Necesito soporte</option>
            <option value="otro">Otro</option>
          </select>
          <textarea
            value={inq}
            onChange={(e) => setInq(e.target.value)}
            rows={3}
            maxLength={1500}
            placeholder="Cuéntanos en qué te ayudamos…"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void sendInquiry()}
              disabled={inqBusy}
              className="rounded-lg bg-[#5646E5] px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
            >
              {inqBusy ? "Enviando…" : "Enviar"}
            </button>
            {inqMsg && <span className="text-xs text-slate-600">{inqMsg}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
