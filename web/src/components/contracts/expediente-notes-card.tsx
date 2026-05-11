"use client";

/**
 * Editor de "anotaciones especiales del expediente". Estas notas se guardan
 * únicamente en el draft local del wizard y se muestran a las partes dentro
 * de la app (resumen, vista previa). **No se imprimen** en el contrato: el
 * helper `toContractInput()` no las propaga al renderer y la plantilla no
 * tiene placeholder asociado.
 *
 * El componente está pensado para que cualquier paso del wizard pueda
 * editarlas. Por eso recibe el `draftId` y se sincroniza con el state global
 * vía `setExpedienteNotes`.
 */

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import {
  EXPEDIENTE_NOTES_MAX_LENGTH,
  setExpedienteNotes,
} from "@/features/contracts/wizard-state";

export type ExpedienteNotesVariant = "panel" | "banner";

interface Props {
  draftId: string;
  initialNotes: string;
  /**
   * `panel`: card grande dentro de un paso del wizard (resumen).
   * `banner`: bloque compacto pensado para colocar sobre la vista previa,
   *  reforzando que las anotaciones nunca se imprimen.
   */
  variant?: ExpedienteNotesVariant;
  /** Callback opcional para que el contenedor sepa cuándo cambió el draft. */
  onSaved?: (notes: string) => void;
}

const EXAMPLE_PLACEHOLDER = [
  "Ejemplos útiles que puedes registrar aquí (no salen impresos en el contrato):",
  "• Fechas de corte de servicios públicos y forma de liquidar la primera factura.",
  "• Acuerdos verbales sobre revisión del inmueble después de la entrega.",
  "• Recordatorios internos para arrendador, arrendatario o codeudor.",
].join("\n");

export function ExpedienteNotesCard({
  draftId,
  initialNotes,
  variant = "panel",
  onSaved,
}: Props) {
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const textareaId = useId();
  const helpId = useId();

  useEffect(() => {
    setNotes(initialNotes ?? "");
    setStatus("idle");
    setErrorMsg("");
  }, [initialNotes]);

  const remaining = useMemo(
    () => EXPEDIENTE_NOTES_MAX_LENGTH - notes.length,
    [notes.length],
  );
  const dirty = notes !== (initialNotes ?? "");

  const handleSave = useCallback(() => {
    setStatus("saving");
    setErrorMsg("");
    const result = setExpedienteNotes(draftId, notes);
    if (!result) {
      setStatus("error");
      setErrorMsg(
        "No pudimos guardar las anotaciones. Refresca la página e inténtalo de nuevo.",
      );
      return;
    }
    setStatus("saved");
    onSaved?.(result.expedienteNotes ?? "");
  }, [draftId, notes, onSaved]);

  const wrapperClass =
    variant === "banner"
      ? "rounded-xl border border-amber-500/50 bg-amber-950/30 p-4"
      : "rounded-xl border border-slate-700 bg-slate-900/70 p-4 sm:p-5";

  const titleClass =
    variant === "banner"
      ? "text-sm font-semibold text-amber-200"
      : "text-sm font-semibold text-violet-300 sm:text-base";

  return (
    <section className={wrapperClass} aria-labelledby={`${helpId}-title`}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 id={`${helpId}-title`} className={titleClass}>
            Anotaciones especiales del expediente
          </h3>
          <p
            id={helpId}
            className={
              variant === "banner"
                ? "mt-1 text-xs text-amber-100/90"
                : "mt-1 text-xs text-slate-400"
            }
          >
            Estas anotaciones son visibles únicamente dentro de la app, para
            ambas partes y el equipo de soporte. <strong>No se imprimen</strong>{" "}
            en el contrato ni se incluyen en el PDF firmado.
          </p>
        </div>
        <span
          className={
            variant === "banner"
              ? "rounded-full bg-amber-200/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-200"
              : "rounded-full bg-violet-500/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-violet-200"
          }
        >
          No se imprime
        </span>
      </header>

      <textarea
        id={textareaId}
        aria-describedby={helpId}
        className="mt-3 min-h-[140px] w-full rounded-lg border border-slate-700 bg-slate-950/70 p-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-400"
        value={notes}
        maxLength={EXPEDIENTE_NOTES_MAX_LENGTH}
        placeholder={EXAMPLE_PLACEHOLDER}
        onChange={(e) => {
          setNotes(e.target.value);
          if (status === "saved") setStatus("idle");
        }}
        rows={variant === "banner" ? 4 : 6}
      />

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
        <span>
          {notes.length}/{EXPEDIENTE_NOTES_MAX_LENGTH} caracteres
          {remaining < 100 ? (
            <span className="ml-2 text-amber-300">
              Te quedan {remaining} caracteres.
            </span>
          ) : null}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {status === "saved" && (
            <span className="text-emerald-300">Anotaciones guardadas.</span>
          )}
          {status === "error" && errorMsg && (
            <span className="text-rose-300">{errorMsg}</span>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty || status === "saving"}
            className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
          >
            {status === "saving" ? "Guardando…" : "Guardar anotaciones"}
          </button>
        </div>
      </div>
    </section>
  );
}
