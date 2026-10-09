import type { AnnualValueStatus } from "@/domain/annual/annualValues";

/**
 * Aviso visible junto a un valor anual oficial (IPC, UVT): verde si ya es el
 * dato del año en curso ("actualizado según X"), ámbar si aún no ("aún sin
 * actualizar según X"), siempre con enlace a la fuente oficial.
 */
export function AnnualValueNotice({
  status,
  text,
  source,
  sourceUrl,
  className = "",
}: {
  status: AnnualValueStatus;
  text: string;
  source: string;
  sourceUrl: string;
  className?: string;
}) {
  const updated = status === "updated";
  return (
    <p
      role="note"
      className={`rounded-lg border px-3 py-2 text-xs leading-relaxed ${
        updated ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-amber-300 bg-amber-50 text-amber-900"
      } ${className}`}
    >
      <span aria-hidden>{updated ? "✅ " : "⏳ "}</span>
      {text}{" "}
      <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="font-medium underline">
        Ver fuente ({source})
      </a>
    </p>
  );
}
