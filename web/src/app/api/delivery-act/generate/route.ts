import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import type { Inventory, InventoryKey, InventoryMeterReading } from "@/domain/inventory/types";
import { renderInitialDeliveryAct } from "@/domain/inventory/renderInitialDeliveryAct";
import { auditEvent } from "@/features/contracts/audit";
import { renderContractPdfFromHtml } from "@/domain/contracts/pdf";

export const runtime = "nodejs";
const schema = z.object({
  inventoryId: z.string().min(3),
  contractId: z.string().min(3),
  contractVersionId: z.string().min(3),
  observations: z.string().optional().default(""),
});

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, errors: [{ field: "payload", message: "Datos inválidos." }] }, { status: 422 });
    }
    const firestore = getAdminFirestore();
    if (!firestore) return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });

    const invSnap = await firestore.collection("inventories").doc(parsed.data.inventoryId).get();
    if (!invSnap.exists) return NextResponse.json({ success: false, errors: [{ field: "inventoryId", message: "Inventario no existe." }] }, { status: 404 });
    const inventory = invSnap.data() as Inventory;
    if (inventory.status !== "completed" && inventory.status !== "signed") {
      return NextResponse.json({ success: false, errors: [{ field: "inventory", message: "El inventario debe estar completado para generar acta." }] }, { status: 422 });
    }

    const versionSnap = await firestore.collection("contract_versions").doc(parsed.data.contractVersionId).get();
    const version = versionSnap.data() as {
      contractId?: string;
      contractPayload?: { landlord?: { fullName?: string }; tenant?: { fullName?: string }; property?: { address?: string } };
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
    const rendered = renderInitialDeliveryAct({
      deliveryDate: new Date().toLocaleDateString("es-CO"),
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
      pdfUrl = `/api/delivery-act/pdf/${inventory.id}`;
      await firestore.collection("inventories").doc(inventory.id).set(
        { deliveryActPdfStoragePath: localPath },
        { merge: true },
      );
    }

    const annexId = `annex_delivery_${inventory.id}`;
    const now = new Date().toISOString();
    await firestore.collection("contract_annexes").doc(annexId).set(
      {
        id: annexId,
        contractId: parsed.data.contractId,
        contractVersionId: parsed.data.contractVersionId,
        leaseProcessId: inventory.leaseProcessId,
        annexType: "initial_delivery_act",
        title: "Anexo No. 2 - Acta de entrega inicial",
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
    return NextResponse.json({ success: true, annexId, documentHash: rendered.hash });
  } catch {
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "No se pudo generar acta de entrega." }] }, { status: 500 });
  }
}

