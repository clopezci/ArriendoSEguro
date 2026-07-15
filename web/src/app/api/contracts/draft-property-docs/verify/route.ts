import { NextResponse } from "next/server";
import { z } from "zod";
import { getStorage } from "firebase-admin/storage";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { DRAFT_PROPERTY_DOCS_COLLECTION } from "@/domain/contracts/draftPropertyDocs";

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
  "Eres un extractor de datos. La imagen es un documento colombiano que soporta la propiedad de un inmueble " +
  "(certificado de tradición y libertad, recibo de servicios públicos, impuesto predial o escritura pública). " +
  'Devuelve EXCLUSIVAMENTE un JSON con la forma {"names": ["..."]} que contenga el/los nombre(s) del PROPIETARIO ' +
  "o TITULAR tal como aparecen en el documento. No incluyas direcciones, números ni texto adicional. " +
  'Si el documento es ilegible o no encuentras un nombre, devuelve {"names": []}.';

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
  const isImage = contentType.startsWith("image/") || /\.(jpe?g|png|webp)$/.test(fileName);
  if (!isImage) {
    // Los modelos de visión no leen PDF directamente; no bloqueamos.
    return NextResponse.json({ success: true, available: true, status: "skipped", reason: "pdf" });
  }

  // Descarga los bytes y arma el data URL (tope de tamaño para el proveedor).
  const gsPrefix = `gs://${bucketName}/`;
  const objectPath = (latest.storagePath ?? "").startsWith(gsPrefix) ? (latest.storagePath ?? "").slice(gsPrefix.length) : "";
  if (!objectPath) return NextResponse.json({ success: true, available: true, status: "skipped", reason: "no_doc" });

  let dataUrl = "";
  try {
    const [buf] = await getStorage().bucket(bucketName).file(objectPath).download();
    if (buf.length > 4 * 1024 * 1024) {
      return NextResponse.json({ success: true, available: true, status: "skipped", reason: "too_large" });
    }
    const mime = contentType.startsWith("image/") ? contentType : fileName.endsWith(".png") ? "image/png" : fileName.endsWith(".webp") ? "image/webp" : "image/jpeg";
    dataUrl = `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return NextResponse.json({ success: true, available: true, status: "skipped", reason: "download_error" });
  }

  const baseUrl = (process.env.AI_BASE_URL?.trim() || "https://api.groq.com/openai/v1").replace(/\/$/, "");
  const candidates = [
    ...new Set(
      ([process.env.AI_VISION_MODEL?.trim(), "meta-llama/llama-4-scout-17b-16e-instruct", "meta-llama/llama-4-maverick-17b-128e-instruct"].filter(Boolean)) as string[],
    ),
  ];

  for (const model of candidates) {
    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        cache: "no-store",
        body: JSON.stringify({
          model,
          temperature: 0,
          max_tokens: 300,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: VISION_PROMPT },
                { type: "image_url", image_url: { url: dataUrl } },
              ],
            },
          ],
        }),
      });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) break; // key inválida
        continue; // prueba el siguiente modelo
      }
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const content = json.choices?.[0]?.message?.content ?? "";
      let names: string[] = [];
      try {
        const obj = JSON.parse(extractJsonBlock(content)) as { names?: unknown };
        if (Array.isArray(obj.names)) names = obj.names.filter((x): x is string => typeof x === "string").slice(0, 10);
      } catch {
        continue;
      }
      if (names.length === 0) {
        return NextResponse.json({ success: true, available: true, status: "unreadable" });
      }
      const status = nameMatches(expectedName, names) ? "match" : "mismatch";
      return NextResponse.json({ success: true, available: true, status, names, expectedName });
    } catch {
      /* red: intenta el siguiente modelo */
    }
  }

  // Ningún modelo de visión respondió: no bloqueamos, lo cubre el juramento.
  return NextResponse.json({ success: true, available: true, status: "skipped", reason: "provider_error" });
}
