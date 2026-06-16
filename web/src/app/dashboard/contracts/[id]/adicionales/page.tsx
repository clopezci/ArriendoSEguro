"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ExpedientePostWizardNav } from "@/components/contracts/expediente-post-wizard-nav";
import { useSavedContract } from "@/components/contracts/requires-saved-contract";
import { JourneyProgress } from "@/components/contracts/journey-progress";
import { getDraft } from "@/features/contracts/wizard-state";

/**
 * Centro de adicionales (Bloque 2).
 *
 * Separa lo que se hace **antes de firmar** (datos que enriquecen el contrato)
 * de la **posventa** (que requiere el contrato ya guardado). Mientras no haya
 * versión guardada, las tarjetas de posventa se muestran **bloqueadas** con un
 * aviso claro, en vez de dejar entrar a pantallas que saldrían rotas.
 */
type AdicionalItem = {
  slug: string;
  title: string;
  description: string;
};

const CREATION_ITEMS: AdicionalItem[] = [
  {
    slug: "codebtor",
    title: "Codeudores",
    description: "Agrega uno o varios codeudores solidarios con sus datos y consentimientos.",
  },
  {
    slug: "utilities",
    title: "Garantía de servicios públicos (Art. 15)",
    description: "Única garantía permitida; su valor no excede dos períodos de facturación. Opcional.",
  },
  {
    slug: "special-clauses",
    title: "Cláusulas especiales",
    description: "Mascotas, parqueadero, mobiliario, teletrabajo y otras condiciones pactadas.",
  },
];

/**
 * Evento del `auditTrail` del borrador que indica que el sub-bloque YA se
 * diligenció en el asistente (Bloque 1). Si existe, mostramos la tarjeta como
 * "completado" con la acción "Ajustar"; si no, como "falta" con "Configurar".
 */
const CREATION_DONE_EVENT: Record<string, string> = {
  codebtor: "codebtor_option_selected",
  utilities: "utilities_saved",
  "special-clauses": "special_clauses_updated",
};

const POSTSALE_ITEMS: AdicionalItem[] = [
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

function UnlockedCard({
  href,
  title,
  description,
  status,
}: {
  href: string;
  title: string;
  description: string;
  /** Estado del sub-bloque respecto al Bloque 1 (solo para los de creación). */
  status?: "done" | "todo";
}) {
  const action = status === "done" ? "Ajustar →" : "Configurar →";
  return (
    <Link
      href={href}
      className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-[0_6px_20px_rgba(139,92,246,0.12)] transition hover:border-violet-400 hover:shadow-[0_10px_28px_rgba(139,92,246,0.2)]"
    >
      <span className="flex items-start justify-between gap-2">
        <span className="text-sm font-bold text-violet-900">{title}</span>
        {status === "done" && (
          <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
            ✓ Completado
          </span>
        )}
        {status === "todo" && (
          <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
            Falta
          </span>
        )}
      </span>
      <span className="mt-2 flex-1 text-xs leading-relaxed text-slate-600">{description}</span>
      <span className="mt-3 text-xs font-semibold text-violet-700">{action}</span>
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

export default function AdicionalesHubPage() {
  const id = String(useParams<{ id: string }>().id);
  const sc = useSavedContract(id);
  const saved = sc.status === "saved";
  // En "error" no penalizamos: dejamos las tarjetas activas (criterio tolerante).
  const postsaleUnlocked = saved || sc.status === "error";

  // Qué sub-bloques de creación ya se diligenciaron en el asistente (Bloque 1).
  // Se lee del `auditTrail` del borrador en localStorage (en efecto, para evitar
  // desajustes de hidratación).
  const [doneEvents, setDoneEvents] = useState<Set<string>>(new Set());
  useEffect(() => {
    const draft = getDraft(id);
    setDoneEvents(new Set((draft?.auditTrail ?? []).map((e) => e.event)));
  }, [id]);

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-violet-700">Bloque 2</p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Centro de adicionales</h1>
        <p className="max-w-2xl text-sm text-slate-600">
          Lo esencial para tu contrato ya lo capturaste en el asistente. Aquí lo enriqueces a tu medida y, una vez
          guardado, habilitas la posventa.
        </p>
        <div className="pt-1">
          <JourneyProgress id={id} activePhase="robustecer" />
        </div>
      </header>

      <ExpedientePostWizardNav contractId={id} />

      {!saved && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
          La sección de <strong>posventa</strong> (método de pago, notaría, documentos) se habilita cuando{" "}
          <strong>guardes tu contrato</strong> en la vista previa.{" "}
          <Link href={`/dashboard/contracts/${id}/preview`} className="font-semibold underline">
            Termina y guarda tu contrato →
          </Link>
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-slate-900">Para tu contrato (antes de firmar)</h2>
        <p className="text-xs text-slate-600">
          Si ya los diligenciaste en el asistente, aparecen <strong>✓ Completado</strong> y puedes solo ajustarlos.
        </p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {CREATION_ITEMS.map((item) => (
            <li key={item.slug}>
              <UnlockedCard
                href={`/dashboard/contracts/${id}/${item.slug}`}
                title={item.title}
                description={item.description}
                status={doneEvents.has(CREATION_DONE_EVENT[item.slug] ?? "") ? "done" : "todo"}
              />
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-slate-900">Después de guardar / firmar (posventa)</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {POSTSALE_ITEMS.map((item) => (
            <li key={item.slug}>
              {postsaleUnlocked ? (
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

      <div className="flex flex-wrap gap-3">
        <Link
          href={`/dashboard/contracts/${id}/review`}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-800 hover:border-violet-500"
        >
          ← Volver al resumen
        </Link>
        <Link
          href={`/dashboard/contracts/${id}/preview`}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white"
        >
          Ir a generar / firmar
        </Link>
      </div>
    </main>
  );
}
