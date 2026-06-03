import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Limitador de tasa para endpoints públicos (leads, contacto, OTP de firma).
 *
 * Estrategia:
 *   1. Si están configuradas las variables de Upstash Redis
 *      (`UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`), se usa un
 *      limitador *sliding window* compartido entre todas las instancias
 *      serverless de Vercel (robusto y correcto en producción).
 *   2. Si no están configuradas (desarrollo local, build, preview sin secretos),
 *      se cae a un limitador en memoria *best-effort*, por instancia. No es
 *      perfecto entre instancias, pero evita romper el flujo y da una defensa
 *      mínima en local.
 *
 * El módulo nunca lanza: ante cualquier fallo del backend (Redis caído, red),
 * `checkRateLimit` permite la solicitud (fail-open) para no bloquear usuarios
 * legítimos por un problema de infraestructura; el resto de validaciones
 * (Zod, Turnstile, auth, cooldowns de aplicación) siguen aplicando.
 */

export type RateLimitRule = {
  /** Máximo de solicitudes permitidas dentro de la ventana. */
  limit: number;
  /** Tamaño de la ventana en segundos. */
  windowSeconds: number;
  /** Prefijo lógico para separar contadores por tipo de endpoint. */
  prefix: string;
};

export type RateLimitResult = {
  ok: boolean;
  /** Solicitudes restantes en la ventana (informativo). */
  remaining: number;
  /** Segundos sugeridos para reintentar cuando `ok` es false. */
  retryAfterSeconds: number;
};

function upstashConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() && process.env.UPSTASH_REDIS_REST_TOKEN?.trim(),
  );
}

// --- Backend Upstash (producción) -----------------------------------------

const upstashLimiters = new Map<string, Ratelimit>();
let redisSingleton: Redis | null = null;

function getRedis(): Redis {
  if (!redisSingleton) {
    redisSingleton = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!.trim(),
      token: process.env.UPSTASH_REDIS_REST_TOKEN!.trim(),
    });
  }
  return redisSingleton;
}

function getUpstashLimiter(rule: RateLimitRule): Ratelimit {
  const key = `${rule.prefix}:${rule.limit}:${rule.windowSeconds}`;
  let limiter = upstashLimiters.get(key);
  if (!limiter) {
    limiter = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(rule.limit, `${rule.windowSeconds} s`),
      prefix: `rl:${rule.prefix}`,
      analytics: false,
    });
    upstashLimiters.set(key, limiter);
  }
  return limiter;
}

// --- Backend en memoria (fallback local) -----------------------------------

const memoryHits = new Map<string, number[]>();

function checkInMemory(identifier: string, rule: RateLimitRule): RateLimitResult {
  const now = Date.now();
  const windowMs = rule.windowSeconds * 1000;
  const key = `${rule.prefix}:${identifier}`;
  const hits = (memoryHits.get(key) ?? []).filter((t) => now - t < windowMs);

  if (hits.length >= rule.limit) {
    const oldest = hits[0] ?? now;
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    memoryHits.set(key, hits);
    return { ok: false, remaining: 0, retryAfterSeconds };
  }

  hits.push(now);
  memoryHits.set(key, hits);

  // Limpieza oportunista para no crecer sin límite en procesos de larga vida.
  if (memoryHits.size > 5000) {
    for (const [k, ts] of memoryHits) {
      const fresh = ts.filter((t) => now - t < windowMs);
      if (fresh.length === 0) memoryHits.delete(k);
      else memoryHits.set(k, fresh);
    }
  }

  return { ok: true, remaining: rule.limit - hits.length, retryAfterSeconds: 0 };
}

// --- API pública ------------------------------------------------------------

/**
 * Comprueba y consume una unidad de cuota para `identifier` bajo `rule`.
 * `identifier` suele ser la IP del cliente, opcionalmente combinada con un
 * discriminante (por ejemplo el token de firma).
 */
export async function checkRateLimit(
  identifier: string,
  rule: RateLimitRule,
): Promise<RateLimitResult> {
  const id = identifier.trim() || "anon";

  if (!upstashConfigured()) {
    return checkInMemory(id, rule);
  }

  try {
    const limiter = getUpstashLimiter(rule);
    const res = await limiter.limit(id);
    const retryAfterSeconds = res.success
      ? 0
      : Math.max(1, Math.ceil((res.reset - Date.now()) / 1000));
    return { ok: res.success, remaining: res.remaining, retryAfterSeconds };
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[rate-limit] Upstash falló, se permite la solicitud (fail-open):", err);
    }
    return { ok: true, remaining: rule.limit, retryAfterSeconds: 0 };
  }
}

/** Reglas predefinidas por tipo de endpoint público. */
export const RATE_LIMIT_RULES = {
  /** Encuesta / lead público: tolerante pero frena spam masivo. */
  leads: { limit: 8, windowSeconds: 60 * 10, prefix: "leads" } satisfies RateLimitRule,
  /** Formulario de contacto: envía correo, más estricto. */
  contact: { limit: 5, windowSeconds: 60 * 10, prefix: "contact" } satisfies RateLimitRule,
  /** Solicitud de OTP de firma: evita bombardeo de correos por IP. */
  signatureOtp: { limit: 10, windowSeconds: 60 * 10, prefix: "sig-otp" } satisfies RateLimitRule,
  /** Reportes de usuario (bugs/quejas): moderado, evita spam. */
  reports: { limit: 6, windowSeconds: 60 * 10, prefix: "reports" } satisfies RateLimitRule,
  /** Captura automática de errores de cliente: tolera ráfagas pero acota por IP. */
  clientError: { limit: 40, windowSeconds: 60, prefix: "cli-err" } satisfies RateLimitRule,
} as const;

/** Respuesta estándar 429 con `Retry-After`. */
export function tooManyRequestsJson(retryAfterSeconds: number) {
  return {
    body: {
      ok: false as const,
      success: false as const,
      error: "Demasiadas solicitudes. Intenta de nuevo en un momento.",
      errors: [
        {
          field: "rate_limit",
          message: `Has hecho demasiadas solicitudes. Espera ${retryAfterSeconds} segundos e inténtalo de nuevo.`,
        },
      ],
    },
    headers: { "Retry-After": String(Math.max(1, retryAfterSeconds)) },
  };
}

/** Extrae la IP del cliente desde las cabeceras estándar de proxy. */
export function clientIpFromRequest(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "anon"
  );
}
