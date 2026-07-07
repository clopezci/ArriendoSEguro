/**
 * Notificación saliente (webhook) del hub hacia la app externa: le avisamos el
 * estado de cada pago, firmado con HMAC para que la app lo verifique.
 */

import { signHubBody } from "./hub-signature";
import type { HubApp } from "./hub-apps";

export async function notifyHubApp(
  app: HubApp,
  payload: Record<string, unknown>,
  nowMs: number,
): Promise<{ ok: boolean; status?: number }> {
  if (!app.webhookUrl) return { ok: false };
  const body = JSON.stringify(payload);
  const timestamp = String(nowMs);
  const signature = signHubBody(app.hmacSecret, timestamp, body);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(app.webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-hub-timestamp": timestamp,
        "x-hub-signature": signature,
        "x-hub-event": String(payload.type ?? "payment.updated"),
      },
      body,
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timer);
    return { ok: res.ok, status: res.status };
  } catch {
    // Mejor esfuerzo: si falla, la app siempre puede consultar GET /api/hub/orders/:id.
    return { ok: false };
  }
}
