import { NextResponse } from "next/server";
import { getStorage } from "firebase-admin/storage";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireInventoryParticipant } from "@/lib/auth/requireInventoryParticipant";
import { isAllowedSupportMagic, sanitizeSupportFileName } from "@/domain/payments/supportValidation";

export const runtime = "nodejs";

/**
 * Subida DIRECTA (proxy) de una foto de zona del inventario: el navegador envía
 * el archivo a NUESTRA API (same-origin, sin URL firmada ni CORS) y el servidor
 * lo guarda con el Admin SDK. Reemplaza el PUT del navegador contra Storage, que
 * fallaba con "error de red" (CORS) y dejaba las fotos sin guardar.
 * El archivo va como cuerpo binario (raw); los metadatos por query params.
 */
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024;

function err(message: string, status = 422, field = "body") {
  return NextResponse.json({ success: false, errors: [{ field, message }] }, { status });
}
function sanitizeZone(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

export async function POST(request: Request) {
  try {
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET?.trim();
    if (!bucketName) return err("Storage no configurado.", 503, "server");
    const firestore = getAdminFirestore();
    if (!firestore) return err("Firestore no configurado.", 503, "server");

    const url = new URL(request.url);
    const inventoryId = url.searchParams.get("inventoryId") ?? "";
    const selectedZoneId = url.searchParams.get("selectedZoneId") ?? "";
    const filename = url.searchParams.get("filename") ?? "foto.jpg";
    const contentType = url.searchParams.get("contentType") || request.headers.get("content-type") || "image/jpeg";
    if (!inventoryId || !selectedZoneId) return err("Datos inválidos.");
    if (!ALLOWED.includes(contentType)) return err("La foto debe ser JPG, PNG o WEBP.");

    const gate = await requireInventoryParticipant(request, firestore, inventoryId);
    if (!gate.ok) return gate.response;

    const buf = Buffer.from(await request.arrayBuffer());
    if (buf.length === 0) return err("La foto llegó vacía. Intenta de nuevo.");
    if (buf.length > MAX_BYTES) return err("La foto supera el máximo de 10 MB.");
    if (!isAllowedSupportMagic(new Uint8Array(buf.subarray(0, 16)))) {
      return err("El archivo no es una imagen válida (JPG/PNG/WEBP).", 422, "file");
    }

    const objectPath = `inventories/${inventoryId}/zones/${sanitizeZone(selectedZoneId)}/${Date.now()}-${sanitizeSupportFileName(filename)}`;
    const storagePath = `gs://${bucketName}/${objectPath}`;
    await getStorage().bucket(bucketName).file(objectPath).save(buf, { contentType, resumable: false, metadata: { contentType } });

    return NextResponse.json({ success: true, storagePath });
  } catch (e) {
    return NextResponse.json(
      { success: false, errors: [{ field: "server", message: "No se pudo subir la foto en el servidor." }], detail: e instanceof Error ? e.message.slice(0, 200) : "error" },
      { status: 500 },
    );
  }
}
