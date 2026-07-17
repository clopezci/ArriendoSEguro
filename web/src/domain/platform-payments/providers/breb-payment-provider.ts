import { createHmac, timingSafeEqual } from "node:crypto";
import type { PaymentProviderAdapter } from "../provider-adapter";
import type { PlatformOrder, WompiWebhookEvent } from "../types";
import { createBrebCollection, isBrebConfigured } from "../breb-checkout";
import { appConfig } from "@/lib/config";

/**
 * Adaptador de pago **Bre-B** con la misma interfaz que Wompi. El "checkout" es
 * la página interna de QR/llave (o la URL del proveedor real si está configurado).
 * El webhook y el estado se mapean a la forma normalizada que ya usa la app.
 */
export const brebPaymentProvider: PaymentProviderAdapter = {
  async createCheckout(order: PlatformOrder) {
    const base = appConfig.publicUrl.replace(/\/$/, "");
    const contractQ = order.leaseProcessId ? `&contract=${encodeURIComponent(order.leaseProcessId)}` : "";
    const redirectUrl = `${base}/dashboard/plans?order=${encodeURIComponent(order.providerReference)}${contractQ}`;
    const col = await createBrebCollection({
      reference: order.providerReference,
      amountInCents: Math.round(order.amount * 100),
      currency: order.currency,
      redirectUrl,
      customerEmail: order.userEmail || undefined,
    });
    return { checkoutUrl: col.checkoutUrl, providerReference: col.providerReference };
  },

  async verifyWebhook(request: Request) {
    // Verifica la firma del webhook del proveedor Bre-B con un secreto compartido.
    // Si no hay proveedor configurado (modo interno), no se aceptan webhooks externos.
    const secret = process.env.BREB_WEBHOOK_SECRET?.trim();
    if (!isBrebConfigured() || !secret) return false;
    try {
      const raw = await request.clone().text();
      const provided = request.headers.get("x-breb-signature") ?? "";
      const expected = createHmac("sha256", secret).update(raw).digest("hex");
      const a = Buffer.from(provided);
      const b = Buffer.from(expected);
      return a.length === b.length && timingSafeEqual(a, b);
    } catch {
      return false;
    }
  },

  async parseWebhookEvent(request: Request) {
    // Mapea el webhook de Bre-B a la forma normalizada (misma que Wompi) para
    // reutilizar la lógica de liquidación. Tolerante a nombres de campos comunes.
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const d = (body.data as Record<string, unknown>) ?? body;
    const status = String((d.status as string) ?? (body.status as string) ?? "").toUpperCase();
    const normalized: WompiWebhookEvent = {
      event: String((body.event as string) ?? "transaction.updated"),
      data: {
        transaction: {
          id: String((d.id as string) ?? (d.transactionId as string) ?? ""),
          status: status === "PAID" || status === "COMPLETED" || status === "SUCCESS" ? "APPROVED" : status || "PENDING",
          amount_in_cents: Number((d.amountInCents as number) ?? (d.amount_in_cents as number) ?? 0),
          currency: String((d.currency as string) ?? "COP"),
          reference: String((d.reference as string) ?? (d.externalReference as string) ?? ""),
          payment_method_type: "breb",
        },
      },
    };
    return normalized;
  },

  async getPaymentStatus(providerPaymentId: string) {
    if (!isBrebConfigured()) return { status: "UNKNOWN", raw: "breb_internal_mode" };
    try {
      const apiBase = process.env.BREB_API_BASE_URL!.trim().replace(/\/$/, "");
      const path = process.env.BREB_STATUS_PATH?.trim() || "/collections";
      const res = await fetch(`${apiBase}${path}/${encodeURIComponent(providerPaymentId)}`, {
        headers: { authorization: `Bearer ${process.env.BREB_API_KEY!.trim()}` },
        cache: "no-store",
      });
      const raw = await res.text();
      if (!res.ok) return { status: "ERROR", raw };
      let parsed: { status?: string; data?: { status?: string } } = {};
      try {
        parsed = JSON.parse(raw) as { status?: string; data?: { status?: string } };
      } catch {
        // ignore
      }
      return { status: parsed.data?.status ?? parsed.status ?? "UNKNOWN", raw };
    } catch (err) {
      return { status: "ERROR", raw: err instanceof Error ? err.message : "breb_status_error" };
    }
  },
};
