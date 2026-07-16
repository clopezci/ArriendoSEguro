"use client";

import { RenewalReminderCard } from "@/components/contracts/renewal-reminder-card";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function AlertasContratoPage() {
  const id = String(useParams<{ id: string }>().id);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#F5F3EF] text-[#17151F]">
      <div className="pointer-events-none absolute -right-20 -top-28 h-80 w-80 rounded-full opacity-40 blur-3xl" style={{ background: "radial-gradient(circle,#FFB03A,#FF6B4A)" }} />
      <div className="pointer-events-none absolute -bottom-28 -left-24 h-72 w-72 rounded-full opacity-40 blur-3xl" style={{ background: "radial-gradient(circle,#9B6BFF,#5646E5)" }} />

      <div className="relative z-10 mx-auto max-w-2xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <Link href={`/nuevo/gestionar/${id}/terminar`} className="flex items-center gap-2 text-sm font-semibold text-[#5646E5] hover:underline">← Volver</Link>
          <span className="rounded-full border border-slate-200 bg-white/70 px-3 py-1.5 text-xs text-slate-500">Alertas</span>
        </div>

        <h1 className="text-balance text-4xl font-extrabold leading-none tracking-tight">Alertas y recordatorios</h1>
        <p className="mt-3 text-lg text-slate-500">
          Activa los avisos automáticos para no quedarte sin plazo ni sin pagos.
        </p>

        <section className="mt-6 rounded-3xl border-2 border-slate-200 bg-white/90 p-5 shadow-sm text-sm text-slate-700">
          <h2 className="text-sm font-bold text-slate-900">Qué alertas envía ArriendoSeguro</h2>
          <ul className="mt-3 space-y-2.5">
            <li className="flex gap-2">
              <span aria-hidden="true">⏰</span>
              <span><strong>Terminación / renovación:</strong> avisos antes del fin del contrato (respetando el preaviso de 3 meses), a ambas partes. Se activa aquí abajo.</span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden="true">🔔</span>
              <span>
                <strong>Recordatorios de pago:</strong> al inquilino, los días que elijas y el día del vencimiento, con tu método de pago.{" "}
                <Link href={`/dashboard/contracts/${id}/pagos-recordatorios`} className="font-semibold text-[#5646E5] underline">Configurar pagos</Link>.
              </span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden="true">✅</span>
              <span><strong>Escalamiento:</strong> si el inquilino sube un soporte y no lo confirmas en unos días, se lo recordamos a ambas partes. (Automático.)</span>
            </li>
          </ul>
        </section>

        <div className="mt-4">
          <RenewalReminderCard contractId={id} />
        </div>

        <div className="mt-6 flex items-center justify-between gap-2">
          <Link href={`/nuevo/gestionar/${id}/terminar`} className="rounded-2xl border-2 border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-600 transition hover:border-[#5646E5] hover:text-[#5646E5]">← Atrás</Link>
          <Link href={`/nuevo/gestionar/${id}/terminar`} className="rounded-2xl bg-[#12B886] px-7 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition hover:brightness-105 active:scale-95">Listo, continuar →</Link>
        </div>
      </div>
    </div>
  );
}
