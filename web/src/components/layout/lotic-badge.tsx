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
  // `lotic-logo-wordmark.png` es el logo OFICIAL recortado (sin el margen negro
  // que hacía que la palabra midiera ~5px en el footer). `screen` elimina su fondo
  // oscuro para que se vea el color del recuadro, y el filtro aviva el violeta del
  // "LO", que sobre negro casi no se distinguía.
  const logo = (
    <img
      src="/lotic-logo-wordmark.png"
      alt="LOTIC"
      width={317}
      height={96}
      className="h-[1.15em] w-auto"
      style={{ mixBlendMode: "screen", filter: "brightness(1.4) saturate(1.15)" }}
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
        <span className="inline-flex items-center rounded-md bg-[#2d2850] px-2 py-1">{logo}</span>
      ) : (
        logo
      )}
    </a>
  );
}
