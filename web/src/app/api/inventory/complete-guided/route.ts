import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import type {
  Inventory,
  InventoryItem,
  InventoryKey,
  InventoryMeterReading,
  InventorySelectedZone,
  InventoryZoneDetail,
  InventoryZoneItem,
} from "@/domain/inventory/types";
import { renderInitialInventoryAnnex } from "@/domain/inventory/renderInitialInventoryAnnex";
import { auditEvent } from "@/features/contracts/audit-server";

export const runtime = "nodejs";
const schema = z.object({ inventoryId: z.string().min(3) });

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, errors: [{ field: "inventoryId", message: "inventoryId inválido." }] },
        { status: 422 },
      );
    }
    const firestore = getAdminFirestore();
    if (!firestore) {
      return NextResponse.json(
        { success: false, errors: [{ field: "server", message: "Firestore no configurado." }] },
        { status: 503 },
      );
    }
    const invRef = firestore.collection("inventories").doc(parsed.data.inventoryId);
    const invSnap = await invRef.get();
    if (!invSnap.exists) {
      return NextResponse.json(
        { success: false, errors: [{ field: "inventoryId", message: "Inventario no encontrado." }] },
        { status: 404 },
      );
    }
    const inventory = invSnap.data() as Inventory;
    const [zonesSnap, detailsSnap, zoneItemsSnap, itemsSnap, meterSnap, keysSnap, versionSnap] =
      await Promise.all([
        firestore.collection("inventory_selected_zones").where("inventoryId", "==", inventory.id).get(),
        firestore.collection("inventory_zone_details").where("inventoryId", "==", inventory.id).get(),
        firestore.collection("inventory_zone_items").where("inventoryId", "==", inventory.id).get(),
        firestore.collection("inventory_items").where("inventoryId", "==", inventory.id).get(),
        firestore.collection("inventory_meter_readings").where("inventoryId", "==", inventory.id).get(),
        firestore.collection("inventory_keys").where("inventoryId", "==", inventory.id).get(),
        firestore.collection("contract_versions").doc(inventory.contractVersionId).get(),
      ]);

    const zones = zonesSnap.docs.map((d) => d.data() as InventorySelectedZone);
    const details = detailsSnap.docs.map((d) => d.data() as InventoryZoneDetail);
    const zoneItems = zoneItemsSnap.docs.map((d) => d.data() as InventoryZoneItem);
    const items = itemsSnap.docs.map((d) => d.data() as InventoryItem);
    const meterReadings = meterSnap.docs.map((d) => d.data() as InventoryMeterReading);
    const keys = keysSnap.docs.map((d) => d.data() as InventoryKey);

    const completedZones = zones.filter((z) => z.status === "completed");
    if (completedZones.length < 1) {
      return NextResponse.json(
        {
          success: false,
          errors: [{ field: "zones", message: "Debes completar al menos una zona para finalizar." }],
        },
        { status: 422 },
      );
    }
    const version = versionSnap.data() as
      | {
          contractPayload?: {
            property?: { address?: string };
            landlord?: { fullName?: string };
            tenant?: { fullName?: string };
          };
        }
      | undefined;
    const rendered = renderInitialInventoryAnnex({
      inventory,
      items,
      meterReadings,
      keys,
      selectedZones: zones.sort((a, b) => a.order - b.order),
      zoneDetails: details,
      zoneItems,
      contractSummary: {
        propertyAddress: version?.contractPayload?.property?.address ?? "No disponible",
        landlordName: version?.contractPayload?.landlord?.fullName ?? "No disponible",
        tenantName: version?.contractPayload?.tenant?.fullName ?? "No disponible",
      },
    });
    const now = new Date().toISOString();
    await Promise.all([
      invRef.set(
        {
          status: "completed",
          completedAt: now,
          generatedHtml: rendered.html,
          documentHash: rendered.hash,
          updatedAt: now,
          updatedAtServer: FieldValue.serverTimestamp(),
        },
        { merge: true },
      ),
      firestore.collection("contract_annexes").doc(`annex_inventory_${inventory.id}`).set(
        {
          id: `annex_inventory_${inventory.id}`,
          contractId: inventory.contractId,
          contractVersionId: inventory.contractVersionId,
          leaseProcessId: inventory.leaseProcessId,
          annexType: "initial_inventory",
          title: "Anexo No. 1 - Inventario inicial del inmueble",
          status: "generated",
          htmlContent: rendered.html,
          pdfUrl: null,
          documentHash: rendered.hash,
          createdAt: now,
          updatedAt: now,
          generatedAt: now,
        },
        { merge: true },
      ),
    ]);
    auditEvent("inventory_guided_completed", { inventoryId: inventory.id, completedZones: completedZones.length });
    return NextResponse.json({
      success: true,
      inventoryId: inventory.id,
      documentHash: rendered.hash,
      completedZones: completedZones.length,
    });
  } catch {
    return NextResponse.json(
      { success: false, errors: [{ field: "server", message: "No se pudo finalizar inventario guiado." }] },
      { status: 500 },
    );
  }
}

