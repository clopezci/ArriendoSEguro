/**
 * Bre-B (sistema de pagos inmediatos del Banco de la República) como método de
 * pago adicional, con la MISMA arquitectura de hub que Wompi.
 *
 * Bre-B es un **riel**: se cobra a través de un **participante** (banco/billetera
 * o agregador habilitado que expone un API). Este módulo es un **adaptador
 * genérico** configurable por variables de entorno; sin proveedor configurado
 * cae a un **modo interno** (página de QR/llave para pago manual), útil para
 * pruebas de extremo a extremo mientras se habilita el proveedor real.
 *
 * Variables de entorno (todas opcionales hasta habilitar el proveedor real):
 *   BREB_LLAVE            La "llave" Bre-B del comercio (cédula, celular, correo o @alfanumérica)
 *   BREB_MERCHANT_NAME    Nombre del comercio que verá el pagador (por defecto, appConfig.name)
 *   BREB_API_BASE_URL     Base del API del proveedor Bre-B (si integras uno)
 *   BREB_API_KEY          Credencial del proveedor (Authorization: Bearer …)
 *   BREB_CREATE_PATH      Ruta para crear la solicitud de cobro (def. "/collections")
 *   BREB_WEBHOOK_SECRET   Secreto para verificar el webhook del proveedor
 *   BREB_ENVIRONMENT      "production" | "sandbox" (informativo)
 */

import { appConfig } from "@/lib/config";

/** ¿Hay un proveedor Bre-B real configurado (API + llave)? */
export function isBrebConfigured(): boolean {
  return Boolean(process.env.BREB_API_BASE_URL?.trim() && process.env.BREB_API_KEY?.trim() && process.env.BREB_LLAVE?.trim());
}

/** ¿Bre-B está disponible como método (aunque sea en modo interno de QR/llave)? */
export function isBrebEnabled(): boolean {
  // Disponible si hay proveedor real O si hay al menos una llave para el modo interno.
  return isBrebConfigured() || Boolean(process.env.BREB_LLAVE?.trim());
}

export function brebLlave(): string {
  return process.env.BREB_LLAVE?.trim() ?? "";
}

export function brebMerchantName(): string {
  return process.env.BREB_MERCHANT_NAME?.trim() || appConfig.name;
}

/**
 * URL de la IMAGEN del QR Bre-B real del comercio (la que genera tu banco, p. ej.
 * Bancolombia "Paga aquí"). Ese QR SÍ lo leen las apps bancarias. Si se define,
 * la página de pago la muestra en lugar del QR interno (que no es escaneable).
 * Súbela a un lugar accesible (p. ej. /public de la app o el enlace del QR
 * digital del banco) y pon la URL en BREB_QR_IMAGE_URL o NEXT_PUBLIC_BREB_QR_URL.
 */
export function brebQrImageUrl(): string {
  return (
    process.env.BREB_QR_IMAGE_URL?.trim() ||
    process.env.NEXT_PUBLIC_BREB_QR_URL?.trim() ||
    ""
  );
}

export type BrebCollection = {
  /** URL a la que se envía al pagador (página interna de QR/llave o la del proveedor). */
  checkoutUrl: string;
  providerReference: string;
  /** Contenido del QR (si el proveedor lo entrega); en modo interno se genera en el navegador. */
  qrPayload: string | null;
  /** true si se creó contra el proveedor real; false si es el modo interno. */
  live: boolean;
};

/**
 * Crea una solicitud de cobro Bre-B. Con proveedor configurado, llama a su API;
 * si no, devuelve la página interna de QR/llave para pago manual. `redirectUrl`
 * es a dónde volver tras pagar (lo maneja la app que invoca).
 */
export async function createBrebCollection(opts: {
  reference: string;
  amountInCents: number;
  currency: string;
  redirectUrl: string;
  customerEmail?: string;
  customerFullName?: string;
}): Promise<BrebCollection> {
  const base = appConfig.publicUrl.replace(/\/$/, "");
  const internalUrl = `${base}/pago/breb/${encodeURIComponent(opts.reference)}?redirect=${encodeURIComponent(opts.redirectUrl)}`;

  if (!isBrebConfigured()) {
    // Modo interno: la página muestra la llave + QR + instrucciones y sondea el estado.
    return { checkoutUrl: internalUrl, providerReference: opts.reference, qrPayload: null, live: false };
  }

  // Proveedor real: crea la solicitud de cobro. El shape exacto lo define el
  // proveedor Bre-B que elijas; se mapea de forma tolerante a nombres comunes.
  try {
    const apiBase = process.env.BREB_API_BASE_URL!.trim().replace(/\/$/, "");
    const path = process.env.BREB_CREATE_PATH?.trim() || "/collections";
    const res = await fetch(`${apiBase}${path}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.BREB_API_KEY!.trim()}`,
        "content-type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify({
        key: brebLlave(),
        amountInCents: opts.amountInCents,
        currency: opts.currency,
        reference: opts.reference,
        description: `${brebMerchantName()} · ${opts.reference}`,
        payerEmail: opts.customerEmail ?? null,
        payerName: opts.customerFullName ?? null,
        redirectUrl: opts.redirectUrl,
      }),
    });
    const text = await res.text();
    if (!res.ok) {
      // Ante fallo del proveedor, no bloqueamos: caemos al modo interno.
      return { checkoutUrl: internalUrl, providerReference: opts.reference, qrPayload: null, live: false };
    }
    const data = JSON.parse(text) as Record<string, unknown>;
    const paymentUrl =
      (data.paymentUrl as string) || (data.checkoutUrl as string) || (data.url as string) || internalUrl;
    const qr = (data.qr as string) || (data.qrPayload as string) || (data.qrData as string) || null;
    const providerRef = (data.reference as string) || (data.id as string) || opts.reference;
    return { checkoutUrl: paymentUrl, providerReference: providerRef, qrPayload: qr, live: true };
  } catch {
    return { checkoutUrl: internalUrl, providerReference: opts.reference, qrPayload: null, live: false };
  }
}
