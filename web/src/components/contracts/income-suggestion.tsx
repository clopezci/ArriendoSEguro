"use client";

/**
 * Sugerencia (NO bloqueante) de ingresos frente al canon.
 *
 * Práctica común de inmobiliarias en Colombia: el arrendatario y el codeudor
 * deben demostrar ingresos de al menos 2 veces el canon (idealmente 3). No es
 * un requisito legal (la Ley 820 de 2003 no lo exige); es orientación de mercado.
 */
const money = (n: number) => `$${Math.round(n || 0).toLocaleString("es-CO")}`;

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
        💡 Sugerencia: las inmobiliarias suelen pedir que {who} tenga ingresos de al menos <strong>2 veces el canon</strong>{" "}
        (idealmente 3). No es requisito legal; es orientación de mercado.
      </p>
    );
  }
  const min2 = rentReference * 2;
  const ideal3 = rentReference * 3;
  const below = income > 0 && income < min2;
  return (
    <div
      className={`mt-1 rounded-lg border p-2 text-[11px] leading-snug ${
        below ? "border-amber-300 bg-amber-50 text-amber-900" : "border-violet-200 bg-violet-50/60 text-slate-700"
      }`}
    >
      💡 Sugerencia (no obligatoria): para un canon de <strong>{money(rentReference)}</strong>, se recomienda que {who}{" "}
      tenga ingresos desde <strong>{money(min2)}</strong> (2×), idealmente <strong>{money(ideal3)}</strong> (3×). Es
      práctica de inmobiliarias en Colombia; la Ley 820 no lo exige.
      {below && (
        <span className="mt-1 block font-medium">
          ⚠️ El ingreso ingresado ({money(income)}) está por debajo de lo sugerido. Puedes continuar de todos modos.
        </span>
      )}
    </div>
  );
}
