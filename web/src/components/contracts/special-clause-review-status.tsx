"use client";

import { flushDraftToServer } from "@/features/contracts/draft-server-sync";
import { getDraft, setSpecialClauses } from "@/features/contracts/wizard-state";
import { useEffect, useState } from "react";

type StatusResp = {
  success?: boolean;
  hasReview?: boolean;
  status?: "pending" | "drafted" | "declined" | null;
  finalText?: string;
};

/**
 * Semáforo de la revisión jurídica de la cláusula «Otra» para el dueño.
 * - "pending": rojo/espera → el abogado aún no redacta la versión final.
 * - "drafted": verde → la cláusula final ya quedó y se incorporó al contrato.
 * Cuando llega "drafted", mergeamos `finalText` al borrador local (y lo
 * sincronizamos al servidor) para que la versión del abogado rija en el PDF,
 * tal como se auto-actualizan los datos de las contrapartes invitadas.
 */
export function SpecialClauseReviewStatus({ contractId }: { contractId: string }) {
  const [state, setState] = useState<StatusResp | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/contracts/special-clause?contractDraftId=${encodeURIComponent(contractId)}`);
        const j = (await res.json()) as StatusResp;
        if (cancelled || !res.ok || !j.success || !j.hasReview) return;
        setState(j);

        // Auto-actualización: si el abogado ya redactó y el borrador local no lo
        // tiene, lo incorporamos y lo persistimos.
        if (j.status === "drafted" && (j.finalText ?? "").trim().length > 0) {
          const draft = getDraft(contractId);
          const sc = draft?.specialClauses;
          if (sc && (sc.finalText ?? "") !== j.finalText) {
            const updated = setSpecialClauses(contractId, {
              ...sc,
              reviewStatus: "drafted",
              finalText: j.finalText,
            });
            if (updated) void flushDraftToServer(updated).catch(() => {});
          }
        }
      } catch {
        /* sin estado: no mostramos nada */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [contractId]);

  if (!state?.hasReview) return null;

  if (state.status === "drafted") {
    return (
      <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-800">
        <p className="font-bold">✅ Cláusula especial revisada</p>
        <p className="mt-1">
          El equipo jurídico registró la redacción final de tu cláusula «Otra» y quedó incorporada al contrato.
        </p>
      </div>
    );
  }

  if (state.status === "declined") {
    return (
      <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-bold">⚠️ Cláusula especial revisada</p>
        <p className="mt-1">
          El equipo jurídico indicó que la cláusula propuesta no procede tal como está. Te contactará por tus datos
          para ajustarla. Mientras tanto, el contrato usa el texto que registraste.
        </p>
      </div>
    );
  }

  // pending
  return (
    <div className="rounded-2xl border-2 border-rose-300 bg-rose-50 p-4 text-sm text-rose-800">
      <p className="flex items-center gap-2 font-bold">
        <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-rose-500" aria-hidden="true" />
        Cláusula especial en revisión por el abogado
      </p>
      <p className="mt-1">
        Puedes continuar con tu contrato. La redacción <strong>final</strong> de la cláusula «Otra» la está preparando
        nuestro equipo jurídico y se <strong>actualizará automáticamente</strong> en el contrato cuando esté lista.
        Hasta entonces rige el texto que escribiste.
      </p>
    </div>
  );
}
