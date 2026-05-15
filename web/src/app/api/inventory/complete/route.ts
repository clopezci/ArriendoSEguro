import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { validateInventoryCompletion } from "@/domain/inventory/validateInventory";
import { renderInitialInventoryAnnex } from "@/domain/inventory/renderInitialInventoryAnnex";
import type { Inventory, InventoryItem, InventoryKey, InventoryMeterReading } from "@/domain/inventory/types";
import { auditEvent } from "@/features/contracts/audit-server";

export const runtime = "nodejs";
const schema = z.object({ inventoryId: z.string().min(3) });

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, errors: [{ field: "inventoryId", message: "inventoryId inválido." }] }, { status: 422 });
    }
    const firestore = getAdminFirestore();
    if (!firestore) return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });

    const invRef = firestore.collection("inventories").doc(parsed.data.inventoryId);
    const invSnap = await invRef.get();
    if (!invSnap.exists) return NextResponse.json({ success: false, errors: [{ field: "inventoryId", message: "Inventario no encontrado." }] }, { status: 404 });
    const inventory = invSnap.data() as Inventory;

    const [itemsSnap, meterSnap, keysSnap] = await Promise.all([
      firestore.collection("inventory_items").where("inventoryId", "==", inventory.id).get(),
      firestore.collection("inventory_meter_readings").where("inventoryId", "==", inventory.id).get(),
      firestore.collection("inventory_keys").where("inventoryId", "==", inventory.id).get(),
    ]);
    const items = itemsSnap.docs.map((d) => d.data() as InventoryItem);
    const meterReadings = meterSnap.docs.map((d) => d.data() as InventoryMeterReading);
    const keys = keysSnap.docs.map((d) => d.data() as InventoryKey);

    const issues = validateInventoryCompletion({ items, meterReadings, keys });
    if (issues.length) return NextResponse.json({ success: false, errors: issues }, { status: 422 });

    const rendered = renderInitialInventoryAnnex({ inventory, items, meterReadings, keys });
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
    auditEvent("initial_inventory_completed", { inventoryId: inventory.id, contractId: inventory.contractId });
    return NextResponse.json({ success: true, inventoryId: inventory.id, documentHash: rendered.hash });
  } catch {
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "No se pudo completar inventario." }] }, { status: 500 });
  }
}

