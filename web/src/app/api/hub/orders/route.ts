import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { authenticateHubRequest } from "@/lib/hub/authenticateHubRequest";
import { buildWompiCheckoutUrl } from "@/domain/platform-payments/wompi-checkout";
import { createBrebCollection, isBrebEnabled } from "@/domain/platform-payments/breb-checkout";

export const runtime = "nodejs";

const schema = z.object({
  amountInCents: z.number().int().positive().max(100_000_000_000),
  currency: z.string().length(3).optional(),
  externalReference: z.string().max(80).optional(),
  customerEmail: z.string().email().max(120).optional(),
  customerFullName: z.string().max(120).optional(),
  redirectUrl: z.string().url().max(500),
  metadata: z.record(z.string(), z.unknown()).optional(),
  // Proveedor de pago para esta orden (por defecto Wompi).
  provider: z.enum(["wompi", "breb"]).optional(),
});

/**
 * Crea una orden de pago para una app externa y devuelve la URL del Web Checkout
 * de Wompi (cuenta central de ArriendoSeguro). Autenticado por API key + HMAC.
 */
export async function POST(request: Request) {
  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json({ success: false, error: "server_not_configured" }, { status: 503 });
  }

  const rawBody = await request.text();
  const nowMs = Date.now();
  const auth = await authenticateHubRequest(firestore, request, rawBody, nowMs);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.message }, { status: auth.status });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ success: false, error: "invalid_json" }, { status: 422 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "validation_error", issues: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })) },
      { status: 422 },
    );
  }

  const currency = (parsed.data.currency ?? "COP").toUpperCase();
  const orderRef = firestore.collection("hub_orders").doc();
  const providerReference = `HUB_${orderRef.id}`;
  const now = new Date(nowMs).toISOString();

  // Proveedor: Wompi por defecto; Bre-B si la app lo pide y está habilitado.
  const provider: "wompi" | "breb" = parsed.data.provider === "breb" && isBrebEnabled() ? "breb" : "wompi";
  let checkoutUrl: string;
  if (provider === "breb") {
    const col = await createBrebCollection({
      reference: providerReference,
      amountInCents: parsed.data.amountInCents,
      currency,
      redirectUrl: parsed.data.redirectUrl,
      customerEmail: parsed.data.customerEmail,
      customerFullName: parsed.data.customerFullName,
    });
    checkoutUrl = col.checkoutUrl;
  } else {
    checkoutUrl = buildWompiCheckoutUrl({
      reference: providerReference,
      amountInCents: parsed.data.amountInCents,
      currency,
      redirectUrl: parsed.data.redirectUrl,
      customerEmail: parsed.data.customerEmail,
      customerFullName: parsed.data.customerFullName,
    });
  }

  await orderRef.set({
    id: orderRef.id,
    appId: auth.app.id,
    provider,
    amountInCents: parsed.data.amountInCents,
    currency,
    externalReference: parsed.data.externalReference ?? null,
    providerReference,
    status: "pending",
    checkoutUrl,
    customerEmail: parsed.data.customerEmail ?? null,
    customerFullName: parsed.data.customerFullName ?? null,
    metadata: parsed.data.metadata ?? null,
    redirectUrl: parsed.data.redirectUrl,
    createdAt: now,
    updatedAt: now,
    createdAtServer: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({
    success: true,
    orderId: orderRef.id,
    reference: providerReference,
    provider,
    checkoutUrl,
    status: "pending",
  });
}
