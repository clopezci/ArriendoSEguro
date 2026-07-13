"use client";

import Link from "next/link";
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
  referrals?: Array<{ email: string; qualified: boolean; status: "pending" | "approved" | "rejected" }>;
  freeContract?: { required: number; qualified: number; earned: number; toNext: number };
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
  const req = data.freeContract?.required ?? 3;
  const qualified = data.freeContract?.qualified ?? 0;
  const earned = data.freeContract?.earned ?? 0;
  const progressToNext = qualified % req; // 0..req-1 dentro del tramo actual

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
          <h2 className="text-lg font-bold text-slate-900">Invita y gana un contrato gratis</h2>
          <p className="mt-1 text-sm text-slate-600">
            Comparte tu enlace. Cuando <strong>{req} personas</strong> que invitaste <strong>usen la app</strong> (creen su
            contrato), tu <strong className="text-emerald-700">siguiente contrato es GRATIS</strong> (con la firma incluida).
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

      {/* Contrato gratis ganado (o progreso hacia él). */}
      {earned > 0 ? (
        <div className="mt-4 rounded-xl border-2 border-emerald-400 bg-emerald-50 p-4">
          <p className="text-sm font-black text-emerald-800">🎉 ¡Ganaste {earned === 1 ? "un contrato GRATIS" : `${earned} contratos GRATIS`}!</p>
          <p className="mt-1 text-xs text-emerald-800/90">
            Ya tienes <strong>{earned}</strong> contrato(s) gratis en tu cuenta (con la firma incluida). Se aplica solo al
            crear tu próximo contrato.
          </p>
          <Link href="/nuevo" className="mt-3 inline-flex rounded-xl bg-[#12B886] px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-emerald-500/30 transition hover:brightness-105">
            Usar mi contrato gratis →
          </Link>
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-violet-200 bg-white/80 p-3">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>Referidos que ya usaron la app</span>
            <span className="font-semibold">{progressToNext}/{req}</span>
          </div>
          <div className="mt-1 h-2 rounded bg-slate-200">
            <div className="h-2 rounded bg-emerald-500 transition-all" style={{ width: `${Math.min(100, Math.round((progressToNext / req) * 100))}%` }} />
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            Te faltan <strong>{req - progressToNext}</strong> para tu próximo contrato gratis. Solo cuentan los que{" "}
            <strong>de verdad usan</strong> la app (generan un contrato), no los que solo se registran.
          </p>
        </div>
      )}

      {/* Lista: quién de tus invitados ya usó el servicio. */}
      {data.referrals && data.referrals.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-xs font-semibold text-slate-600">Tus invitados</p>
          <ul className="space-y-1.5">
            {data.referrals.map((r, i) => (
              <li key={i} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm">
                <span className="truncate text-slate-700">{r.email}</span>
                {r.qualified ? (
                  <span className="flex-none rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">✓ Usó la app</span>
                ) : (
                  <span className="flex-none rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">Pendiente de usar</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.myReferralStatus === "approved" && pct > 0 && (
        <p className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          🎉 Además, tienes <strong>{pct}% de descuento</strong> aprobado en tu contrato por venir referido.
        </p>
      )}
    </section>
  );
}
