"use client";

/**
 * Sugerencia de ingresos frente al canon.
 *
 * Práctica de inmobiliarias en Colombia: el arrendatario y el codeudor deberían
 * demostrar ingresos de al menos 2 veces el canon (idealmente 3). No es requisito
 * legal (Ley 820 de 2003), por eso 2× es solo SUGERENCIA (no bloquea).
 *
 * Sí es BLOQUEANTE cuando el ingreso declarado es INFERIOR al propio canon: no
 * tendría cómo pagar el arriendo.
 */
const money = (n: number) => `$${Math.round(n || 0).toLocaleString("es-CO")}`;

/** ¿El ingreso declarado es inferior al canon? (bloqueante). 0/sin canon → no bloquea. */
export function incomeBelowRent(rentReference: number, income: number): boolean {
  return rentReference > 0 && income > 0 && income < rentReference;
}

export function IncomeSuggestion({
  rentReference,
  income,
  who,
}: {
  /** Canon de referencia (propuesto o pactado). 0 si aún no se conoce. */
  rentReference: number;
  /** Ingreso ingresado, para el aviso en vivo. 0 si vacío. */
  income: number;
  who: "el codeudor" | "el inquilino";
}) {
  if (!rentReference || rentReference <= 0) {
    return (
      <p className="mt-1 rounded-lg border border-violet-200 bg-violet-50/60 p-2 text-[11px] leading-snug text-slate-700">
        💡 Se sugiere que {who} tenga ingresos de al menos <strong>2 veces el valor del arrendamiento</strong>{" "}
        (idealmente 3). Es orientación de inmobiliarias, no requisito legal.
      </p>
    );
  }
  const min2 = rentReference * 2;
  const ideal3 = rentReference * 3;

  // Bloqueante: ingreso por debajo del canon.
  if (incomeBelowRent(rentReference, income)) {
    return (
      <p className="mt-1 rounded-lg border-2 border-rose-400 bg-rose-50 p-2 text-[11px] font-medium leading-snug text-rose-800">
        ⛔ El ingreso ({money(income)}) es <strong>inferior al canon</strong> ({money(rentReference)}). Revisa el valor:
        no tendría cómo pagar el arriendo. <strong>Debes corregirlo para continuar.</strong>
      </p>
    );
  }
  // Sugerencia (no bloqueante): por debajo de 2×.
  if (income > 0 && income < min2) {
    return (
      <p className="mt-1 rounded-lg border border-amber-300 bg-amber-50 p-2 text-[11px] leading-snug text-amber-900">
        ⚠️ Se <strong>sugiere</strong> que {who} tenga ingresos de al menos <strong>2 veces el arrendamiento</strong>{" "}
        ({money(min2)}), idealmente 3× ({money(ideal3)}). El valor ingresado está por debajo de lo sugerido, pero{" "}
        <strong>puedes continuar</strong>.
      </p>
    );
  }
  // Cumple lo sugerido.
  if (income >= min2) {
    return (
      <p className="mt-1 rounded-lg border border-emerald-300 bg-emerald-50 p-2 text-[11px] leading-snug text-emerald-800">
        ✓ Cumple lo sugerido: ingresos ≥ 2 veces el canon ({money(min2)}).
      </p>
    );
  }
  // Sin ingreso aún.
  return (
    <p className="mt-1 rounded-lg border border-violet-200 bg-violet-50/60 p-2 text-[11px] leading-snug text-slate-700">
      💡 Para un canon de <strong>{money(rentReference)}</strong>, se sugiere que {who} tenga ingresos desde{" "}
      <strong>{money(min2)}</strong> (2×), idealmente <strong>{money(ideal3)}</strong> (3×). Orientación de
      inmobiliarias, no requisito legal.
    </p>
  );
}
