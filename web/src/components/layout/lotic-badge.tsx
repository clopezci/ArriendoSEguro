/**
 * Marca "Un producto de LOTIC" reutilizable, con el logotipo LOTIC (la «O» es el
 * emblema circular anillo violeta + punto verde). Se usa igual en TODAS partes
 * para que la marca sea consistente. Enlaza al sitio de Lotic.
 *
 * Props:
 * - withPrefix: muestra "Un producto de" antes del logo (por defecto true).
 * - tone: "dark" para fondos claros (texto oscuro) | "light" para fondos oscuros.
 * - className: clases extra para el contenedor (tamaño de fuente, etc.).
 */
export function LoticBadge({
  withPrefix = true,
  tone = "dark",
  className = "",
}: {
  withPrefix?: boolean;
  tone?: "dark" | "light";
  className?: string;
}) {
  const wordColor = tone === "light" ? "text-white" : "text-[#17151F]";
  return (
    <a
      href="https://lotic-soluciones.vercel.app/"
      target="_blank"
      rel="noreferrer"
      aria-label="LOTIC Soluciones (abre en una pestaña nueva)"
      className={`inline-flex items-center gap-1.5 align-middle transition hover:opacity-90 ${className}`}
    >
      {withPrefix && <span className="opacity-80">Un producto de</span>}
      <span className={`inline-flex items-center font-black tracking-tight leading-none ${wordColor}`}>
        L
        <svg width="1em" height="1em" viewBox="0 0 24 24" aria-hidden="true" className="mx-[0.5px]">
          <defs>
            <linearGradient id="loticO" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#5646E5" />
              <stop offset="1" stopColor="#A855F7" />
            </linearGradient>
          </defs>
          <circle cx="12" cy="12" r="8.6" fill="none" stroke="url(#loticO)" strokeWidth="4.8" />
          <circle cx="12" cy="12" r="2.7" fill="#12B886" />
        </svg>
        TIC
      </span>
    </a>
  );
}
