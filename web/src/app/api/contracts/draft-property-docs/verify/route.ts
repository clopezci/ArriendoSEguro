import { NextResponse } from "next/server";
import { z } from "zod";
import { getStorage } from "firebase-admin/storage";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { DRAFT_PROPERTY_DOCS_COLLECTION } from "@/domain/contracts/draftPropertyDocs";
import { addressMatches } from "@/domain/documents/documentMatch";
import { extractDocContent } from "@/lib/documents/extractDocContent";
import { getVisionProvider } from "@/lib/documents/visionProvider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Capa 2 (asistente, NO vinculante): revisa con IA de VISIÓN el documento de
 * propiedad subido por el dueño y estima si el/los titular(es) del documento
 * coinciden con el nombre esperado (el arrendador, o el poderdante si es
 * apoderado). Usa el MISMO proveedor gratuito ya configurado (Groq, compatible
 * OpenAI) con un modelo multimodal — misma AI_API_KEY, sin costo adicional.
 *
 * Nunca bloquea el flujo: la protección real es el juramento + exoneración
 * (capa 1). Este endpoint solo devuelve un estado orientativo:
 *   - "match"      el nombre esperado aparece en el documento
 *   - "mismatch"   se leyó el documento pero el nombre esperado NO aparece
 *   - "unreadable" no se pudo leer el nombre (foto borrosa, etc.)
 *   - "skipped"    no aplicable (PDF, sin nombre esperado, IA no configurada…)
 */
const schema = z.object({
  contractDraftId: z.string().min(1),
  expectedName: z.string().max(160).optional(),
  expectedAddress: z.string().max(200).optional(),
  actingAs: z.enum(["owner", "proxy"]).optional(),
});

