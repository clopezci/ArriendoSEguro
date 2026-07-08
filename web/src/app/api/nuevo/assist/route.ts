import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";

export const runtime = "nodejs";

/**
 * Asistente IA (opcional) del flujo nuevo. Provider-agnóstico: usa cualquier API
 * compatible con OpenAI (Groq gratis, HuggingFace router, OpenAI, Together…) vía
 * variables de entorno:
 *   - AI_API_KEY   (obligatoria para activarlo; sin ella, `available:false`)
 *   - AI_BASE_URL  (por defecto Groq: https://api.groq.com/openai/v1)
 *   - AI_MODEL     (por defecto llama-3.1-8b-instant)
 * Dos modos:
 *   - "extract": de texto libre saca los datos del contrato (JSON) para
 *     pre-llenar. El usuario SIEMPRE revisa y la validación por paso sigue viva.
 *   - "ask": explica en lenguaje simple una duda del arriendo/cláusula.
 * NUNCA se usa para lógica legal crítica; solo asiste.
 */
const schema = z.object({ mode: z.enum(["extract", "ask"]), text: z.string().min(1).max(2000) });

const EXTRACT_SYSTEM =
  "Eres un asistente que extrae datos para un contrato de arrendamiento de vivienda en Colombia. " +
  "Devuelve EXCLUSIVAMENTE un JSON con estas claves (usa cadena vacía si el dato no se menciona, no inventes): " +
  "name (nombre del arrendador/dueño), docType (uno de: CC, CE, NIT, Pasaporte), docNumber, phone (10 dígitos), " +
  "email, address (dirección del inmueble), city, canon (solo el número, sin puntos ni símbolos), " +
  "tenantName (nombre del arrendatario/inquilino), hasCodebtor ('yes' si mencionan codeudor, 'no' si dicen que no, '' si no se sabe), codebtorName.";

const ASK_SYSTEM =
  "Responde en español claro y breve (máximo 3 frases), sin jerga legal, sobre contratos de arrendamiento entre " +
  "particulares en Colombia. Si preguntan por una cláusula o término, explícalo de forma simple. No des asesoría " +
  "legal definitiva; sugiere validar con un abogado cuando el caso sea delicado.";

/** Extrae el bloque JSON de la respuesta (quita ```fences``` y texto alrededor). */
function extractJsonBlock(s: string): string {
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fence ? fence[1] : s;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  return start >= 0 && end > start ? raw.slice(start, end + 1) : raw;
}

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;

  const apiKey = process.env.AI_API_KEY?.trim();
  if (!apiKey) {
    // No configurado: el cliente muestra una nota, sin romper el flujo.
    return NextResponse.json({ success: true, available: false });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "invalid_input" }, { status: 422 });
  }

  const baseUrl = (process.env.AI_BASE_URL?.trim() || "https://api.groq.com/openai/v1").replace(/\/$/, "");
  const model = process.env.AI_MODEL?.trim() || "llama-3.1-8b-instant";
  const isExtract = parsed.data.mode === "extract";

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      cache: "no-store",
      body: JSON.stringify({
        model,
        temperature: isExtract ? 0 : 0.4,
        max_tokens: isExtract ? 500 : 220,
        messages: [
          { role: "system", content: isExtract ? EXTRACT_SYSTEM : ASK_SYSTEM },
          { role: "user", content: parsed.data.text },
        ],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return NextResponse.json(
        { success: false, available: true, error: "provider_error", detail: `HTTP ${res.status}: ${body.slice(0, 220)}` },
        { status: 502 },
      );
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = json.choices?.[0]?.message?.content ?? "";

    if (isExtract) {
      let data: Record<string, unknown> = {};
      try {
        data = JSON.parse(extractJsonBlock(content)) as Record<string, unknown>;
      } catch {
        return NextResponse.json(
          { success: false, available: true, error: "parse_error", detail: content.slice(0, 220) },
          { status: 502 },
        );
      }
      return NextResponse.json({ success: true, available: true, data });
    }
    return NextResponse.json({ success: true, available: true, answer: content.trim() });
  } catch {
    return NextResponse.json({ success: false, available: true, error: "network_error" }, { status: 502 });
  }
}
