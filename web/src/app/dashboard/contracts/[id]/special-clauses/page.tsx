"use client";

import { StepNav, useDraftGuard } from "@/components/contracts/draft-tools";
import { WizardShell } from "@/components/contracts/wizard-shell";
import { flashSaved } from "@/components/contracts/save-flash";
import { setSpecialClauses } from "@/features/contracts/wizard-state";
import {
  SPECIAL_CLAUSES_COST_NOTICE,
  SPECIAL_CLAUSES_FREE_NOTICE,
  SPECIAL_CLAUSE_FREE_TEXT_MAX_LENGTH,
  SPECIAL_CLAUSE_OPTIONS,
  SPECIAL_CLAUSE_OTHER_ID,
} from "@/features/contracts/special-clauses";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export default function SpecialClausesStepPage() {
  const id = String(useParams<{ id: string }>().id);
  const { draft, state } = useDraftGuard(id);
  const { user } = useAuth();
  const router = useRouter();

  const initial = draft?.specialClauses ?? {
    enabled: false,
    selected: [] as string[],
    freeText: "",
    costNotified: false,
  };

  const [enabled, setEnabled] = useState<boolean>(initial.enabled);
  const [selectedIds, setSelectedIds] = useState<string[]>(initial.selected);
  const [freeText, setFreeText] = useState<string>(initial.freeText ?? "");
  const [errors, setErrors] = useState<string[]>([]);
  const [priceCop, setPriceCop] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/contracts/special-clause");
        const j = (await res.json()) as { success?: boolean; priceCop?: number };
        if (!cancelled && res.ok && j.success && typeof j.priceCop === "number") setPriceCop(j.priceCop);
      } catch {
        /* sin precio: mostramos el aviso genérico */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const otherSelected = useMemo(
    () => selectedIds.includes(SPECIAL_CLAUSE_OTHER_ID),
    [selectedIds],
  );

  const priceText = priceCop != null ? `$${priceCop.toLocaleString("es-CO")}` : null;

  if (state !== "ready" || !draft) {
    return <p className="text-sm text-slate-700">Cargando…</p>;
  }

  function toggleClause(clauseId: string) {
    setSelectedIds((prev) =>
      prev.includes(clauseId)
        ? prev.filter((x) => x !== clauseId)
        : [...prev, clauseId],
    );
  }

  function onSubmit(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    setErrors([]);

    if (!enabled) {
      setSpecialClauses(id, {
        enabled: false,
        selected: [],
        freeText: undefined,
        costNotified: true,
      });
      flashSaved(() => router.push(`/dashboard/contracts/${id}/review`));
      return;
    }

    const issues: string[] = [];
    if (selectedIds.length === 0) {
      issues.push(
        "Selecciona al menos una cláusula especial o desmarca la opción de incluirlas.",
      );
    }
    if (otherSelected) {
      const text = freeText.trim();
      if (text.length < 10) {
        issues.push(
          "Cuando marcas «Otra cláusula especial», describe la cláusula con al menos 10 caracteres.",
        );
      }
      if (text.length > SPECIAL_CLAUSE_FREE_TEXT_MAX_LENGTH) {
        issues.push(
          `La descripción de la cláusula libre no puede superar los ${SPECIAL_CLAUSE_FREE_TEXT_MAX_LENGTH} caracteres.`,
        );
      }
    }
    if (issues.length > 0) {
      setErrors(issues);
      return;
    }

    setSpecialClauses(id, {
      enabled: true,
      selected: selectedIds,
      freeText: otherSelected ? freeText.trim() : undefined,
      costNotified: true,
    });

    // Si eligió la cláusula libre «Otra», avisamos al aliado jurídico (best-effort,
    // no bloquea el flujo; el servidor evita duplicados por expediente).
    if (otherSelected && freeText.trim().length >= 10 && user) {
      void (async () => {
        try {
          await fetch("/api/contracts/special-clause", {
            method: "POST",
            headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
            body: JSON.stringify({ contractDraftId: id, clauseText: freeText.trim() }),
          });
        } catch {
          /* el aviso no es bloqueante */
        }
      })();
    }

    flashSaved(() => router.push(`/dashboard/contracts/${id}/review`));
  }

  const freeTextLength = freeText.length;

  return (
    <WizardShell
      title="Cláusulas especiales"
      currentStep={8}
      contractId={id}
      variant="wizard"
    >
      <p className="text-sm text-slate-700">
        Aquí puedes incluir <strong>cláusulas especiales</strong> para que
        queden expresamente acordadas (mascotas, parqueadero, fumadores,
        etc.). Si no necesitas ninguna, deja la opción en «No» y continúa.
      </p>

      <form id="wizard-form" className="mt-4 space-y-4" onSubmit={onSubmit}>
        <fieldset
          className="rounded-2xl border border-slate-200 bg-white/95 shadow-[0_6px_20px_rgba(86,70,229,0.06)]/95 p-4"
          aria-describedby="special-clauses-help"
        >
          <legend className="px-1 text-sm font-medium text-slate-800">
            ¿Quieres incluir cláusulas especiales en el contrato?
          </legend>
          <div className="mt-2 flex flex-wrap gap-3" role="radiogroup">
            <button
              type="button"
              role="radio"
              aria-checked={!enabled}
              onClick={() => setEnabled(false)}
              className={[
                "rounded-lg border px-4 py-2 text-sm font-medium transition",
                !enabled
                  ? "border-violet-500 bg-violet-100/70 text-violet-800"
                  : "border-slate-300 text-slate-800 hover:border-violet-500",
              ].join(" ")}
            >
              No, sin cláusulas especiales
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={enabled}
              onClick={() => setEnabled(true)}
              className={[
                "rounded-lg border px-4 py-2 text-sm font-medium transition",
                enabled
                  ? "border-violet-500 bg-violet-100/70 text-violet-800"
                  : "border-slate-300 text-slate-800 hover:border-violet-500",
              ].join(" ")}
            >
              Sí, quiero incluir cláusulas especiales
            </button>
          </div>
          <p id="special-clauses-help" className="mt-2 text-xs text-slate-600">
            Si eliges «No», pasamos directamente al resumen del contrato.
          </p>
        </fieldset>

        {enabled && (
          <>
            <div
              role="note"
              className="rounded-2xl border border-emerald-300 bg-emerald-100/60 p-4 text-sm text-emerald-800"
            >
              <p className="font-semibold">Cláusulas del catálogo — sin costo</p>
              <p className="mt-1">{SPECIAL_CLAUSES_FREE_NOTICE}</p>
            </div>

            <fieldset className="rounded-2xl border border-slate-200 bg-white/95 shadow-[0_6px_20px_rgba(86,70,229,0.06)]/95 p-4">
              <legend className="px-1 text-sm font-medium text-slate-800">
                Selecciona las cláusulas que aplican
              </legend>
              <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                {SPECIAL_CLAUSE_OPTIONS.map((option) => {
                  const checked = selectedIds.includes(option.id);
                  return (
                    <li key={option.id}>
                      <label
                        className={[
                          "flex h-full cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm transition",
                          checked
                            ? "border-violet-500 bg-violet-100/60 text-violet-800"
                            : "border-slate-300 bg-slate-100/60 text-slate-800 hover:border-violet-500",
                        ].join(" ")}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleClause(option.id)}
                          className="mt-1 h-4 w-4 accent-violet-500"
                        />
                        <span>
                          <span className="font-medium">{option.label}</span>
                          <span className="mt-0.5 block text-xs text-slate-700">
                            {option.description}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </fieldset>

            {otherSelected && (
              <div
                role="note"
                className="rounded-lg border-2 border-amber-400 bg-amber-100/70 p-4 text-sm text-amber-900"
              >
                <p className="text-base font-bold">
                  {priceText
                    ? `Cláusula «Otra»: cobro adicional de ${priceText}`
                    : "Cláusula «Otra»: tiene un cobro adicional"}
                </p>
                <p className="mt-1">{SPECIAL_CLAUSES_COST_NOTICE}</p>
                <p className="mt-1 text-xs">
                  Al guardar, tu cláusula queda registrada y su costo se suma al pago del Plan Plus cuando actives tu
                  contrato. Nuestro equipo jurídico la revisa antes de la firma.
                </p>
              </div>
            )}

            {otherSelected && (
              <label className="block">
                <span className="mb-1 block text-sm text-slate-800">
                  Describe la cláusula adicional
                </span>
                <textarea
                  value={freeText}
                  onChange={(e) => setFreeText(e.target.value)}
                  rows={5}
                  maxLength={SPECIAL_CLAUSE_FREE_TEXT_MAX_LENGTH}
                  placeholder="Ejemplo: el arrendatario (inquilino) se compromete a no realizar fiestas con música amplificada después de las 10:00 p. m. en respeto al reglamento de la propiedad horizontal."
                  className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400"
                />
                <span className="mt-1 flex justify-between text-xs text-slate-600">
                  <span>
                    Redacta con claridad lo que las partes quieren que quede en
                    el contrato. Evita expresiones agresivas o discriminatorias.
                  </span>
                  <span>
                    {freeTextLength}/{SPECIAL_CLAUSE_FREE_TEXT_MAX_LENGTH}
                  </span>
                </span>
              </label>
            )}
          </>
        )}

        {errors.length > 0 && (
          <div
            role="alert"
            className="rounded-2xl border border-rose-300 bg-rose-100/60 p-3 text-sm text-rose-800"
          >
            <p className="font-semibold">Revisa lo siguiente:</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {errors.map((msg, i) => (
                <li key={i}>{msg}</li>
              ))}
            </ul>
          </div>
        )}
      </form>

      <StepNav
        backHref={`/dashboard/contracts/${id}/utilities`}
        backLabel="Anterior"
        nextHref={`/dashboard/contracts/${id}/review`}
        nextLabel="Guardar y continuar"
      />
    </WizardShell>
  );
}
