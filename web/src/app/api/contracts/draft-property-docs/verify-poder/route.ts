import { NextResponse } from "next/server";
import { z } from "zod";
import { getStorage } from "firebase-admin/storage";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { DRAFT_PROPERTY_DOCS_COLLECTION } from "@/domain/contracts/draftPropertyDocs";
import { extractDocContent } from "@/lib/documents/extractDocContent";
import { chatWithFallback, hasAnyAiProvider } from "@/lib/ai/providerChain";
import { buildUserContent } from "@/lib/documents/visionMessage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Valida (asistente, NO vinculante) que el PODER subido por el apoderado sea
 * realmente un documento legal (poder/autorización), y no una foto personal u
 * otro archivo cualquiera. Devuelve:
 *   - "match"      parece un documento/poder
 *   - "wrong_type" claramente NO es un documento (p. ej. una selfie)
 *   - "unreadable" no se pudo leer
 *   - "skipped"    no aplica (IA off, sin doc, PDF escaneado…)
 */
const schema = z.object({ contractDraftId: z.string().min(1) });

const POWER_PROMPT =
  "Eres un validador de documentos. Indica si el contenido corresponde a un PODER o AUTORIZACIÓN: un documento " +
  "legal (usualmente notarial o firmado) que faculta a una persona para actuar a nombre de otra, o un documento " +
  "formal equivalente. NO es válido si es una foto personal, una captura de pantalla, un meme, o algo no relacionado. " +
  'Devuelve EXCLUSIVAMENTE un JSON con la forma {"isPoder": true|false}. No agregues texto adicional.';

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

  if (!hasAnyAiProvider()) return NextResponse.json({ success: true, available: false, status: "skipped", reason: "ai_off" });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, error: "invalid_input" }, { status: 422 });

  const firestore = getAdminFirestore();
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET?.trim();
  if (!firestore || !bucketName) return NextResponse.json({ success: true, available: true, status: "skipped", reason: "storage_off" });

  const snap = await firestore
    .collection(DRAFT_PROPERTY_DOCS_COLLECTION)
    .where("contractDraftId", "==", parsed.data.contractDraftId)
    .where("ownerUid", "==", auth.user.uid)
    .where("docType", "==", "poder")
    .limit(50)
    .get()
    .catch(() => null);
  if (!snap || snap.empty) return NextResponse.json({ success: true, available: true, status: "skipped", reason: "no_doc" });

  const rows = snap.docs
    .map((d) => d.data() as { storagePath?: string; contentType?: string; fileName?: string; uploadedAt?: string })
    .sort((a, b) => (b.uploadedAt ?? "").localeCompare(a.uploadedAt ?? ""));
  const latest = rows[0];

  const gsPrefix = `gs://${bucketName}/`;
  const objectPath = (latest.storagePath ?? "").startsWith(gsPrefix) ? (latest.storagePath ?? "").slice(gsPrefix.length) : "";
  if (!objectPath) return NextResponse.json({ success: true, available: true, status: "skipped", reason: "no_doc" });

  let extracted: Awaited<ReturnType<typeof extractDocContent>>;
  try {
    const [buf] = await getStorage().bucket(bucketName).file(objectPath).download();
    extracted = await extractDocContent(buf, (latest.contentType ?? "").toLowerCase(), (latest.fileName ?? "").toLowerCase());
  } catch {
    return NextResponse.json({ success: true, available: true, status: "skipped", reason: "download_error" });
  }
  if (extracted.kind === "unsupported") {
    return NextResponse.json({ success: true, available: true, status: "skipped", reason: extracted.reason });
  }
  const parsePoder = (content: string): boolean | null | undefined => {
    try {
      const obj = JSON.parse(extractJsonBlock(content)) as { isPoder?: unknown };
      return typeof obj.isPoder === "boolean" ? obj.isPoder : null;
    } catch {
      return undefined; // no parseó → escala
    }
  };

  // Cadena con respaldo/escalamiento: Groq (gratis) → Gemini (gratis) → OpenAI (pago).
  const result = await chatWithFallback({
    vision: true,
    temperature: 0,
    maxTokens: 60,
    accept: (content) => parsePoder(content) !== undefined,
    messages: [{ role: "user", content: buildUserContent(POWER_PROMPT, extracted) }],
  });
  if (!result.ok) return NextResponse.json({ success: true, available: true, status: "skipped", reason: "provider_error", providerDetail: result.detail });

  const isPoder = parsePoder(result.content);
  if (isPoder === false) return NextResponse.json({ success: true, available: true, status: "wrong_type" });
  if (isPoder === true) return NextResponse.json({ success: true, available: true, status: "match" });
  return NextResponse.json({ success: true, available: true, status: "unreadable" });
}
