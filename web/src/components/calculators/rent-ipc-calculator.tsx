"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { IPC_REFERENCE, calculateMaxAllowedRentAfterIpc, formatCop } from "@/lib/domain/rent-law";

function parseCop(v: string): number {
  const n = Number(v.replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export type RentIpcCalculatorProps = {
  /** IPC vigente (desde la config del admin); por defecto usa IPC_REFERENCE. */
  ipcPercent?: number;
  ipcPreviousYear?: number;
  ipcAppliesToYear?: number;
  ipcSource?: string;
};

export function RentIpcCalculator({
  ipcPercent = IPC_REFERENCE.percent,
  ipcPreviousYear = IPC_REFERENCE.previousYear,
  ipcAppliesToYear = IPC_REFERENCE.appliesToYear,
  ipcSource = IPC_REFERENCE.source,
}: RentIpcCalculatorProps = {}) {
  const [rent, setRent] = useState("");
  const current = parseCop(rent);
  const { maxNewRent } = useMemo(
    () => calculateMaxAllowedRentAfterIpc(current, ipcPercent),
    [current, ipcPercent],
  );
  const increase = Math.max(0, maxNewRent - current);

  return (
    <div className="space-y-4 rounded-2xl border border-slate-300 bg-white/90 p-5 shadow-sm">
      <label className="block text-sm font-medium text-slate-800">
        Canon mensual actual (COP)
        <input
          inputMode="numeric"
          value={rent}
          onChange={(e) => setRent(e.target.value)}
          placeholder="Ej: 1.500.000"
          className="input mt-1"
          aria-describedby="ipc-help"
        />
      </label>
      <p id="ipc-help" className="text-xs text-slate-600">
        Tope vigente: IPC {ipcPreviousYear} = <strong>{ipcPercent} %</strong> ({ipcSource}), aplicable a reajustes
        durante {ipcAppliesToYear}.
      </p>

      {current > 0 && (
        <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-4">
          <p className="text-sm text-slate-700">
            Nuevo canon máximo: <strong className="text-violet-800">{formatCop(maxNewRent)}</strong>
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Incremento máximo: {formatCop(increase)} ({ipcPercent} %).
          </p>
        </div>
      )}

      <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        <strong>Verifica los valores aplicados:</strong> IPC {ipcPreviousYear} = {ipcPercent} % ({ipcSource}). Esta
        herramienta es orientativa; confirma que la cifra siga vigente con el DANE antes de aplicar un reajuste.
      </p>

      <div className="rounded-lg border-l-4 border-violet-500 bg-violet-50 px-3 py-2 text-xs leading-relaxed text-violet-950">
        El reajuste solo procede al cumplir 12 meses bajo el mismo precio, hasta el 100 % del IPC del año calendario
        anterior (Ley 820 de 2003, art. 20). El arrendador debe informar el monto y la fecha; sin ese aviso, el
        incremento es inoponible.
      </div>

      <div className="rounded-xl border border-violet-300 bg-gradient-to-br from-violet-50 to-white p-4">
        <p className="text-sm font-medium text-slate-800">¿Vas a renovar o reajustar tu arriendo?</p>
        <p className="mt-1 text-sm text-slate-600">
          Genera tu contrato con el canon y el reajuste bien documentados en ArriendoSeguro.
        </p>
        <Link
          href="/nuevo"
          className="mt-3 inline-flex rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
        >
          Crear mi contrato
        </Link>
      </div>
    </div>
  );
}
