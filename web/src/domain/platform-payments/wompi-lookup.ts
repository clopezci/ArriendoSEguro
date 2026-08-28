import "server-only";
import { wompiApiBaseUrl } from "./wompi-checkout";

export type WompiTx = {
  id: string;
  status: string;
  reference: string;
  amount_in_cents: number;
  currency?: string;
  payment_method_type?: string;
};

/**
 * Consulta a Wompi las transacciones de una REFERENCIA (`GET /v1/transactions?
 * reference=…`) y devuelve la APROBADA si existe. Es la base de la reconciliación
 * automática (barrido) cuando ni el webhook ni el retorno del usuario llegaron:
 * con la sola referencia de la orden podemos preguntarle a Wompi qué pasó.
 *
 * Devuelve `null` de forma segura si la pasarela no está configurada, si la
 * consulta falla, o si no hay una transacción APROBADA para esa referencia
 * (así el barrido simplemente deja la orden como estaba).
 */
export async function findApprovedWompiTxByReference(reference: string): Promise<WompiTx | null> {
  const privateKey = (process.env.WOMPI_PRIVATE_KEY ?? "").trim();
  if (!privateKey || !reference) return null;

  let res: Response;
  try {
    res = await fetch(`${wompiApiBaseUrl()}/transactions?reference=${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${privateKey}` },
      cache: "no-store",
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return null;
  }
  const data = (json as { data?: unknown })?.data;
  if (!Array.isArray(data)) return null;

  const txs = data as WompiTx[];
  // Autoritativa: referencia EXACTA + estado APPROVED. Si hubo reintentos y hay
  // varias aprobadas, la primera basta (la idempotencia del liquidador evita
  // duplicar el pago/acceso).
  const approved = txs.find(
    (t) => String(t?.reference ?? "") === reference && String(t?.status ?? "").toUpperCase() === "APPROVED",
  );
  return approved ?? null;
}
