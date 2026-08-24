/**
 * Envío de eventos de producto desde el cliente. Best-effort y no bloqueante:
 * usa `navigator.sendBeacon` (sobrevive a que la página se cierre) y, si no,
 * `fetch` con keepalive. Además refleja el evento en GA4 (gtag) si está cargado.
 *
 * Uso: `track("cta_click", { cta: "crear" })`. NO enviar datos personales.
 */
const ANON_KEY = "as_anon_id";

export function getAnonId(): string {
  try {
    let v = localStorage.getItem(ANON_KEY);
    if (!v) {
      v = (globalThis.crypto?.randomUUID?.() ?? `a_${Date.now()}_${Math.round(Math.random() * 1e9)}`);
      localStorage.setItem(ANON_KEY, v);
    }
    return v;
  } catch {
    return "anon";
  }
}

export function track(name: string, props?: Record<string, unknown>): void {
  try {
    // Espejo en GA4 (si el gtag está presente).
    (window as unknown as { gtag?: (...a: unknown[]) => void }).gtag?.("event", name, props ?? {});

    const body = JSON.stringify({ name, anonId: getAnonId(), props: props ?? {} });
    const url = "/api/analytics/event";
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([body], { type: "text/plain" }));
    } else {
      void fetch(url, { method: "POST", headers: { "content-type": "text/plain" }, body, keepalive: true });
    }
  } catch {
    /* nunca romper la UX por analítica */
  }
}
