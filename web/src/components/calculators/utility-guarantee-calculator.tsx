"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { computeMaxUtilityGuaranteeCop } from "@/domain/contracts/utilityGuarantee";
import { formatCop } from "@/lib/domain/rent-law";

function parseCop(v: string): number {
  const n = Number(v.replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function UtilityGuaranteeCalculator() {
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const max = useMemo(() => computeMaxUtilityGuaranteeCop(parseCop(p1), parseCop(p2)), [p1, p2]);

  return (
    <div className="space-y-4 rounded-2xl border border-slate-300 bg-white/90 p-5 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-medium text-slate-800">
          Última factura de servicios (COP)
          <input
            inputMode="numeric"
            value={p1}
            onChange={(e) => setP1(e.target.value)}
            placeholder="Ej: 120.000"
            className="input mt-1"
          />
        </label>
        <label className="block text-sm font-medium text-slate-800">
          Penúltima factura (COP)
          <input
            inputMode="numeric"
            value={p2}
            onChange={(e) => setP2(e.target.value)}
            placeholder="Ej: 100.000"
            className="input mt-1"
          />
        </label>
      </div>

      {max > 0 && (
        <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-4">
          <p className="text-sm text-slate-700">
            Máximo legal de la garantía: <strong className="text-violet-800">{formatCop(max)}</strong>
          </p>
          <p className="mt-1 text-xs text-slate-600">Suma de los dos últimos períodos de facturación.</p>
        </div>
      )}

      <div className="rounded-lg border-l-4 border-violet-500 bg-violet-50 px-3 py-2 text-xs leading-relaxed text-violet-950">
        Es la <strong>única</strong> garantía permitida en vivienda urbana y es <strong>exclusiva para servicios
        públicos</strong> (Ley 820 de 2003, art. 15). No es el depósito general, que sí está prohibido (art. 16). No
        puede superar el valor de los dos últimos períodos.
      </div>

      <div className="rounded-xl border border-violet-300 bg-gradient-to-br from-violet-50 to-white p-4">
        <p className="text-sm font-medium text-slate-800">Déjala bien documentada</p>
        <p className="mt-1 text-sm text-slate-600">
          Al crear tu contrato en ArriendoSeguro puedes pactar esta garantía con su constancia. Generarlo es gratis.
        </p>
        <Link
          href="/crear-cuenta"
          className="mt-3 inline-flex rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
        >
          Crear mi contrato
        </Link>
      </div>
    </div>
  );
}
