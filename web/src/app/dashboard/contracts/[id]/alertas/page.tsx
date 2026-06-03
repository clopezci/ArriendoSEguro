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
          <Link href={`/dashboard/contracts/${id}/payment-schedule`} className="text-violet-700 underline">
            Recordatorios de pago
          </Link>
          <span className="text-slate-400">·</span>
          <Link href={`/dashboard/contracts/${id}/novedades`} className="text-violet-700 underline">
            Novedades del arriendo
          </Link>
        </div>
      </header>

      <ExpedientePostWizardNav contractId={id} />

      <RenewalReminderCard contractId={id} />
    </main>
  );
}
