import type { ReactNode } from "react";

/**
 * Fondo "bento" reutilizable (lienzo crema `#F5F3EF` + dos blobs de gradiente),
 * el mismo del hub `/nuevo/gestionar` y del flujo `/nuevo`. Envuelve páginas del
 * hub que quedaron con fondo plano para unificar el look. Es PRESENTACIONAL: no
 * toca lógica, datos ni navegación.
 */
export function BentoShell({
  children,
  maxWidth = "3xl",
}: {
  children: ReactNode;
  maxWidth?: "2xl" | "3xl" | "4xl";
}) {
  const mw = maxWidth === "2xl" ? "max-w-2xl" : maxWidth === "4xl" ? "max-w-4xl" : "max-w-3xl";
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#F5F3EF] text-[#17151F]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, #37D0E8, #3A7BFF)" }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 top-40 h-80 w-80 rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, #9B6BFF, #5646E5)" }}
      />
      <div className={`relative z-10 mx-auto ${mw} px-4 py-8 sm:px-6`}>{children}</div>
    </div>
  );
}
