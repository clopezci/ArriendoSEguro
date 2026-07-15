import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { validatePaymentSupportFile, sanitizeSupportFileName, isAllowedSupportMagic } from "@/domain/payments/supportValidation";
import { DRAFT_PROPERTY_DOCS_COLLECTION, DRAFT_PROPERTY_DOC_MAX, draftPropertyDocPrefix, isPropertyDocType } from "@/domain/contracts/draftPropertyDocs";
import { checkRateLimit, RATE_LIMIT_RULES, tooManyRequestsJson, clientIpFromRequest } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

/**
 * Subida DIRECTA (proxy) del documento de propiedad: el navegador envía el
 * archivo a NUESTRA API (same-origin, sin CORS ni URL firmada) y el servidor lo
 * guarda en Storage con el Admin SDK. Reemplaza el trío sign→PUT→submit para
 * evitar el "error de red" del PUT del navegador contra Storage. Siempre
 * responde JSON (nunca HTML), incluso ante error.
 *
 * El archivo va como cuerpo binario (raw). Los metadatos van por query params.
 */
const MAX_BYTES = 5 * 1024 * 1024;

function err(message: string, status = 422, field = "body") {
  return NextResponse.json({ success: false, errors: [{ field, message }] }, { status });
}

export async function POST(request: Request) {
  try {
    const rl = await checkRateLimit(clientIpFromRequest(request), RATE_LIMIT_RULES.signatureOtp);
    if (!rl.ok) {
      const t = tooManyRequestsJson(rl.retryAfterSeconds);
      return NextResponse.json(t.body, { status: 429, headers: t.headers });
    }
    const auth = await requireAuthenticatedUser(request);
    if (!auth.ok) return auth.response;

    const bucketName = process.env.FIREBASE_STORAGE_BUCKET?.trim();
    if (!bucketName) return err("Storage no configurado.", 503, "server");
    const firestore = getAdminFirestore();
    if (!firestore) return err("Firestore no configurado.", 503, "server");

    const url = new URL(request.url);
    const contractDraftId = url.searchParams.get("contractDraftId") ?? "";
    const docType = url.searchParams.get("docType") ?? "";
    const filename = url.searchParams.get("filename") ?? "documento";
    const contentType = url.searchParams.get("contentType") || request.headers.get("content-type") || "application/octet-stream";
    if (!contractDraftId || !isPropertyDocType(docType)) return err("Datos inválidos.");

    const buf = Buffer.from(await request.arrayBuffer());
    if (buf.length === 0) return err("El archivo llegó vacío. Intenta de nuevo.");
    if (buf.length > MAX_BYTES) return err("El archivo supera el máximo de 5 MB.");

    // Mismas reglas de validación (tamaño/tipo/nombre) que el resto de soportes.
    const v = validatePaymentSupportFile({ supportFileName: filename, supportFileType: contentType, supportFileSize: buf.length });
    if (!v.ok) return NextResponse.json({ success: false, errors: v.errors }, { status: 422 });
    // Verificación de magic bytes: el contenido real debe ser PDF/JPG/PNG/WEBP.
    if (!isAllowedSupportMagic(new Uint8Array(buf.subarray(0, 16)))) {
      return err("El archivo no es un documento válido (PDF/JPG/PNG/WEBP).", 422, "file");
    }

    // Límite por borrador.
    const existing = await firestore
      .collection(DRAFT_PROPERTY_DOCS_COLLECTION)
      .where("contractDraftId", "==", contractDraftId)
      .where("ownerUid", "==", auth.user.uid)
      .limit(DRAFT_PROPERTY_DOC_MAX + 1)
      .get()
      .catch(() => null);
    if (existing && existing.size >= DRAFT_PROPERTY_DOC_MAX) {
      return err(`Máximo ${DRAFT_PROPERTY_DOC_MAX} documentos.`, 422, "limit");
    }

    const objectPath = `${draftPropertyDocPrefix(contractDraftId)}${Date.now()}-${sanitizeSupportFileName(filename)}`;
    const storagePath = `gs://${bucketName}/${objectPath}`;
    await getStorage().bucket(bucketName).file(objectPath).save(buf, { contentType, resumable: false, metadata: { contentType } });

    const now = new Date().toISOString();
    const ref = firestore.collection(DRAFT_PROPERTY_DOCS_COLLECTION).doc();
    await ref.set({
      id: ref.id,
      contractDraftId,
      ownerUid: auth.user.uid,
      docType,
      storagePath,
      fileName: filename,
      contentType,
      sizeBytes: buf.length,
      uploadedAt: now,
      createdAtServer: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true, id: ref.id });
  } catch (e) {
    // Nunca devolvemos HTML: el cliente parsea JSON y mostraría "error de red".
    return NextResponse.json(
      { success: false, errors: [{ field: "server", message: "No se pudo subir el documento en el servidor." }], detail: e instanceof Error ? e.message.slice(0, 200) : "error" },
      { status: 500 },
    );
  }
}
