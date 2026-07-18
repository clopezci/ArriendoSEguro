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
    <main className="mx-auto max-w-3xl space-y-6 text-[#17151F]">
      <header className="space-y-2">
        <span className="inline-flex items-center gap-2 rounded-full bg-[#ECE9FB] px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#5646E5]">Paso 4 de 5 · Firma</span>
        <h1 className="text-balance text-3xl font-black tracking-tight sm:text-4xl">Firma de las partes</h1>
        <p className="text-slate-500">
          Con el <strong>plan de introducción</strong> (primer contrato <strong>$49.900</strong>), la{" "}
          <strong>firma electrónica está incluida</strong> (Ley 527: firma con evidencia). Y tu{" "}
          <strong>segundo contrato puede ser gratis</strong> si invitas a 3 personas que usen la app.
        </p>
        <div className="pt-1">
          <WizardSteps5 id={id} active="firma" />
        </div>
      </header>

      <RequiresSavedContract id={id}>
        <div className="grid gap-4">
          {/* Opción A — gratis por 3 invitaciones (recomendada) */}
          <section className="rounded-3xl border-2 border-[#12B886] bg-[#12B886]/[0.06] p-6 shadow-[0_10px_30px_rgba(18,184,134,0.14)]">
            <div className="flex items-start gap-4">
              <span className="grid h-12 w-12 flex-none place-items-center rounded-2xl bg-[#12B886]/15 text-2xl">🎁</span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#12B886] px-2.5 py-0.5 text-[11px] font-bold text-white">GRATIS · RECOMENDADO</span>
                  <h2 className="text-lg font-black text-[#0B6E4E]">Tu segundo contrato gratis: invita a 3 que usen la app</h2>
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  Comparte ArriendoSeguro. Cuando <strong>3 personas invitadas usen la aplicación</strong> (creen su
                  contrato), tu <strong>siguiente contrato queda gratis con la firma incluida</strong>. Es nuestra forma de
                  crecer contigo.
                </p>
                <Link href={`/dashboard/plans?contract=${encodeURIComponent(id)}`} className="mt-4 inline-flex rounded-2xl bg-[#12B886] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition hover:brightness-105 active:scale-95">
                  Invitar y conseguirlo gratis →
                </Link>
              </div>
            </div>
          </section>

          {/* Opción B — micropago */}
          <section className="rounded-3xl border-2 border-slate-200 bg-white/95 p-6 shadow-[0_10px_30px_rgba(86,70,229,0.10)]">
            <div className="flex items-start gap-4">
              <span className="grid h-12 w-12 flex-none place-items-center rounded-2xl bg-[#ECE9FB] text-2xl">⚡</span>
              <div className="min-w-0">
                <h2 className="text-lg font-black">Firma al instante por $10.000</h2>
                <p className="mt-2 text-sm text-slate-600">
                  ¿Necesitas firmar ya? Actívala con un <strong>pago único de $10.000</strong> para este contrato, sin
                  suscripción.
                </p>
                <Link href={`/dashboard/plans?intent=firma-unica&contract=${encodeURIComponent(id)}`} className="mt-4 inline-flex rounded-2xl bg-[#5646E5] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition hover:brightness-105 active:scale-95">
                  Pagar y firmar →
                </Link>
                <p className="mt-2 text-[11px] text-slate-400">
                  El pago se procesa por una pasarela segura. Útil si solo quieres la firma de este contrato sin el plan completo.
                </p>
              </div>
            </div>
          </section>

          {/* Opción C — Plus */}
          <section className="rounded-3xl border-2 border-slate-200 bg-white/95 p-6 shadow-[0_10px_30px_rgba(86,70,229,0.10)]">
            <div className="flex items-start gap-4">
              <span className="grid h-12 w-12 flex-none place-items-center rounded-2xl bg-[#FFEDE7] text-2xl">⭐</span>
              <div className="min-w-0">
                <h2 className="text-lg font-black">Plan de introducción — primer contrato $49.900</h2>
                <p className="mt-2 text-sm text-slate-600">
                  Un pago único por una <strong>fracción</strong> de lo que cuesta tu arriendo. Incluye la <strong>firma
                  electrónica</strong>, el <strong>inventario, el acta de entrega, la posventa, los recordatorios</strong> y
                  todo el respaldo de este contrato.
                </p>
                <Link href={`/dashboard/plans?contract=${encodeURIComponent(id)}`} className="mt-4 inline-flex rounded-2xl bg-[#FF6B4A] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-orange-500/25 transition hover:brightness-105 active:scale-95">
                  Ver el plan de introducción →
                </Link>
              </div>
            </div>
          </section>

          <div className="rounded-3xl border border-slate-200 bg-white/70 p-5 text-sm text-slate-600">
            <p>
              ¿Ya tienes la firma habilitada?{" "}
              <Link href={preview} className="font-bold text-[#5646E5] underline">
                Ir a firmar en la vista previa →
              </Link>
            </p>
            <p className="mt-1 text-[12px] text-slate-400">
              También desde la vista previa puedes <strong>descargar el PDF gratis</strong> antes de firmar.
            </p>
          </div>
        </div>
      </RequiresSavedContract>
    </main>
  );
}
