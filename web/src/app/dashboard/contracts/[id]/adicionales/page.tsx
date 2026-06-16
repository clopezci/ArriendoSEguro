"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ExpedientePostWizardNav } from "@/components/contracts/expediente-post-wizard-nav";
import { useSavedContract } from "@/components/contracts/requires-saved-contract";
import { JourneyProgress } from "@/components/contracts/journey-progress";

/**
 * Posventa del contrato (antes «Centro de adicionales»).
 *
 * Los datos del contrato (codeudor, garantía, cláusulas) ya se capturan en la
 * línea del asistente. Aquí solo vive la **posventa**, que requiere el contrato
 * ya guardado: método de pago, notaría y documentos. Mientras no haya versión
 * guardada, las tarjetas se muestran **bloqueadas** con un aviso claro.
 */
type PostsaleItem = {
  slug: string;
  title: string;
  description: string;
};

const POSTSALE_ITEMS: PostsaleItem[] = [
  {
    slug: "pagos-recordatorios",
    title: "Método de pago y recordatorios",
    description: "Comparte tu cuenta o QR (con tu autorización) para los recordatorios de pago al inquilino. Opcional.",
  },
  {
    slug: "notarial",
    title: "Autenticación notarial",
    description: "Constancia y carga del PDF autenticado en notaría (refuerzo a la firma).",
  },
  {
    slug: "documentos-propiedad",
    title: "Documentos de propiedad / poder",
    description: "Escritura, certificado de libertad o el poder autenticado si actúas como apoderado.",
  },
];

function UnlockedCard({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link
      href={href}
      className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-[0_6px_20px_rgba(139,92,246,0.12)] transition hover:border-violet-400 hover:shadow-[0_10px_28px_rgba(139,92,246,0.2)]"
    >
      <span className="text-sm font-bold text-violet-900">{title}</span>
      <span className="mt-2 flex-1 text-xs leading-relaxed text-slate-600">{description}</span>
      <span className="mt-3 text-xs font-semibold text-violet-700">Configurar →</span>
    </Link>
  );
}

function LockedCard({ title, description }: { title: string; description: string }) {
  return (
    <div
      aria-disabled="true"
      tabIndex={-1}
      title="Disponible cuando guardes tu contrato"
      className="flex h-full flex-col rounded-xl border border-slate-200 bg-slate-50 p-4 opacity-70"
    >
      <span className="flex items-center gap-1.5 text-sm font-bold text-slate-600">
        <span aria-label="Bloqueado" role="img">
          🔒
        </span>
        {title}
      </span>
      <span className="mt-2 flex-1 text-xs leading-relaxed text-slate-500">{description}</span>
      <span className="mt-3 text-xs font-semibold text-amber-700">Disponible al guardar tu contrato</span>
    </div>
  );
}

export default function PosventaHubPage() {
  const id = String(useParams<{ id: string }>().id);
  const sc = useSavedContract(id);
  const saved = sc.status === "saved";
  // En "error" no penalizamos: dejamos las tarjetas activas (criterio tolerante).
  const unlocked = saved || sc.status === "error";

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-violet-700">Posventa</p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Posventa del contrato</h1>
        <p className="max-w-2xl text-sm text-slate-600">
          Lo que vives <strong>durante el arriendo</strong>: método de pago y recordatorios, autenticación notarial y
          documentos de respaldo. Se habilita cuando guardas tu contrato.
        </p>
        <div className="pt-1">
          <JourneyProgress id={id} activePhase="posventa" />
        </div>
      </header>

      <ExpedientePostWizardNav contractId={id} />

      {!saved && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
          Esta sección se habilita cuando <strong>guardes tu contrato</strong> en la vista previa.{" "}
          <Link href={`/dashboard/contracts/${id}/preview`} className="font-semibold underline">
            Termina y guarda tu contrato →
          </Link>
        </div>
      )}

      <section className="space-y-3">
        <ul className="grid gap-3 sm:grid-cols-2">
          {POSTSALE_ITEMS.map((item) => (
            <li key={item.slug}>
              {unlocked ? (
                <UnlockedCard
                  href={`/dashboard/contracts/${id}/${item.slug}`}
                  title={item.title}
                  description={item.description}
                />
              ) : (
                <LockedCard title={item.title} description={item.description} />
              )}
            </li>
          ))}
        </ul>
      </section>

      <div>
        <Link
          href={`/dashboard/contracts/${id}/preview`}
          className="text-sm text-violet-700 underline hover:text-violet-900"
        >
          ← Volver a la vista previa
        </Link>
      </div>
    </main>
  );
}
