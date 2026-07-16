import { NextResponse } from "next/server";
import { getStorage } from "firebase-admin/storage";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireContractParticipant } from "@/lib/auth/serverAuth";
import { auditEvent } from "@/features/contracts/audit-server";
import { sanitizeSupportFileName, isAllowedSupportMagic } from "@/domain/payments/supportValidation";

export const runtime = "nodejs";

/**
 * Subida DIRECTA (proxy) de la imagen del QR de pago: el navegador envía el
 * archivo a NUESTRA API (same-origin, sin CORS ni URL firmada) y el servidor lo
 * guarda en Storage con el Admin SDK. Reemplaza el PUT del navegador contra la
 * URL firmada (que fallaba con "error de red" / no cargaba la vista previa).
 * El archivo va como cuerpo binario (raw); los metadatos por query params.
 */
const ALLOWED = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

function err(message: string, status = 422, field = "body") {
  return NextResponse.json({ success: false, errors: [{ field, message }] }, { status });
}

export async function POST(request: Request) {
  try {
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET?.trim();
    if (!bucketName) return err("Storage no configurado.", 503, "server");
    const firestore = getAdminFirestore();
    if (!firestore) return err("Firestore no configurado.", 503, "server");

    const url = new URL(request.url);
    const contractId = url.searchParams.get("contractId") ?? "";
    const filename = url.searchParams.get("filename") ?? "qr";
    const contentType = url.searchParams.get("contentType") || request.headers.get("content-type") || "image/png";
    if (!contractId) return err("Falta el contrato.");
    if (!ALLOWED.includes(contentType)) return err("El QR debe ser PNG, JPG o WEBP.");

    // Solo el arrendador del contrato puede subir el QR.
    const participant = await requireContractParticipant(request, firestore, contractId, { kind: "current" });
    if (!participant.ok) return participant.response;
    if (participant.role !== "landlord") return err("Solo el arrendador puede subir el QR.", 403, "auth");

    const buf = Buffer.from(await request.arrayBuffer());
    if (buf.length === 0) return err("La imagen llegó vacía. Intenta de nuevo.");
    if (buf.length > MAX_BYTES) return err("La imagen supera el máximo de 5 MB.");
    if (!isAllowedSupportMagic(new Uint8Array(buf.subarray(0, 16)))) {
      return err("El archivo no es una imagen válida (JPG/PNG/WEBP).", 422, "file");
    }

    const objectPath = `contracts/${contractId}/payment-qr/${Date.now()}-${sanitizeSupportFileName(filename)}`;
    const storagePath = `gs://${bucketName}/${objectPath}`;
    await getStorage().bucket(bucketName).file(objectPath).save(buf, { contentType, resumable: false, metadata: { contentType } });

    auditEvent("payment_qr_uploaded", { contractId });
    return NextResponse.json({ success: true, storagePath });
  } catch (e) {
    return NextResponse.json(
      { success: false, errors: [{ field: "server", message: "No se pudo subir el QR en el servidor." }], detail: e instanceof Error ? e.message.slice(0, 200) : "error" },
      { status: 500 },
    );
  }
}
