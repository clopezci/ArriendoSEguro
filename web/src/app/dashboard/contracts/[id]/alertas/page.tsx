"use client";

import { ExpedientePostWizardNav } from "@/components/contracts/expediente-post-wizard-nav";
import { RenewalReminderCard } from "@/components/contracts/renewal-reminder-card";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function AlertasContratoPage() {
  const id = String(useParams<{ id: string }>().id);

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6 text-slate-900">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-violet-700">Alertas</p>
        <h1 className="text-2xl font-bold">Recordatorios del arriendo</h1>
        <p className="text-sm text-slate-600">
          Configura los avisos automáticos de terminación o renovación del contrato.
        </p>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link href={`/dashboard/contracts/${id}/pagos-recordatorios`} className="text-violet-700 underline">
            Pagos y recordatorios
          </Link>
          <span className="text-slate-400">·</span>
          <Link href={`/dashboard/contracts/${id}/novedades`} className="text-violet-700 underline">
            Novedades del arriendo
          </Link>
        </div>
      </header>

      <ExpedientePostWizardNav contractId={id} />

      <section className="rounded-xl border border-violet-200 bg-violet-50/40 p-4 text-sm text-slate-700">
        <h2 className="text-sm font-bold text-slate-900">Qué alertas envía ArriendoSeguro</h2>
        <ul className="mt-2 space-y-1.5">
          <li>
            <strong>Terminación / renovación:</strong> avisos antes del fin del contrato (respetando el preaviso de 3
            meses), a ambas partes. Se activa/desactiva aquí abajo.
          </li>
          <li>
            <strong>Recordatorios de pago:</strong> al inquilino, los días de anticipación que elijas y el día del
            vencimiento, con tu método de pago y un enlace para subir su soporte.{" "}
            <Link href={`/dashboard/contracts/${id}/pagos-recordatorios`} className="font-semibold text-violet-700 underline">
              Configurar pagos
            </Link>
            .
          </li>
          <li>
            <strong>Escalamiento:</strong> si el inquilino sube un soporte y no lo confirmas en unos días, te lo
            recordamos a ambas partes. (Automático, sin configuración.)
          </li>
        </ul>
      </section>

      <RenewalReminderCard contractId={id} />
    </main>
  );
}
