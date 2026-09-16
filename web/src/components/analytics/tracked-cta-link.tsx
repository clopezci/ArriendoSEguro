"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { track } from "@/lib/analytics/track";

/**
 * Enlace de llamado a la acción (CTA) que registra un evento `cta_click` antes de
 * navegar, para medir el TOPE del embudo: de quienes llegan a la página, cuántos
 * pulsan cada botón. `track` es best-effort (beacon/fetch), no bloquea la
 * navegación. Sin cookies ni PII.
 */
export function TrackedCtaLink({
  href,
  cta,
  className,
  children,
}: {
  href: string;
  cta: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => {
        try {
          track("cta_click", { cta });
        } catch {
          /* noop */
        }
      }}
    >
      {children}
    </Link>
  );
}
