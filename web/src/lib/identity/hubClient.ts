import "server-only";

/**
 * Adapter del módulo de identidad (hub externo, app CriterioNacional/CC).
 * Un solo POST con imágenes en base64. La API key vive SOLO en el servidor
 * (`ArriendoSeguro_API_KEY` en Vercel); nunca se expone al cliente. No lanza:
 * ante cualquier fallo devuelve `available:false` para no romper el flujo.
 */

const DEFAULT_URL = "https://cc-one-silk.vercel.app/api/v1/identidad/validar";

export type IdentityFactor = { clave: string; nombre: string; estado: string; detalle?: string };

export interface IdentityResult {
  /** El servicio respondió (true) o no se pudo consultar (false). */
  available: boolean;
  /** Veredicto del hub. */
  approved: boolean;
  confianza?: number; // 0..100
  nivel?: string;
  cedulaVigente?: boolean;
  nombreRegistrado?: string;
  faceMatch?: boolean;
  liveness?: boolean;
  score?: number; // 0..1
  factores?: IdentityFactor[];
  /** Token de un solo uso (solo si aprobado). */
  token?: string;
  advertencias?: string[];
  /** Código de error interno cuando available=false. */
  error?: string;
}

export type IdentityLevel = "basico" | "medio" | "alto" | "maximo";

export interface VerifyIdentityInput {
  cedula: string;
  /** data:image/...;base64,... */
  fotoCedula: string;
  /** data:image/...;base64,... (requerido para nivel alto/maximo) */
  selfie?: string;
  nivel?: IdentityLevel;
  accion?: string;
}

function apiKey(): string | undefined {
  // Lectura dinámica (server-only): el nombre de la variable tiene mayúsculas.
  return process.env["ArriendoSeguro_API_KEY"] || process.env.ARRIENDOSEGURO_API_KEY;
}

export function isIdentityConfigured(): boolean {
  return Boolean(apiKey());
}

export async function verifyIdentity(input: VerifyIdentityInput): Promise<IdentityResult> {
  const key = apiKey();
  if (!key) return { available: false, approved: false, error: "not_configured" };
  const url = process.env.IDENTITY_HUB_URL?.trim() || DEFAULT_URL;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key },
      body: JSON.stringify({
        cedula: input.cedula,
        fotoCedula: input.fotoCedula,
        ...(input.selfie ? { selfie: input.selfie } : {}),
        nivel: input.nivel ?? "alto",
        accion: input.accion ?? "kyc",
      }),
      // Evita cuelgues largos del flujo de agencia.
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return { available: false, approved: false, error: `hub_${res.status}` };
    const data = (await res.json()) as Record<string, unknown>;
    return {
      available: data.disponible !== false,
      approved: Boolean(data.aprobado),
      confianza: typeof data.confianza === "number" ? data.confianza : undefined,
      nivel: typeof data.nivel === "string" ? data.nivel : undefined,
      cedulaVigente: typeof data.cedulaVigente === "boolean" ? data.cedulaVigente : undefined,
      nombreRegistrado: typeof data.nombreRegistrado === "string" ? data.nombreRegistrado : undefined,
      faceMatch: typeof data.faceMatch === "boolean" ? data.faceMatch : undefined,
      liveness: typeof data.liveness === "boolean" ? data.liveness : undefined,
      score: typeof data.score === "number" ? data.score : undefined,
      factores: Array.isArray(data.factores) ? (data.factores as IdentityFactor[]) : undefined,
      token: typeof data.token === "string" ? data.token : undefined,
      advertencias: Array.isArray(data.advertencias) ? (data.advertencias.filter((x) => typeof x === "string") as string[]) : undefined,
    };
  } catch (err) {
    return { available: false, approved: false, error: err instanceof Error ? err.message : "network_error" };
  }
}
