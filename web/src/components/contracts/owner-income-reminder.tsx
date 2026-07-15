"use client";

/**
 * Aviso al DUEÑO con los ingresos DECLARADOS por el inquilino y el codeudor,
 * recordándole VALIDAR que estén soportados y que alcancen para cubrir el canon.
 * No bloquea: es un recordatorio de diligencia (la solvencia final la juzga el
 * dueño con los documentos). Se muestra cuando ya hay ingresos capturados.
 */
const money = (n: number) => `$${Math.round(n || 0).toLocaleString("es-CO")}`;

type Row = { who: string; income: number };

export function OwnerIncomeReminder({ rentReference, rows }: { rentReference: number; rows: Row[] }) {
  const present = rows.filter((r) => r.income > 0);
  if (present.length === 0) return null;

  return (
    <div className="rounded-2xl border-2 border-amber-200 bg-amber-50/70 p-4 text-sm text-slate-700">
      <p className="font-semibold text-amber-900">💡 Verifica los ingresos declarados</p>
      <p className="mt-0.5 text-xs text-slate-600">
        {rentReference > 0 ? <>Canon a cubrir: <b>{money(rentReference)}</b>. </> : null}
        Confirma con los documentos que estos ingresos <b>estén soportados</b> y que alcancen para pagar el arriendo (se sugiere ≥ 2× el canon).
      </p>
      <ul className="mt-2 space-y-1.5">
        {present.map((r, i) => {
          const below = rentReference > 0 && r.income < rentReference;
          const belowSuggested = rentReference > 0 && r.income >= rentReference && r.income < rentReference * 2;
          return (
            <li key={i} className={`rounded-lg border px-3 py-2 text-xs ${below ? "border-rose-300 bg-rose-50 text-rose-800" : belowSuggested ? "border-amber-300 bg-white text-amber-900" : "border-emerald-300 bg-emerald-50 text-emerald-800"}`}>
              <b>{r.who}:</b> ingreso declarado <b>{money(r.income)}</b>
              {below ? " — ⛔ es INFERIOR al canon; valida el soporte antes de continuar." : belowSuggested ? " — ⚠️ por debajo de lo sugerido (2×); revisa el soporte." : " — ✓ cumple lo sugerido; confírmalo con los documentos."}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
