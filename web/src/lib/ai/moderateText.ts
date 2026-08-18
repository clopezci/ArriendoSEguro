import "server-only";
import { chatWithFallback } from "@/lib/ai/providerChain";

/**
 * Moderación de texto libre con la cadena de IA (Groq→Gemini→OpenAI). Detecta
 * groserías, insultos, obscenidades, contenido sexual explícito, amenazas o
 * discurso de odio para BLOQUEAR el envío (p. ej. en la réplica de una
 * calificación). Es fail-open: si la IA no está disponible, NO bloquea (para no
 * impedir un derecho legal como la réplica); el resto de controles (motivo
 * cerrado, longitud) siguen aplicando.
 */
export async function moderateFreeText(text: string): Promise<{ allowed: boolean; reason?: string }> {
  const t = (text ?? "").trim();
  if (!t) return { allowed: true };
  const res = await chatWithFallback({
    jsonMode: true,
    temperature: 0,
    maxTokens: 120,
    messages: [
      {
        role: "system",
        content:
          "Eres un moderador de contenido en español. Analiza el TEXTO del usuario y determina si contiene lenguaje " +
          "ofensivo: groserías/insultos, obscenidades, contenido sexual explícito, amenazas, acoso o discurso de odio " +
          "(por raza, género, religión, etc.). La crítica respetuosa o el desacuerdo NO son ofensivos. Responde ÚNICAMENTE " +
          'un JSON: {"offensive": true|false, "reason": "<motivo breve en español>"}.',
      },
      { role: "user", content: t.slice(0, 2000) },
    ],
    accept: (c) => c.toLowerCase().includes("offensive"),
  });
  if (!res.ok) return { allowed: true }; // fail-open: la IA no debe bloquear un derecho legal
  try {
    const j = JSON.parse(res.content) as { offensive?: boolean; reason?: string };
    return { allowed: !j.offensive, reason: j.reason };
  } catch {
    return { allowed: true };
  }
}
