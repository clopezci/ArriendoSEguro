"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { calculateLegalMonthlyRentCap, formatCop } from "@/lib/domain/rent-law";

function parseCop(v: string): number {
  const n = Number(v.replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function RentCapCalculator() {
  const [commercial, setCommercial] = useState("");
  const [cadastral, setCadastral] = useState("");
  const commercialValue = parseCop(commercial);
  const cadastralValue = parseCop(cadastral);

  const { cap, cappedByCadastre } = useMemo(
    () =>
      calculateLegalMonthlyRentCap({
        commercialValue,
        cadastralValue: cadastralValue > 0 ? cadastralValue : undefined,
      }),
    [commercialValue, cadastralValue],
  );

  return (
    <div className="space-y-4 rounded-2xl border border-slate-300 bg-white/90 p-5 shadow-sm">
      <label className="block text-sm font-medium text-slate-800">
        Valor comercial del inmueble (COP)
        <input
          inputMode="numeric"
          value={commercial}
          onChange={(e) => setCommercial(e.target.value)}
          placeholder="Ej: 250.000.000"
          className="input mt-1"
        />
      </label>
      <label className="block text-sm font-medium text-slate-800">
        Avalúo catastral (COP, opcional)
        <input
          inputMode="numeric"
          value={cadastral}
          onChange={(e) => setCadastral(e.target.value)}
          placeholder="Si lo conoces"
          className="input mt-1"
        />
        <span className="mt-1 block text-xs text-slate-600">
          El valor comercial no debería superar 2 veces el avalúo catastral (Ley 820).
        </span>
      </label>

      {commercialValue > 0 && (
        <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-4">
          <p className="text-sm text-slate-700">
            Canon mensual máximo (1 %): <strong className="text-violet-800">{formatCop(cap)}</strong>
          </p>
          {cappedByCadastre && (
            <p className="mt-1 text-xs text-amber-800">
              Ajustado al tope de 2× el avalúo catastral.
            </p>
          )}
        </div>
      )}

      <div className="rounded-lg border-l-4 border-violet-500 bg-violet-50 px-3 py-2 text-xs leading-relaxed text-violet-950">
        En vivienda urbana, el canon mensual no puede exceder el 1 % del valor comercial del inmueble (Ley 820 de 2003,
        art. 18). Cálculo orientativo; el valor comercial debe ser real y verificable.
      </div>

      <div className="rounded-xl border border-violet-300 bg-gradient-to-br from-violet-50 to-white p-4">
        <p className="text-sm font-medium text-slate-800">Fija un canon dentro de la ley</p>
        <p className="mt-1 text-sm text-slate-600">
          ArriendoSeguro valida el canon automáticamente al crear tu contrato. Generarlo es gratis.
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
