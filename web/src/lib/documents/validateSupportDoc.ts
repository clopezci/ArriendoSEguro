import "server-only";
import { extractDocContent, type ExtractedContent } from "@/lib/documents/extractDocContent";
import { getVisionProvider } from "@/lib/documents/visionProvider";
import { buildUserContent, needsVision } from "@/lib/documents/visionMessage";
import { getDocValidationSpec } from "@/domain/documents/docValidationSpec";
import { nameMatches, documentNumberMatches, type MatchVerdict } from "@/domain/documents/documentMatch";

/**
 * Motor genérico de validación **antifraude asistiva** de un documento soporte.
 * Extrae con IA (texto para PDF/Word, visión para imagen) los datos del documento,
 * verifica que sea del **tipo correcto** (no cualquier papel con un nombre) y
 * compara nombre/número contra lo que se tecleó. Nunca bloquea: devuelve un
 * veredicto para pintar alerta ROJA de revisión.
 */
export type SupportValidation = {
  status: "match" | "mismatch" | "wrong_type" | "unreadable" | "unclear" | "skipped" | "unsupported";
  reason?: string;
  label?: string;
  names?: string[];
  detectedNumber?: string;
  nameStatus?: MatchVerdict;
  docNumberStatus?: MatchVerdict;
  kindOk?: boolean;
};

function extractJsonBlock(s: string): string {
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fence ? fence[1] : s;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  return start >= 0 && end > start ? raw.slice(start, end + 1) : raw;
}

async function callAi(
  apiKey: string,
  promptText: string,
  ex: ExtractedContent,
): Promise<{ names: string[]; documentNumber: string; docKindMatches: boolean | null } | null> {
  const useVision = needsVision(ex);
  const vision = useVision ? getVisionProvider() : null;
  const baseUrl = vision ? vision.baseUrl : (process.env.AI_BASE_URL?.trim() || "https://api.groq.com/openai/v1").replace(/\/$/, "");
  const callKey = vision ? vision.apiKey : apiKey;
  const candidates = vision
    ? vision.models
    : ([...new Set(([process.env.AI_MODEL?.trim(), "llama-3.3-70b-versatile", "llama-3.1-8b-instant"].filter(Boolean)) as string[])]);
  const messages = [{ role: "user", content: buildUserContent(promptText, ex) }];

  for (const model of candidates) {
    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${callKey}` },
        cache: "no-store",
        body: JSON.stringify({ model, temperature: 0, max_tokens: 300, messages }),
      });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) return null;
        continue;
      }
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const content = json.choices?.[0]?.message?.content ?? "";
      const obj = JSON.parse(extractJsonBlock(content)) as {
        names?: unknown;
        documentNumber?: unknown;
        docKindMatches?: unknown;
      };
      const names = Array.isArray(obj.names) ? obj.names.filter((x): x is string => typeof x === "string").slice(0, 10) : [];
      const documentNumber = typeof obj.documentNumber === "string" ? obj.documentNumber : "";
      const docKindMatches = typeof obj.docKindMatches === "boolean" ? obj.docKindMatches : null;
      return { names, documentNumber, docKindMatches };
    } catch {
      /* prueba el siguiente modelo */
    }
  }
  return null;
}

export async function validateSupportDoc(params: {
  bytes?: Buffer;
  contentType: string;
  fileName: string;
  docKey: string;
  expectedName?: string;
  expectedDocNumber?: string;
  /** URL (firmada) de la imagen: si viene, se pasa directo a la IA de visión y se
   * evita el base64 (que falla con fotos grandes de celular). */
  imageUrl?: string;
}): Promise<SupportValidation> {
  const spec = getDocValidationSpec(params.docKey);
  if (!spec) return { status: "skipped", reason: "no_spec" };

  const apiKey = process.env.AI_API_KEY?.trim();
  if (!apiKey) return { status: "skipped", reason: "ai_off", label: spec.label };

  // Imagen por URL firmada (preferido) → sin tope de base64. Si no, extrae del buffer.
  let ex: ExtractedContent;
  if (params.imageUrl && params.imageUrl.trim()) {
    ex = { kind: "image", imageDataUrl: params.imageUrl.trim(), mime: "image/jpeg" };
  } else if (params.bytes) {
    ex = await extractDocContent(params.bytes, params.contentType, params.fileName);
    if (ex.kind === "unsupported") return { status: "skipped", reason: ex.reason, label: spec.label };
  } else {
    return { status: "skipped", reason: "no_doc", label: spec.label };
  }

  const prompt =
    `Eres un extractor de datos de documentos colombianos. Este documento DEBERÍA ser: ${spec.typeDescription}. ` +
    `Devuelve EXCLUSIVAMENTE un JSON con la forma ` +
    `{"names": ["..."], "documentNumber": "...", "docKindMatches": true|false} donde: ` +
    `"names" son los nombres del TITULAR de la persona; ` +
    `"documentNumber" es el número de identificación/NIT/matrícula si aplica (solo dígitos, o cadena vacía); ` +
    `"docKindMatches" indica si el documento realmente ES del tipo descrito. No agregues texto adicional.`;

  const ai = await callAi(apiKey, prompt, ex);
  if (!ai) return { status: "skipped", reason: "provider_error", label: spec.label };

  if (ai.names.length === 0 && !ai.documentNumber && ai.docKindMatches === null) {
    return { status: "unreadable", label: spec.label };
  }

  // 1) Tipo de documento: si claramente NO es el tipo esperado → rojo "wrong_type".
  const kindOk = ai.docKindMatches !== false;
  if (spec.checksKind && ai.docKindMatches === false) {
    return { status: "wrong_type", label: spec.label, names: ai.names, detectedNumber: ai.documentNumber, kindOk: false };
  }

  // 2) Nombre y número contra lo tecleado.
  // SEGURIDAD: si el tipo de documento COMPARA nombre pero no hay nombre esperado
  // con qué comparar (payload incompleto o slot mal mapeado), NO damos "match"
  // (verde) por defecto: devolvemos "unclear" para forzar validación manual. Antes
  // esto pintaba verde y dejaba pasar documentos con nombre ajeno.
  const nameStatus: MatchVerdict = spec.comparesName
    ? params.expectedName
      ? ai.names.length > 0
        ? nameMatches(params.expectedName, ai.names)
        : "unclear"
      : "unclear"
    : "match";
  const docNumberStatus: MatchVerdict = spec.comparesDocNumber
    ? params.expectedDocNumber
      ? documentNumberMatches(params.expectedDocNumber, ai.documentNumber)
      : "unclear"
    : "match";

  const status: SupportValidation["status"] =
    nameStatus === "mismatch" || docNumberStatus === "mismatch"
      ? "mismatch"
      : nameStatus === "match"
        ? "match"
        : "unclear";

  return {
    status,
    label: spec.label,
    names: ai.names,
    detectedNumber: ai.documentNumber,
    nameStatus,
    docNumberStatus,
    kindOk,
  };
}
