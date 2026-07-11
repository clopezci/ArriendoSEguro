/**
 * Captura de evidencia de un juramento/aceptación del dueño en el recorrido nuevo.
 * Reutiliza el endpoint existente /api/oath-evidence/capture, que deja constancia
 * server-side de IP, país/región/ciudad (headers de la CDN), fecha del servidor y
 * los datos de cliente (user-agent, idioma, zona horaria, pantalla) en la
 * colección `oath_evidence`. Best-effort: nunca bloquea el flujo.
 */
export async function captureOathEvidence(oathId: string, contractDraftId?: string): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const body = {
      oathId,
      contractDraftId: contractDraftId || undefined,
      userAgent: navigator.userAgent?.slice(0, 500),
      language: navigator.language,
      timeZone: (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return undefined; } })(),
      screen: window.screen ? `${window.screen.width}x${window.screen.height}` : undefined,
      clientNow: new Date().toISOString(),
    };
    await fetch("/api/oath-evidence/capture", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    });
  } catch {
    /* evidencia best-effort; no rompemos el flujo */
  }
}
