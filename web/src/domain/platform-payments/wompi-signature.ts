import { createHash, timingSafeEqual } from "node:crypto";

function resolvePath(obj: unknown, path: string): string {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (typeof current !== "object" || current === null || !(part in current)) return "";
    current = (current as Record<string, unknown>)[part];
  }
  if (current === null || typeof current === "undefined") return "";
  if (typeof current === "string" || typeof current === "number" || typeof current === "boolean") {
    return String(current);
  }
  return JSON.stringify(current);
}

function safeEqualHex(a: string, b: string): boolean {
  if (!a || !b) return false;
  try {
    const ba = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

export function verifyWompiWebhookSignature(
  eventBody: unknown,
  headers: Headers,
  secrets?: { eventsSecret?: string; integritySecret?: string },
): { valid: boolean; reason?: string } {
  const eventSecret =
    (secrets?.eventsSecret ?? process.env.WOMPI_EVENTS_SECRET ?? "").trim() ||
    (secrets?.integritySecret ?? process.env.WOMPI_INTEGRITY_SECRET ?? "").trim();
  if (!eventSecret) return { valid: false, reason: "missing_secret" };

  const event = eventBody as {
    signature?: { checksum?: string; properties?: string[] };
  };
  const checksum = event?.signature?.checksum ?? headers.get("x-wompi-signature") ?? "";
  const properties = event?.signature?.properties ?? [];
  if (!checksum || !Array.isArray(properties) || properties.length === 0) {
    return { valid: false, reason: "missing_signature_parts" };
  }

  // Wompi firma concatenando los valores de signature.properties en el orden recibido
  // y anexando el secreto de eventos.
  const base = properties.map((p) => resolvePath(eventBody, p)).join("");
  const computed = createHash("sha256").update(`${base}${eventSecret}`).digest("hex");
  return safeEqualHex(computed, checksum)
    ? { valid: true }
    : { valid: false, reason: "checksum_mismatch" };
}