/** Normaliza para comparar nombres: minúsculas, sin tildes, solo letras/espacios. */
function normalizeName(v: string): string {
  return (v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOPWORDS = new Set(["de", "del", "la", "las", "los", "y", "el", "san", "santa"]);

/** ¿El nombre esperado aparece razonablemente entre los nombres leídos? */
function nameMatches(expected: string, found: string[]): boolean {
  const expTokens = normalizeName(expected).split(" ").filter((t) => t.length >= 3 && !STOPWORDS.has(t));
  if (expTokens.length === 0) return false;
  const haystack = " " + found.map(normalizeName).join("  ") + " ";
  const hit = expTokens.filter((t) => haystack.includes(` ${t} `) || haystack.includes(` ${t}`)).length;
  // Coincidencia si al menos 2 tokens (o todos, si el nombre esperado es corto)
  // aparecen en el documento. Umbral conservador para no dar falsos positivos.
  const need = Math.min(expTokens.length, 2);
  return hit >= need;
}

const VISION_PROMPT =
  "Eres un validador de documentos colombianos que soportan la PROPIEDAD de un inmueble " +
  "(certificado de tradición y libertad, recibo de servicios públicos, impuesto predial o escritura pública). " +
  'Analiza el contenido y devuelve EXCLUSIVAMENTE un JSON con la forma ' +
  '{"isPropertyDoc": true, "names": ["..."], "address": "..."} donde: ' +
  '"isPropertyDoc" es true SOLO si el documento realmente es uno de esos tipos, y false si es cualquier otra cosa ' +
  "(una foto personal, una captura de pantalla, una cédula, un recibo que no es de servicios públicos, un documento no relacionado); " +
  '"names" son los nombres del PROPIETARIO o TITULAR; "address" es la DIRECCIÓN del inmueble. ' +
  "Si no aplica, usa lista vacía o cadena vacía. No agregues texto adicional.";

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
  if (!apiKey) return NextResponse.json({ success: true, available: false, status: "skipped", reason: "ai_off" });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, error: "invalid_input" }, { status: 422 });

  const expectedName = (parsed.data.expectedName ?? "").trim();
  const expectedAddress = (parsed.data.expectedAddress ?? "").trim();
  if (!expectedName) {
    // Apoderado sin nombre del poderdante capturado, u otro caso sin referencia:
    // no hay contra qué comparar; la declaración jurada (capa 1) cubre el caso.
    return NextResponse.json({ success: true, available: true, status: "skipped", reason: "no_expected" });
  }

  const firestore = getAdminFirestore();
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET?.trim();
  if (!firestore || !bucketName) return NextResponse.json({ success: true, available: true, status: "skipped", reason: "storage_off" });

  // Documento más reciente del borrador (del propio dueño).
  const snap = await firestore
    .collection(DRAFT_PROPERTY_DOCS_COLLECTION)
    .where("contractDraftId", "==", parsed.data.contractDraftId)
    .where("ownerUid", "==", auth.user.uid)
    .limit(50)
    .get()
    .catch(() => null);
  if (!snap || snap.empty) return NextResponse.json({ success: true, available: true, status: "skipped", reason: "no_doc" });

  const rows = snap.docs
    .map((d) => d.data() as { storagePath?: string; contentType?: string; fileName?: string; uploadedAt?: string })
    .sort((a, b) => (b.uploadedAt ?? "").localeCompare(a.uploadedAt ?? ""));
  const latest = rows[0];

  const contentType = (latest.contentType ?? "").toLowerCase();
  const fileName = (latest.fileName ?? "").toLowerCase();

  // Descarga el documento y extrae su contenido (imagen, o TEXTO de PDF/Word).
  const gsPrefix = `gs://${bucketName}/`;
  const objectPath = (latest.storagePath ?? "").startsWith(gsPrefix) ? (latest.storagePath ?? "").slice(gsPrefix.length) : "";
  if (!objectPath) return NextResponse.json({ success: true, available: true, status: "skipped", reason: "no_doc" });

  // Descargamos el archivo y usamos BASE64 (universal: lo aceptan OpenAI, Gemini
  // y Groq). Para PDF/Word extraemos el texto.
  let visionImageUrl: string | null = null;
  let textContent: string | null = null;
  try {
    const [buf] = await getStorage().bucket(bucketName).file(objectPath).download();
    const ex = await extractDocContent(buf, contentType, fileName);
    if (ex.kind === "image") visionImageUrl = ex.imageDataUrl;
    else if (ex.kind === "text") textContent = ex.text;
    else return NextResponse.json({ success: true, available: true, status: "skipped", reason: ex.reason });
  } catch {
    return NextResponse.json({ success: true, available: true, status: "skipped", reason: "download_error" });
  }

  const useVision = Boolean(visionImageUrl);
  const vision = getVisionProvider();
  const textBase = (process.env.AI_BASE_URL?.trim() || "https://api.groq.com/openai/v1").replace(/\/$/, "");
  const textModels = [...new Set(([process.env.AI_MODEL?.trim(), "llama-3.3-70b-versatile", "llama-3.1-8b-instant"].filter(Boolean)) as string[])];
  const baseUrl = useVision ? vision.baseUrl : textBase;
  const callKey = useVision ? vision.apiKey : apiKey;
  const candidates = useVision ? vision.models : textModels;
  const messages =
    useVision
      ? [{ role: "user", content: [{ type: "text", text: VISION_PROMPT }, { type: "image_url", image_url: { url: visionImageUrl } }] }]
      : [{ role: "user", content: `${VISION_PROMPT}\n\nTEXTO DEL DOCUMENTO:\n"""\n${textContent ?? ""}\n"""` }];

  let providerDetail = "";
  for (const model of candidates) {
    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${callKey}` },
        cache: "no-store",
        body: JSON.stringify({ model, temperature: 0, max_tokens: 300, messages }),
      });
      if (!res.ok) {
        providerDetail = `${res.status} ${model}: ${(await res.text().catch(() => "")).slice(0, 300)}`;
        if (process.env.NODE_ENV !== "production") console.error("property-doc verify provider", providerDetail);
        if (res.status === 401 || res.status === 403) break; // key inválida
        continue; // prueba el siguiente modelo
      }
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const content = json.choices?.[0]?.message?.content ?? "";
      let names: string[] = [];
      let address = "";
      let isPropertyDoc: boolean | null = null;
      try {
        const obj = JSON.parse(extractJsonBlock(content)) as { isPropertyDoc?: unknown; names?: unknown; address?: unknown };
        if (Array.isArray(obj.names)) names = obj.names.filter((x): x is string => typeof x === "string").slice(0, 10);
        if (typeof obj.address === "string") address = obj.address;
        if (typeof obj.isPropertyDoc === "boolean") isPropertyDoc = obj.isPropertyDoc;
      } catch {
        continue;
      }
      // El documento claramente NO es un soporte de propiedad → alerta fuerte.
      if (isPropertyDoc === false) {
        return NextResponse.json({
          success: true, available: true, status: "wrong_type",
          names, address, expectedName, expectedAddress: expectedAddress || undefined,
        });
      }
      if (names.length === 0 && !address) {
        return NextResponse.json({ success: true, available: true, status: "unreadable" });
      }
      // Veredicto por campo (nombre y, si se pasó, dirección). Rojo si CUALQUIERA
      // no coincide. Nunca bloquea: la declaración jurada es la protección real.
      const nameStatus = names.length > 0 ? (nameMatches(expectedName, names) ? "match" : "mismatch") : "unclear";
      const addressStatus = expectedAddress ? addressMatches(expectedAddress, address) : "match";
      const status =
        nameStatus === "mismatch" || addressStatus === "mismatch"
          ? "mismatch"
          : nameStatus === "match"
            ? "match"
            : "unreadable";
      return NextResponse.json({
        success: true,
        available: true,
        status,
        names,
        address,
        nameStatus,
        addressStatus,
        expectedName,
        expectedAddress: expectedAddress || undefined,
      });
    } catch (err) {
      providerDetail = err instanceof Error ? err.message : "network";
      /* red: intenta el siguiente modelo */
    }
  }

  // Ningún modelo respondió: no bloqueamos, lo cubre el juramento. Incluimos el
  // detalle del proveedor (útil para diagnosticar modelo caído / imagen inválida).
  return NextResponse.json({ success: true, available: true, status: "skipped", reason: "provider_error", providerDetail });
}
