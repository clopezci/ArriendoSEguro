"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";

type ReferralMe = {
  success: boolean;
  code?: string;
  link?: string;
  referredCount?: number;
  approvedCount?: number;
  pendingCount?: number;
  qualifiedCount?: number;
  signatureUnlock?: { required: number; qualified: number; unlocked: boolean; microFeeCop: number };
  myReferralStatus?: "pending" | "approved" | "rejected" | null;
  program?: { enabled: boolean; discountPercent: number };
};

/** Tarjeta "Invita y gana": enlace propio, conteo y estado del descuento. */
export function ReferralPanel() {
  const { user } = useAuth();
  const [data, setData] = useState<ReferralMe | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch("/api/referrals/me", { headers: { ...(await buildAuthHeaders(user)) } });
      const j = (await res.json()) as ReferralMe;
      if (res.ok && j.success) setData(j);
    } catch {
      /* sin red: no mostrar la tarjeta */
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!data?.code || !data.program?.enabled) return null;

  const link = data.link ?? "";
  const pct = data.program?.discountPercent ?? 0;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* algunos navegadores bloquean clipboard sin gesto: el usuario puede copiar manual */
    }
  }

  return (
    <section className="rounded-2xl border border-violet-300 bg-gradient-to-br from-violet-50 to-white p-5 shadow-[0_10px_24px_rgba(139,92,246,0.16)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Invita y gana</h2>
          <p className="mt-1 text-sm text-slate-600">
            Comparte tu enlace. Cuando un invitado crea su cuenta, lo apruebas tú y obtiene{" "}
            <strong className="text-violet-700">{pct}% de descuento</strong> en su Plan Plus.
          </p>
        </div>
        <span className="rounded-full bg-violet-600 px-3 py-1 text-xs font-semibold text-white">
          Código: {data.code}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          readOnly
          value={link}
          aria-label="Tu enlace de invitación"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
        />
        <button
          type="button"
          onClick={() => void copy()}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
        >
          {copied ? "¡Copiado!" : "Copiar enlace"}
        </button>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-3 text-center text-sm">
        <div className="rounded-lg border border-slate-200 bg-white/80 p-2">
          <dt className="text-xs text-slate-500">Invitados</dt>
          <dd className="text-base font-semibold text-slate-800">{data.referredCount ?? 0}</dd>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white/80 p-2">
          <dt className="text-xs text-slate-500">Aprobados</dt>
          <dd className="text-base font-semibold text-emerald-700">{data.approvedCount ?? 0}</dd>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white/80 p-2">
          <dt className="text-xs text-slate-500">Pendientes</dt>
          <dd className="text-base font-semibold text-amber-700">{data.pendingCount ?? 0}</dd>
        </div>
      </dl>

      {data.signatureUnlock && (
        <div className="mt-4 rounded-lg border border-violet-200 bg-white/80 p-3">
          <p className="text-sm font-semibold text-slate-900">Desbloquea la firma certificada</p>
          {data.signatureUnlock.unlocked ? (
            <p className="mt-1 text-sm text-emerald-800">
              🎉 ¡Desbloqueada! Lograste {data.signatureUnlock.required} referidos que usaron la app.
            </p>
          ) : (
            <>
              <p className="mt-1 text-xs text-slate-600">
                Refiere a <strong>{data.signatureUnlock.required} personas que usen la app</strong> (que generen su
                contrato), o paga una sola vez <strong>${data.signatureUnlock.microFeeCop.toLocaleString("es-CO")}</strong>.
              </p>
              <div className="mt-2">
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>Referidos que usaron la app</span>
                  <span>
                    {data.signatureUnlock.qualified}/{data.signatureUnlock.required}
                  </span>
                </div>
                <div className="mt-1 h-2 rounded bg-slate-200">
                  <div
                    className="h-2 rounded bg-violet-500 transition-all"
                    style={{ width: `${Math.min(100, Math.round((data.signatureUnlock.qualified / data.signatureUnlock.required) * 100))}%` }}
                  />
                </div>
              </div>
              <p className="mt-2 text-[11px] text-slate-500">
                Solo cuentan los referidos que <strong>de verdad usan</strong> la app (generan un contrato), no los que
                solo se registran.
              </p>
            </>
          )}
        </div>
      )}

      {data.myReferralStatus === "approved" && (
        <p className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          🎉 Tienes <strong>{pct}% de descuento</strong> aprobado en tu Plan Plus por venir referido.
        </p>
      )}
      {data.myReferralStatus === "pending" && (
        <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Tu descuento por referido está <strong>pendiente de aprobación</strong>. Te avisaremos al activarlo.
        </p>
      )}
    </section>
  );
}
