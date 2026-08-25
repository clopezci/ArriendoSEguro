import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { signDownloadToken } from "@/lib/security/downloadToken";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import type { Inventory, InventoryKey, InventoryMeterReading } from "@/domain/inventory/types";
import { renderInitialDeliveryAct } from "@/domain/inventory/renderInitialDeliveryAct";
import { auditEvent } from "@/features/contracts/audit-server";
import { renderContractPdfFromHtml } from "@/domain/contracts/pdf";
import { sendEmail } from "@/services/email/sendEmail";
import { requireContractParticipant } from "@/lib/auth/serverAuth";

export const runtime = "nodejs";
// PDF con pdf-lib (JS puro); headroom por inventario extenso / subida a Storage.
export const maxDuration = 60;
const schema = z.object({
  inventoryId: z.string().min(3),
  contractId: z.string().min(3),
  contractVersionId: z.string().min(3),
  observations: z.string().optional().default(""),
  /** Fecha de entrega (YYYY-MM-DD). Si falta, se usa la fecha de hoy. */
  deliveryDate: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, errors: [{ field: "payload", message: "Datos inválidos." }] }, { status: 422 });
    }
    const firestore = getAdminFirestore();
    if (!firestore) return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });

    const gate = await requireContractParticipant(request, firestore, parsed.data.contractId, {
      kind: "by_version",
      contractVersionId: parsed.data.contractVersionId,
    });
    if (!gate.ok) return gate.response;

    const invSnap = await firestore.collection("inventories").doc(parsed.data.inventoryId).get();
    if (!invSnap.exists) return NextResponse.json({ success: false, errors: [{ field: "inventoryId", message: "Inventario no existe." }] }, { status: 404 });
    const inventory = invSnap.data() as Inventory;
    if (inventory.status !== "completed" && inventory.status !== "signed") {
      return NextResponse.json({ success: false, errors: [{ field: "inventory", message: "El inventario debe estar completado para generar acta." }] }, { status: 422 });
    }

    const versionSnap = await firestore.collection("contract_versions").doc(parsed.data.contractVersionId).get();
    const version = versionSnap.data() as {
      contractId?: string;
      contractPayload?: {
        landlord?: { fullName?: string; email?: string };
        tenant?: { fullName?: string; email?: string };
        property?: { address?: string };
      };
    } | undefined;
    if (!versionSnap.exists || version?.contractId !== parsed.data.contractId) {
      return NextResponse.json({ success: false, errors: [{ field: "contractVersionId", message: "Versión contractual inválida." }] }, { status: 422 });
    }

    const [metersSnap, keysSnap] = await Promise.all([
      firestore.collection("inventory_meter_readings").where("inventoryId", "==", inventory.id).get(),
      firestore.collection("inventory_keys").where("inventoryId", "==", inventory.id).get(),
    ]);
    const [zonesSnap, zoneDetailsSnap, zoneItemsSnap] = await Promise.all([
      firestore.collection("inventory_selected_zones").where("inventoryId", "==", inventory.id).get(),
      firestore.collection("inventory_zone_details").where("inventoryId", "==", inventory.id).get(),
      firestore.collection("inventory_zone_items").where("inventoryId", "==", inventory.id).get(),
    ]);
    const meterReadings = metersSnap.docs.map((d) => d.data() as InventoryMeterReading);
    const keys = keysSnap.docs.map((d) => d.data() as InventoryKey);
    const selectedZones = zonesSnap.docs.map((d) => d.data() as { status?: string; zoneName?: string });
    const details = zoneDetailsSnap.docs.map((d) => d.data() as { observations?: string; photoUrls?: string[] });
    const zoneItems = zoneItemsSnap.docs.map((d) => d.data() as { photoUrls?: string[] });
    const zonesCompleted = selectedZones.filter((z) => z.status === "completed").length;
    const photosCount =
      details.reduce((acc, d) => acc + (d.photoUrls?.length ?? 0), 0) +
      zoneItems.reduce((acc, i) => acc + (i.photoUrls?.length ?? 0), 0);
    const summary = `Zonas inventariadas: ${zonesCompleted} de ${selectedZones.length}; fotos registradas: ${photosCount}; medidores: ${meterReadings.length}; llaves: ${keys.length}.`;
    const observationsSummary = details
      .map((d) => d.observations?.trim())
      .filter(Boolean)
      .slice(0, 5)
      .join(" | ");
    const deliveryDateDisplay = (() => {
      const raw = parsed.data.deliveryDate?.trim();
      if (raw) {
        const d = new Date(`${raw}T00:00:00`);
        if (!Number.isNaN(d.getTime())) return d.toLocaleDateString("es-CO");
      }
      return new Date().toLocaleDateString("es-CO");
    })();
    const rendered = renderInitialDeliveryAct({
      deliveryDate: deliveryDateDisplay,
      propertyAddress: version?.contractPayload?.property?.address ?? "Sin dirección",
      landlordName: version?.contractPayload?.landlord?.fullName ?? "Arrendador",
      tenantName: version?.contractPayload?.tenant?.fullName ?? "Arrendatario",
      observations: parsed.data.observations || observationsSummary,
      keys,
      meterReadings,
      contractId: parsed.data.contractId,
      contractVersionId: parsed.data.contractVersionId,
      inventoryId: inventory.id,
      inventorySummary: summary,
      photosCount,
    });

    const generatedAt = new Date().toISOString();
    const pdfBytes = await renderContractPdfFromHtml({
      html: rendered.html,
      contractId: parsed.data.contractId,
      contractVersionId: parsed.data.contractVersionId,
      versionNumber: 1,
      documentHash: rendered.hash,
      generatedAt,
    });
    let pdfUrl = "";
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET?.trim();
    if (bucketName) {
      const objectPath = `inventories/${inventory.id}/initial-delivery-act.pdf`;
      const bucket = getStorage().bucket(bucketName);
      const file = bucket.file(objectPath);
      await file.save(Buffer.from(pdfBytes), { contentType: "application/pdf", resumable: false });
      const signed = await file.getSignedUrl({
        action: "read",
        expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
      });
      pdfUrl = signed[0] ?? "";
    } else {
      const localDir = path.join(process.cwd(), "tmp", "generated-pdfs");
      await mkdir(localDir, { recursive: true });
      const localPath = path.join(localDir, `delivery-act-${inventory.id}.pdf`);
      await writeFile(localPath, Buffer.from(pdfBytes));
      pdfUrl = `/api/delivery-act/pdf/${inventory.id}?t=${signDownloadToken(inventory.id) ?? ""}`;
      await firestore.collection("inventories").doc(inventory.id).set(
        { deliveryActPdfStoragePath: localPath },
        { merge: true },
      );
    }

    const annexId = `annex_delivery_${inventory.id}`;
    const isFinal = inventory.inventoryType === "final";
    const now = new Date().toISOString();
    await firestore.collection("contract_annexes").doc(annexId).set(
      {
        id: annexId,
        contractId: parsed.data.contractId,
        contractVersionId: parsed.data.contractVersionId,
        leaseProcessId: inventory.leaseProcessId,
        annexType: isFinal ? "final_delivery_act" : "initial_delivery_act",
        title: isFinal ? "Anexo - Acta de entrega y devolución" : "Anexo No. 2 - Acta de entrega inicial",
        status: "generated",
        htmlContent: rendered.html,
        pdfUrl: pdfUrl || null,
        documentHash: rendered.hash,
        createdAt: now,
        updatedAt: now,
        generatedAt: now,
      },
      { merge: true },
    );
    await firestore.collection("contracts").doc(parsed.data.contractId).set(
      { updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    auditEvent("initial_delivery_act_generated", { inventoryId: inventory.id, contractId: parsed.data.contractId });

    // Envío del acta a ambas partes por correo (best-effort; no bloquea el éxito).
    const landlordEmail = version?.contractPayload?.landlord?.email?.trim().toLowerCase();
    const tenantEmail = version?.contractPayload?.tenant?.email?.trim().toLowerCase();
    const propertyAddress = version?.contractPayload?.property?.address ?? "el inmueble arrendado";
    const recipients = Array.from(new Set([landlordEmail, tenantEmail].filter(Boolean))) as string[];
    const linkLine = pdfUrl && pdfUrl.startsWith("http")
      ? `<p>Puedes ver o descargar el acta aquí: <a href="${pdfUrl}">Acta de entrega (PDF)</a> (enlace válido por 7 días).</p>`
      : `<p>El acta quedó archivada en el expediente del contrato en ArriendoSeguro.</p>`;
    const emailHtml =
      `<p>Hola,</p>` +
      `<p>Se generó el <strong>acta de entrega inicial</strong> del inmueble ubicado en <strong>${propertyAddress}</strong>, ` +
      `con fecha de entrega <strong>${deliveryDateDisplay}</strong>.</p>` +
      `<p>${summary}</p>` +
      linkLine +
      `<p>Conserva este documento: es tu mejor prueba del estado del inmueble al inicio del arriendo.</p>` +
      `<p style="color:#64748b;font-size:12px;">Enviado por ArriendoSeguro. Este es un correo automático; no es necesario responderlo.</p>`;
    let emailDelivery: "ok" | "partial" | "failed" | "none" = "none";
    if (recipients.length > 0) {
      const results = await Promise.all(
        recipients.map((to) =>
          sendEmail({
            to,
            subject: "Acta de entrega del inmueble — ArriendoSeguro",
            html: emailHtml,
            text: `Se generó el acta de entrega del inmueble en ${propertyAddress} (fecha ${deliveryDateDisplay}). ${summary}`,
            templateCode: "initialDeliveryActEmail",
            relatedEntityType: "contract",
            relatedEntityId: parsed.data.contractId,
          }).then(
            (r) => r.status === "sent" || r.status === "mock",
            () => false,
          ),
        ),
      );
      const okCount = results.filter(Boolean).length;
      emailDelivery = okCount === 0 ? "failed" : okCount === results.length ? "ok" : "partial";
      auditEvent("initial_delivery_act_emailed", {
        contractId: parsed.data.contractId,
        recipients: recipients.length,
        delivery: emailDelivery,
      });
    }

    return NextResponse.json({ success: true, annexId, documentHash: rendered.hash, emailDelivery });
  } catch {
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "No se pudo generar acta de entrega." }] }, { status: 500 });
  }
}

