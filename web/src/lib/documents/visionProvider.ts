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
  const visionKey = process.env.AI_VISION_API_KEY?.trim();
  const visionBase = process.env.AI_VISION_BASE_URL?.trim();
  const visionModel = process.env.AI_VISION_MODEL?.trim();
  // ¿Se configuró un proveedor de visión aparte? (cualquiera de las tres variables)
  const usingCustom = Boolean(visionKey || visionBase || visionModel);

  const apiKey = visionKey || process.env.AI_API_KEY?.trim() || "";
  const baseUrl = (visionBase || process.env.AI_BASE_URL?.trim() || "https://api.groq.com/openai/v1").replace(/\/$/, "");

  let models: string[];
  if (usingCustom) {
    // Proveedor propio: usar SOLO modelos válidos para ESE proveedor. NO mezclar
    // modelos de Groq (darían 404 en Gemini/OpenAI).
    const isGemini = baseUrl.includes("generativelanguage.googleapis.com");
    if (isGemini) {
      // Se prueba el configurado primero, luego alias/modelos VIGENTES (Google retira
      // periódicamente 1.5/2.0). "gemini-flash-latest" apunta siempre al flash actual.
      models = [
        ...new Set(
          [visionModel, "gemini-flash-latest", "gemini-2.5-flash", "gemini-2.0-flash"].filter(Boolean) as string[],
        ),
      ];
    } else {
      models = [...new Set([visionModel || "gpt-4o-mini", "gpt-4o-mini"].filter(Boolean) as string[])];
    }
  } else {
    // Por defecto (Groq): modelos de visión de Groq.
    models = ["meta-llama/llama-4-scout-17b-16e-instruct", "meta-llama/llama-4-maverick-17b-128e-instruct"];
  }
  return { apiKey, baseUrl, models };
}

/** ¿Hay una clave de visión disponible? */
export function hasVisionKey(): boolean {
  return Boolean(process.env.AI_VISION_API_KEY?.trim() || process.env.AI_API_KEY?.trim());
}
