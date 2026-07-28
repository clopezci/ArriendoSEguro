/* eslint-disable @next/next/no-img-element */
/**
 * Marca "Un producto de LOTIC" reutilizable, con el LOGO OFICIAL de LOTIC
 * (`/lotic-logo.png`: la L con pulso, la O con la molécula, degradado violeta→
 * blanco). Se usa igual en TODAS partes para que la marca sea consistente.
 *
 * El logo es claro sobre fondo oscuro, así que en fondos CLAROS (como el footer)
 * se muestra dentro de una PÍLDORA OSCURA para que se vea correcto. En fondos
 * oscuros se puede usar `tone="onDark"` (sin píldora, con blend).
 *
 * Props:
 * - withPrefix: muestra "Un producto de" antes del logo (por defecto true).
 * - tone: "onLight" (píldora oscura, para footers claros) | "onDark" (directo).
 * - className: clases extra para el contenedor (tamaño de fuente, etc.).
 */
export function LoticBadge({
  withPrefix = true,
  tone = "onLight",
  className = "",
}: {
  withPrefix?: boolean;
  tone?: "onLight" | "onDark";
  className?: string;
}) {
  const logo = (
    <img
      src="/lotic-logo.png"
      alt="LOTIC"
      width={1024}
      height={683}
      className="h-[1.35em] w-auto"
      style={tone === "onDark" ? { mixBlendMode: "screen" } : undefined}
    />
  );
  return (
    <a
      href="https://lotic-soluciones.vercel.app/"
      target="_blank"
      rel="noreferrer"
      aria-label="LOTIC Soluciones (abre en una pestaña nueva)"
      className={`inline-flex items-center gap-1.5 align-middle transition hover:opacity-90 ${className}`}
    >
      {withPrefix && <span className="opacity-80">Un producto de</span>}
      {tone === "onLight" ? (
        <span className="inline-flex items-center rounded-md bg-[#0a0a11] px-1.5 py-[3px]">{logo}</span>
      ) : (
        logo
      )}
    </a>
  );
}
