"use client";

import { useEffect, useMemo, useState } from "react";
import { ContactModal, type Partner } from "@/components/partners/partners-directory";

/** Días de mora a partir de los cuales se sugiere el aliado de cobranza. */
const COLLECTION_SUGGEST_DAYS = 10;

type ScheduledLike = { id: string; periodLabel: string; dueDate: string; status: string };

/** Máximo de días de mora entre los pagos vencidos y sin pagar. */
function maxDaysLate(scheduled: ScheduledLike[]): number {
  const today = Date.now();
  let max = 0;
  for (const p of scheduled) {
    if (p.status !== "late") continue;
    const d = Math.floor((today - new Date(p.dueDate).getTime()) / 86_400_000);
    if (d > max) max = d;
  }
  return max;
}

/**
 * Tarjeta contextual (bento) que le sugiere al DUEÑO un aliado de cobranza
 * cuando un pago lleva mucha mora (≥10 días) y ya se agotaron los recordatorios
 * automáticos. Solo aparece si hay un aliado de categoría "cobranza" activo; de
 * lo contrario no se muestra (no dejamos una tarjeta sin acción). El clic abre
 * el mismo handoff con consentimiento del directorio de aliados (los datos se
 * envían al aliado, que es un tercero habilitado).
 */
export function CollectionAllyCard({
  scheduledPayments,
  userEmail,
}: {
  scheduledPayments: ScheduledLike[];
  userEmail: string;
}) {
  const [cobranzaPartner, setCobranzaPartner] = useState<Partner | null>(null);
  const [open, setOpen] = useState(false);

  const daysLate = useMemo(() => maxDaysLate(scheduledPayments), [scheduledPayments]);
  const shouldSuggest = daysLate >= COLLECTION_SUGGEST_DAYS;

  useEffect(() => {
    if (!shouldSuggest) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/partners/active", { cache: "no-store" });
        const j = (await res.json()) as { success?: boolean; partners?: Partner[] };
        const partner = (j.partners ?? []).find((p) => p.category === "cobranza") ?? null;
        if (!cancelled) setCobranzaPartner(partner);
      } catch {
        if (!cancelled) setCobranzaPartner(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shouldSuggest]);

  // No hay mora suficiente o no hay aliado de cobranza activo → no mostrar nada.
  if (!shouldSuggest || !cobranzaPartner) return null;

  return (
    <section className="mt-4 rounded-2xl border-2 border-amber-300 bg-amber-50/70 p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-amber-100 text-xl">📮</span>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700">Cobranza · aliado</p>
          <h3 className="text-[15px] font-bold tracking-tight text-[#17151F]">
            Un pago lleva {daysLate} días de mora
          </h3>
          <p className="mt-1 text-sm text-amber-900/90">
            Ya enviamos los recordatorios automáticos. Si quieres, un <strong>aliado de cobranza</strong> (
            {cobranzaPartner.name}) puede gestionar la recuperación de tu dinero por una comisión que acuerdas
            directamente con él. Con un clic le compartimos tus datos para que te contacte.
          </p>
        </div>
      </div>
      <div className="mt-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-2xl bg-[#FF6B4A] px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-orange-500/30 transition hover:brightness-105 active:scale-95"
        >
          Quiero ayuda para cobrar
        </button>
      </div>
      <p className="mt-2 text-[11px] text-amber-800/80">
        El servicio lo presta y cobra el aliado (un tercero). ArriendoSeguro solo te conecta y no recauda tu dinero.
      </p>
      {open && (
        <ContactModal
          partner={cobranzaPartner}
          userEmail={userEmail}
          defaultMessage={`Tengo un pago de arriendo con ${daysLate} días de mora y quiero gestionar la cobranza.`}
          onClose={() => setOpen(false)}
        />
      )}
    </section>
  );
}
