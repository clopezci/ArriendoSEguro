import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { brebPaymentProvider } from "@/domain/platform-payments/providers/breb-payment-provider";
import { settleApprovedPlatformOrder } from "@/domain/platform-payments/settle-order";
import { processHubWompiEvent } from "@/domain/hub/hub-webhook";
import { auditPlatformPaymentEvent } from "@/domain/platform-payments/audit";
import { logServerError } from "@/lib/observability/observability";

export const runtime = "nodejs";

/**
 * Webhook de Bre-B (proveedor real). Verifica la firma, normaliza el evento y:
 *  - referencia `HUB_*` → liquida la orden del hub y reenvía a la app externa.
 *  - otra referencia   → liquida la orden de plataforma (Plan Plus) y da acceso.
 *
 * En modo interno (sin proveedor configurado) este webhook no acepta eventos.
 */
export async function POST(request: Request) {
  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json({ success: false, error: "server_not_configured" }, { status: 503 });
  }

  try {
    const ok = await brebPaymentProvider.verifyWebhook(request.clone());
    if (!ok) {
      await auditPlatformPaymentEvent(firestore, "breb_webhook_invalid_signature", {});
      return NextResponse.json({ success: false, error: "invalid_signature" }, { status: 401 });
    }

    const event = await brebPaymentProvider.parseWebhookEvent(request.clone());
    const tx = event.data?.transaction;
    const reference = tx?.reference ?? "";
    const nowMs = Date.now();

    if (!reference) {
      return NextResponse.json({ success: false, error: "missing_reference" }, { status: 422 });
    }

    // Órdenes del hub (apps externas).
    if (reference.startsWith("HUB_")) {
      const result = await processHubWompiEvent(firestore, event, nowMs, "breb");
      return NextResponse.json(result.body, { status: result.httpStatus });
    }

    // Solo liquidamos cuando el pago quedó aprobado.
    if ((tx?.status ?? "").toUpperCase() !== "APPROVED") {
      return NextResponse.json({ success: true, status: (tx?.status ?? "pending").toLowerCase() });
    }

    const result = await settleApprovedPlatformOrder(firestore, {
      provider: "breb",
      providerReference: reference,
      providerPaymentId: tx?.id ?? "",
      amountInCents: Number(tx?.amount_in_cents ?? 0),
      currency: tx?.currency ?? "COP",
      method: "breb",
      rawEvent: JSON.stringify(event),
      nowMs,
    });
    return NextResponse.json(result.body, { status: result.httpStatus });
  } catch (err) {
    await logServerError("platform-payments/breb-webhook", err);
    return NextResponse.json({ success: false, error: "server_error" }, { status: 500 });
  }
}
