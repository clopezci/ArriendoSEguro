"use client";

import { useRef } from "react";
import { ReadAloudButton } from "./read-aloud";

/**
 * Envuelve un bloque/página de texto y le pone un botón "Escuchar" que lee TODO
 * su contenido visible (usa el texto renderizado, así no hay que duplicarlo).
 * Ideal para páginas legales, artículos y secciones informativas largas.
 */
export function ReadAloudRegion({
  children,
  label = "Escuchar esta página",
  align = "end",
}: {
  children: React.ReactNode;
  label?: string;
  align?: "start" | "end";
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div>
      <div className={`mb-3 flex ${align === "end" ? "justify-end" : "justify-start"}`}>
        <ReadAloudButton targetRef={ref} withText label={label} />
      </div>
      <div ref={ref}>{children}</div>
    </div>
  );
}
