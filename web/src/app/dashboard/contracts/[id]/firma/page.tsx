"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { WizardSteps5 } from "@/components/contracts/wizard-steps5";
import { RequiresSavedContract } from "@/components/contracts/requires-saved-contract";

/**
 * Paso 4 · Firma — pantalla de decisión "al final de lo gratis".
 *
 * El contrato ya se puede generar y descargar gratis. Para firmarlo con respaldo,
 * se ofrecen 3 caminos (modelo de monetización): invitar a 3 personas (gratis),
 * micropago único, o Plan Plus. La ejecución de la firma vive en la vista previa.
 */
export default function FirmaOptionsPage() {
  const id = String(useParams<{ id: string }>().id);
  const preview = `/dashboard/contracts/${id}/preview`;

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6 text-slate-900">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-violet-700">Paso 4 de 5 · Firma</p>
        <h1 className="text-2xl font-bold tracking-tight">Firma de las partes</h1>
        <p className="text-sm text-slate-600">
          Tu contrato ya está listo y lo puedes <strong>descargar gratis</strong>. Para firmarlo con respaldo legal
          (Ley 527: firma con evidencia), elige el camino que prefieras.
        </p>
        <div className="pt-1">
          <WizardSteps5 id={id} active="firma" />
        </div>
      </header>

      <RequiresSavedContract id={id}>
        <div className="grid gap-4">
          {/* Opción A — gratis por 3 invitaciones (recomendada) */}
          <section className="rounded-2xl border border-emerald-300 bg-emerald-50/70 p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white">GRATIS</span>
              <h2 className="text-base font-bold text-emerald-950">Invita a 3 personas y firma sin costo</h2>
            </div>
            <p className="mt-2 text-sm text-emerald-900/90">
              Comparte ArriendoSeguro. Cuando <strong>3 personas invitadas usen la aplicación</strong>, se te activa la
              firma con respaldo, sin pagar nada. Es nuestra forma de crecer contigo.
            </p>
            <Link
              href="/dashboard/plans"
              className="mt-3 inline-flex rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
            >
              Invitar y activar gratis
            </Link>
          </section>

          {/* Opción B — micropago */}
          <section className="rounded-2xl border border-violet-300 bg-white p-5 shadow-sm">
            <h2 className="text-base font-bold text-slate-900">Firma al instante por $10.000</h2>
            <p className="mt-2 text-sm text-slate-700">
              ¿Necesitas firmar ya? Actívala con un <strong>pago único de $10.000</strong> para este contrato, sin
              suscripción.
            </p>
            <Link
              href="/dashboard/plans?intent=firma-unica"
              className="mt-3 inline-flex rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
            >
              Pagar y firmar
            </Link>
            <p className="mt-2 text-[11px] text-slate-500">
              La pasarela de pago se activa en breve; por ahora el equipo habilita el pago manualmente al elegir esta
              opción.
            </p>
          </section>

          {/* Opción C — Plus */}
          <section className="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm">
            <h2 className="text-base font-bold text-slate-900">Hazlo todo con Plan Plus</h2>
            <p className="mt-2 text-sm text-slate-700">
              Además de la firma, el Plan Plus habilita <strong>inventario, posventa, recordatorios y todo el
              respaldo</strong> por una fracción de lo que cuesta tu arriendo.
            </p>
            <Link
              href="/dashboard/plans"
              className="mt-3 inline-flex rounded-lg border border-violet-500 px-4 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-50"
            >
              Ver Plan Plus
            </Link>
          </section>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <p>
              ¿Ya tienes la firma habilitada?{" "}
              <Link href={preview} className="font-semibold text-violet-700 underline">
                Ir a firmar en la vista previa →
              </Link>
            </p>
            <p className="mt-1 text-[12px] text-slate-500">
              También desde la vista previa puedes <strong>descargar el PDF gratis</strong> antes de firmar.
            </p>
          </div>
        </div>
      </RequiresSavedContract>
    </main>
  );
}
