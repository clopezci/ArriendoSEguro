import "server-only";

/**
 * Proveedor de IA de VISIÓN (lectura de imágenes de documentos). Configurable
 * aparte del texto para poder usar un proveedor CONFIABLE de visión sin cambiar
 * el de texto.
 *
 * Variables (en orden de preferencia; si no hay específicas de visión, cae a las
 * generales de IA / Groq):
 *   AI_VISION_API_KEY     clave del proveedor de visión (p. ej. OpenAI o Gemini)
 *   AI_VISION_BASE_URL    base OpenAI-compatible del proveedor de visión
 *   AI_VISION_MODEL       modelo de visión a usar
 *
 * Ejemplos recomendados (visión confiable):
 *   OpenAI:  AI_VISION_BASE_URL=https://api.openai.com/v1        · AI_VISION_MODEL=gpt-4o-mini
 *   Gemini:  AI_VISION_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
 *            · AI_VISION_MODEL=gemini-2.0-flash   (capa gratuita generosa)
 */
export type VisionProvider = { apiKey: string; baseUrl: string; models: string[] };

export function getVisionProvider(): VisionProvider {
  const apiKey = process.env.AI_VISION_API_KEY?.trim() || process.env.AI_API_KEY?.trim() || "";
  const baseUrl = (
    process.env.AI_VISION_BASE_URL?.trim() ||
    process.env.AI_BASE_URL?.trim() ||
    "https://api.groq.com/openai/v1"
  ).replace(/\/$/, "");
  const models = [
    ...new Set(
      [
        process.env.AI_VISION_MODEL?.trim(),
        // Defaults de Groq (por si no se configura un proveedor de visión aparte).
        "meta-llama/llama-4-scout-17b-16e-instruct",
        "meta-llama/llama-4-maverick-17b-128e-instruct",
      ].filter(Boolean) as string[],
    ),
  ];
  return { apiKey, baseUrl, models };
}

/** ¿Hay una clave de visión disponible? */
export function hasVisionKey(): boolean {
  return Boolean(process.env.AI_VISION_API_KEY?.trim() || process.env.AI_API_KEY?.trim());
}
