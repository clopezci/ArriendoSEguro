"use client";

/**
 * Selector de calificación por estrellas (1–5). Accesible: radios reales con
 * etiquetas ocultas. En modo `readOnly` solo muestra el valor.
 */
export function StarRating({
  name,
  value,
  onChange,
  readOnly = false,
}: {
  name: string;
  value: number;
  onChange?: (v: number) => void;
  readOnly?: boolean;
}) {
  const stars = [1, 2, 3, 4, 5];
  return (
    <div className="inline-flex items-center gap-1" role={readOnly ? "img" : "radiogroup"} aria-label={`Calificación de ${name}`}>
      {stars.map((s) => {
        const active = s <= value;
        if (readOnly) {
          return (
            <span key={s} aria-hidden className={active ? "text-amber-500" : "text-slate-300"}>
              ★
            </span>
          );
        }
        return (
          <label key={s} className="cursor-pointer text-xl leading-none">
            <input
              type="radio"
              name={name}
              value={s}
              checked={value === s}
              onChange={() => onChange?.(s)}
              className="sr-only"
            />
            <span
              className={active ? "text-amber-500 hover:text-amber-600" : "text-slate-300 hover:text-amber-400"}
              title={`${s} de 5`}
            >
              ★
            </span>
          </label>
        );
      })}
      {readOnly && <span className="ml-1 text-xs text-slate-500">{value ? value.toFixed(1) : "—"}</span>}
    </div>
  );
}
