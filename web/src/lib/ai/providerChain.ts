import "server-only";

/**
 * Cadena de proveedores de IA con RESPALDO y ESCALAMIENTO (tipo OpenRouter, pero
 * directo a cada proveedor para aprovechar sus capas GRATIS reales):
 *
 *   1) Groq   (GRATIS)  → GROQ_API_KEY  (o AI_API_KEY por compatibilidad)
 *   2) Gemini (GRATIS)  → GEMINI_API_KEY
 *   3) OpenAI (PAGO)    → OPENAI_API_KEY
 *
 * `chatWithFallback` intenta en ese orden y, además, VALIDA cada respuesta con un
 * criterio `accept` (p. ej. "el JSON trae datos"): si un proveedor falla, se cae
 * o entrega un resultado insuficiente, ESCALA al siguiente. Así SIEMPRE responde
 * con el mejor resultado disponible. Todos exponen API compatible con OpenAI
 * (`/chat/completions`), así que un solo cliente sirve para texto y visión.
 */
export type ChatProvider = {
  id: "groq" | "gemini" | "openai";
  baseUrl: string;
  apiKey: string;
  textModels: string[];
  visionModels: string[];
  paid: boolean;
};

function clean(...vals: (string | undefined)[]): string[] {
  return [...new Set(vals.map((v) => v?.trim()).filter(Boolean) as string[])];
}

/** Construye la cadena SOLO con los proveedores que tienen clave configurada. */
export function resolveChatProviders(): ChatProvider[] {
  const providers: ChatProvider[] = [];

  // 1) Groq (gratis). Compat: si solo existe AI_API_KEY, se trata como Groq.
  const groqKey = process.env.GROQ_API_KEY?.trim() || process.env.AI_API_KEY?.trim();
  if (groqKey) {
    providers.push({
      id: "groq",
      baseUrl: (process.env.GROQ_BASE_URL?.trim() || process.env.AI_BASE_URL?.trim() || "https://api.groq.com/openai/v1").replace(/\/$/, ""),
      apiKey: groqKey,
      textModels: clean(process.env.GROQ_MODEL, process.env.AI_MODEL, "llama-3.3-70b-versatile", "llama-3.1-8b-instant"),
      visionModels: clean(process.env.GROQ_VISION_MODEL, "meta-llama/llama-4-scout-17b-16e-instruct", "meta-llama/llama-4-maverick-17b-128e-instruct"),
      paid: false,
    });
  }

  // 2) Gemini (capa gratuita generosa; buena en visión).
  const gemKey = process.env.GEMINI_API_KEY?.trim();
  if (gemKey) {
    const gemModels = clean(process.env.GEMINI_MODEL, "gemini-flash-latest", "gemini-2.5-flash", "gemini-2.0-flash");
    providers.push({
      id: "gemini",
      baseUrl: (process.env.GEMINI_BASE_URL?.trim() || "https://generativelanguage.googleapis.com/v1beta/openai").replace(/\/$/, ""),
      apiKey: gemKey,
      textModels: gemModels,
      visionModels: gemModels,
      paid: false,
    });
  }

  // 3) OpenAI (pago; el mejor en visión).
  const oaKey = process.env.OPENAI_API_KEY?.trim();
  if (oaKey) {
    providers.push({
      id: "openai",
      baseUrl: (process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/$/, ""),
      apiKey: oaKey,
      textModels: clean(process.env.OPENAI_MODEL, "gpt-4o-mini"),
      visionModels: clean(process.env.OPENAI_VISION_MODEL, process.env.OPENAI_MODEL, "gpt-4o-mini"),
      paid: true,
    });
  }

  return providers;
}

/** ¿Hay al menos un proveedor de IA configurado? */
export function hasAnyAiProvider(): boolean {
  return resolveChatProviders().length > 0;
}

type ChatMessage = { role: "system" | "user" | "assistant"; content: unknown };

export type ChatResult =
  | { ok: true; content: string; providerId: string; model: string }
  | { ok: false; reason: "no_provider" | "all_failed"; detail: string };

/**
 * Llama a la cadena de proveedores en orden y devuelve la PRIMERA respuesta que
 * pase `accept`. Escala de proveedor y de modelo ante error, respuesta vacía o
 * resultado insuficiente. Nunca lanza.
 */
export async function chatWithFallback(opts: {
  messages: ChatMessage[];
  vision?: boolean;
  jsonMode?: boolean;
  temperature?: number;
  maxTokens?: number;
  /** Devuelve true si el contenido es ACEPTABLE; si no, escala al siguiente. */
  accept?: (content: string) => boolean;
}): Promise<ChatResult> {
  const providers = resolveChatProviders();
  if (providers.length === 0) return { ok: false, reason: "no_provider", detail: "sin AI_API_KEY/GROQ/GEMINI/OPENAI" };

  let lastDetail = "sin respuesta";
  for (const p of providers) {
    const models = opts.vision ? p.visionModels : p.textModels;
    for (const model of models) {
      try {
        const res = await fetch(`${p.baseUrl}/chat/completions`, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${p.apiKey}` },
          cache: "no-store",
          body: JSON.stringify({
            model,
            temperature: opts.temperature ?? 0.3,
            max_tokens: opts.maxTokens ?? 512,
            ...(opts.jsonMode ? { response_format: { type: "json_object" } } : {}),
            messages: opts.messages,
          }),
        });
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          lastDetail = `HTTP ${res.status} (${p.id}/${model}): ${body.slice(0, 160)}`;
          // Clave inválida de ESE proveedor → no insistir con sus otros modelos.
          if (res.status === 401 || res.status === 403) break;
          continue;
        }
        const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        const content = (json.choices?.[0]?.message?.content ?? "").trim();
        if (!content) {
          lastDetail = `respuesta vacía (${p.id}/${model})`;
          continue;
        }
        if (opts.accept && !opts.accept(content)) {
          lastDetail = `resultado insuficiente (${p.id}/${model})`;
          continue; // escala buscando mejor resultado
        }
        return { ok: true, content, providerId: p.id, model };
      } catch (e) {
        lastDetail = `red (${p.id}/${model}): ${e instanceof Error ? e.message : "error"}`;
      }
    }
  }
  return { ok: false, reason: "all_failed", detail: lastDetail };
}
