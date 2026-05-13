"use client";

/**
 * Editor de "anotaciones especiales del expediente". Estas notas se guardan
 * en el draft, se muestran a las partes dentro de la app y **sí se imprimen**
 * al final del contrato como sección "Observaciones y acuerdos
 * complementarios", con disclaimer legal explícito de que su validez está
 * sujeta a la normatividad colombiana aplicable y no sustituyen las
 * cláusulas anteriores.
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
  "Ejemplos útiles que puedes registrar aquí (estas anotaciones se imprimen en el contrato como acuerdos complementarios):",
  "• Fechas de corte de servicios públicos y forma de liquidar la primera factura.",
  "• Acuerdos puntuales sobre revisión del inmueble después de la entrega.",
  "• Otras condiciones especiales que las partes quieran dejar formalizadas.",
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

  // Re-sincronizar SOLO cuando `initialNotes` cambia "desde afuera". Si el
  // padre vuelve a re-renderizar con el mismo valor que acabamos de guardar
  // (caso típico: tras `handleSave` el draft global se reescribe y el padre
  // pasa el nuevo `initialNotes`), no debemos pisar el `status="saved"` que
  // muestra el mensaje "Anotaciones guardadas." al usuario.
  useEffect(() => {
    if ((initialNotes ?? "") === notes) return;
    setNotes(initialNotes ?? "");
    setStatus("idle");
    setErrorMsg("");
    // `notes` se lee del closure deliberadamente; no la incluimos en deps
    // para evitar bucle al editar el textarea.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialNotes]);

  // Ocultar el mensaje "Anotaciones guardadas." a los 3 s para que la UI
  // no quede con un texto residual cuando el usuario sigue navegando.
  useEffect(() => {
    if (status !== "saved") return;
    const t = window.setTimeout(() => setStatus("idle"), 3000);
    return () => window.clearTimeout(t);
  }, [status]);

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
      ? "rounded-xl border border-amber-300 bg-amber-50 p-4"
      : "rounded-xl border border-slate-300 bg-white/95 p-4 sm:p-5";

  const titleClass =
    variant === "banner"
      ? "text-sm font-semibold text-amber-800"
      : "text-sm font-semibold text-violet-700 sm:text-base";

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
                ? "mt-1 text-xs text-amber-800"
                : "mt-1 text-xs text-slate-600"
            }
          >
            Estas anotaciones <strong>sí se imprimen</strong> al final del
            contrato como sección «Observaciones y acuerdos complementarios»
            con disclaimer legal: reflejan la voluntad de las partes y no
            sustituyen las cláusulas ni la normatividad aplicable.
          </p>
        </div>
        <span
          className={
            variant === "banner"
              ? "rounded-full bg-emerald-100/60 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700"
              : "rounded-full bg-emerald-100/70 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700"
          }
        >
          Sale en el contrato
        </span>
      </header>

      <textarea
        id={textareaId}
        aria-describedby={helpId}
        className="mt-3 min-h-[140px] w-full rounded-lg border border-slate-300 bg-slate-100/80 p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-400"
        value={notes}
        maxLength={EXPEDIENTE_NOTES_MAX_LENGTH}
        placeholder={EXAMPLE_PLACEHOLDER}
        onChange={(e) => {
          setNotes(e.target.value);
          if (status === "saved") setStatus("idle");
        }}
        rows={variant === "banner" ? 4 : 6}
      />

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
        <span>
          {notes.length}/{EXPEDIENTE_NOTES_MAX_LENGTH} caracteres
          {remaining < 100 ? (
            <span className="ml-2 text-amber-700">
              Te quedan {remaining} caracteres.
            </span>
          ) : null}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {status === "saved" && (
            <span className="text-emerald-700">Anotaciones guardadas.</span>
          )}
          {status === "error" && errorMsg && (
            <span className="text-rose-700">{errorMsg}</span>
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
