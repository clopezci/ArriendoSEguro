"use client";

import { useEffect, useState } from "react";

/**
 * Nota legal de tratamiento tributario que se ACTUALIZA SOLA según la config del
 * admin (responsable de IVA o no). Se puede poner en Términos, facturación, la
 * página de planes o el footer. Lee el estado público `/api/tax/status`.
 *
 * `variant`:
 *  - "paragraph": texto para páginas legales.
 *  - "inline": frase corta para el checkout/planes.
 */
export function TaxLegalNote({ variant = "paragraph", className = "" }: { variant?: "paragraph" | "inline"; className?: string }) {
  const [tax, setTax] = useState<{ ivaResponsable: boolean; ivaRate: number } | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/tax/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => { if (!cancelled && j?.success) setTax({ ivaResponsable: Boolean(j.ivaResponsable), ivaRate: Number(j.ivaRate) || 19 }); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (!tax) return null;

  if (variant === "inline") {
    return (
      <span className={className}>
        {tax.ivaResponsable
          ? `Los precios mostrados no incluyen IVA; se agrega el ${tax.ivaRate}% al pagar.`
          : "Precio final. Actualmente no se cobra IVA."}
      </span>
    );
  }

  return (
    <p className={className}>
      {tax.ivaResponsable ? (
        <>
          ArriendoSeguro es <strong>responsable de IVA</strong>. A los precios publicados se les agrega el{" "}
          <strong>IVA vigente ({tax.ivaRate}%)</strong>, que se discrimina en el comprobante de pago conforme a la
          normativa colombiana. El valor del IVA se recauda por cuenta de la DIAN.
        </>
      ) : (
        <>
          ArriendoSeguro actualmente <strong>no es responsable de IVA</strong> (Art. 437 del Estatuto Tributario): los
          precios publicados son <strong>finales</strong> y no incluyen ni discriminan IVA. Si en el futuro la empresa
          pasa a ser responsable de IVA, esta nota y los precios se actualizarán automáticamente.
        </>
      )}
    </p>
  );
}
