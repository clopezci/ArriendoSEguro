"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

/** Resta meses a una fecha conservando el día (ajusta fin de mes). */
function subtractMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const targetMonthDay = d.getDate();
  d.setMonth(d.getMonth() - months);
  // Si el mes resultante no tiene ese día (p. ej. 31), Date corre al mes siguiente: lo corregimos.
  if (d.getDate() !== targetMonthDay) {
    d.setDate(0);
  }
  return d;
}

function formatEsCo(date: Date): string {
  return date.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
}

/** Diferencia en días enteros entre dos fechas (a - b), ignorando la hora. */
function diffDays(a: Date, b: Date): number {
  const da = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const db = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.round((da - db) / 86_400_000);
}

export function NoticePeriodCalculator() {
  const [endDate, setEndDate] = useState("");

  const result = useMemo(() => {
    if (!endDate) return null;
    const end = new Date(`${endDate}T00:00:00`);
    if (Number.isNaN(end.getTime())) return null;
    const deadline = subtractMonths(end, 3);
    const today = new Date();
    const daysLeft = diffDays(deadline, today);
    return { end, deadline, daysLeft };
  }, [endDate]);

  return (
    <div className="space-y-4 rounded-2xl border border-slate-300 bg-white/90 p-5 shadow-sm">
      <label className="block text-sm font-medium text-slate-800">
        Fecha de vencimiento (o renovación) del contrato
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="input mt-1"
        />
      </label>

      {result && (
        <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-4">
          <p className="text-sm text-slate-700">
            Fecha límite para enviar el preaviso (3 meses antes):{" "}
            <strong className="text-violet-800">{formatEsCo(result.deadline)}</strong>
          </p>
          <p className="mt-2 text-sm text-slate-700">
            {result.daysLeft > 0 ? (
              <>
                Aún tienes <strong className="text-violet-800">{result.daysLeft}</strong> día(s) para avisar a tiempo.
              </>
            ) : result.daysLeft === 0 ? (
              <strong className="text-amber-700">Hoy es el último día para avisar a tiempo.</strong>
            ) : (
              <strong className="text-rose-700">
                El plazo para avisar a tiempo ya pasó (hace {Math.abs(result.daysLeft)} día(s)). El contrato podría
                renovarse automáticamente.
              </strong>
            )}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            El preaviso debe constar por escrito y notificarse por el medio pactado o el servicio postal autorizado.
          </p>
        </div>
      )}

      <div className="rounded-lg border-l-4 border-violet-500 bg-violet-50 px-3 py-2 text-xs leading-relaxed text-violet-950">
        La Ley 820 de 2003 exige un preaviso <strong>no inferior a tres (3) meses</strong> antes del vencimiento. Sin
        constancia escrita del preaviso, el contrato se entiende <strong>renovado automáticamente</strong> por un término
        igual al inicialmente pactado.
      </div>
      <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        Herramienta orientativa. Cada causal de terminación tiene requisitos propios; conserva la constancia escrita y
        valida tu caso con un profesional cuando aplique.
      </p>

      <div className="rounded-xl border border-violet-300 bg-gradient-to-br from-violet-50 to-white p-4">
        <p className="text-sm font-medium text-slate-800">¿Necesitas avisar la terminación?</p>
        <p className="mt-1 text-sm text-slate-600">
          Descarga gratis una carta de preaviso lista para diligenciar en el centro de plantillas.
        </p>
        <Link
          href="/plantillas"
          className="mt-3 inline-flex rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
        >
          Ver plantillas
        </Link>
      </div>
    </div>
  );
}
