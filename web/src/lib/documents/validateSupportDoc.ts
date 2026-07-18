import "server-only";
import { extractDocContent } from "@/lib/documents/extractDocContent";
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
  status: "match" | "mismatch" | "wrong_type" | "unreadable" | "skipped" | "unsupported";
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
  isImage: boolean,
  promptText: string,
  imageDataUrl: string | null,
): Promise<{ names: string[]; documentNumber: string; docKindMatches: boolean | null } | null> {
  const baseUrl = (process.env.AI_BASE_URL?.trim() || "https://api.groq.com/openai/v1").replace(/\/$/, "");
  const candidates = isImage
    ? ([...new Set(([process.env.AI_VISION_MODEL?.trim(), "meta-llama/llama-4-scout-17b-16e-instruct", "meta-llama/llama-4-maverick-17b-128e-instruct"].filter(Boolean)) as string[])])
    : ([...new Set(([process.env.AI_MODEL?.trim(), "llama-3.3-70b-versatile", "llama-3.1-8b-instant"].filter(Boolean)) as string[])]);
  const messages = isImage
    ? [{ role: "user", content: [{ type: "text", text: promptText }, { type: "image_url", image_url: { url: imageDataUrl } }] }]
    : [{ role: "user", content: promptText }];

  for (const model of candidates) {
    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
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
  bytes: Buffer;
  contentType: string;
  fileName: string;
  docKey: string;
  expectedName?: string;
  expectedDocNumber?: string;
}): Promise<SupportValidation> {
  const spec = getDocValidationSpec(params.docKey);
  if (!spec) return { status: "skipped", reason: "no_spec" };

  const apiKey = process.env.AI_API_KEY?.trim();
  if (!apiKey) return { status: "skipped", reason: "ai_off", label: spec.label };

  const extracted = await extractDocContent(params.bytes, params.contentType, params.fileName);
  if (extracted.kind === "unsupported") return { status: "skipped", reason: extracted.reason, label: spec.label };

  const prompt =
    `Eres un extractor de datos de documentos colombianos. Este documento DEBERÍA ser: ${spec.typeDescription}. ` +
    `Devuelve EXCLUSIVAMENTE un JSON con la forma ` +
    `{"names": ["..."], "documentNumber": "...", "docKindMatches": true|false} donde: ` +
    `"names" son los nombres del TITULAR de la persona; ` +
    `"documentNumber" es el número de identificación/NIT/matrícula si aplica (solo dígitos, o cadena vacía); ` +
    `"docKindMatches" indica si el documento realmente ES del tipo descrito. No agregues texto adicional.` +
    (extracted.kind === "text" ? `\n\nTEXTO DEL DOCUMENTO:\n"""\n${extracted.text}\n"""` : "");

  const ai = await callAi(apiKey, extracted.kind === "image", prompt, extracted.kind === "image" ? extracted.imageDataUrl : null);
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
  const nameStatus: MatchVerdict = spec.comparesName && params.expectedName
    ? (ai.names.length > 0 ? nameMatches(params.expectedName, ai.names) : "unclear")
    : "match";
  const docNumberStatus: MatchVerdict = spec.comparesDocNumber && params.expectedDocNumber
    ? documentNumberMatches(params.expectedDocNumber, ai.documentNumber)
    : "match";

  const status =
    nameStatus === "mismatch" || docNumberStatus === "mismatch"
      ? "mismatch"
      : nameStatus === "match"
        ? "match"
        : "unreadable";

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
