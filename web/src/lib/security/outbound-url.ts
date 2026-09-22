import "server-only";

/**
 * Valida una URL a la que el SERVIDOR hará fetch por configuración de una agencia
 * (endpoint de estudio externo, webhook de automatización). Mitiga SSRF: exige
 * https, prohíbe credenciales embebidas y bloquea localhost / rangos privados /
 * link-local (incluida la IP de metadata 169.254.169.254).
 *
 * No resuelve DNS (no cubre rebinding), pero cierra los vectores directos por
 * hostname/IP literal, que es el riesgo práctico de una URL configurable.
 */
export function validateOutboundUrl(raw: string): { ok: true; url: string } | { ok: false; error: string } {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { ok: false, error: "URL inválida." };
  }
  if (u.protocol !== "https:") return { ok: false, error: "La URL debe usar https." };
  if (u.username || u.password) return { ok: false, error: "La URL no puede llevar credenciales." };

  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    return { ok: false, error: "Host no permitido." };
  }
  if (isBlockedIp(host)) return { ok: false, error: "La URL apunta a una dirección interna no permitida." };
  return { ok: true, url: u.toString() };
}

function isBlockedIp(host: string): boolean {
  // IPv4 literal
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (m.slice(1).some((o) => Number(o) > 255)) return true; // malformada → bloquea
    if (a === 0 || a === 127) return true; // 0.0.0.0/8, loopback
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 169 && b === 254) return true; // link-local + metadata 169.254.169.254
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
    return false;
  }
  // IPv6 loopback / link-local / unique-local
  if (host === "::1" || host === "::") return true;
  if (host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd")) return true;
  // IPv4-mapped IPv6 (::ffff:a.b.c.d)
  const mapped = host.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i);
  if (mapped) return isBlockedIp(mapped[1]);
  return false;
}
