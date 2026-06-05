import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireContractParticipant } from "@/lib/auth/serverAuth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const inventoryId = url.searchParams.get("inventoryId") ?? "";
    if (!inventoryId) {
      return NextResponse.json({ success: false, errors: [{ field: "inventoryId", message: "inventoryId obligatorio." }] }, { status: 422 });
    }
    const firestore = getAdminFirestore();
    if (!firestore) return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });
    const invSnap = await firestore.collection("inventories").doc(inventoryId).get();
    if (!invSnap.exists) return NextResponse.json({ success: false, errors: [{ field: "inventoryId", message: "Inventario no existe." }] }, { status: 404 });
    // Autorización: el inventario contiene datos del inmueble/entrega; solo partes del contrato.
    const contractId = (invSnap.data() as { contractId?: string } | undefined)?.contractId ?? "";
    const participant = await requireContractParticipant(request, firestore, contractId, { kind: "current" });
    if (!participant.ok) return participant.response;
    const [items, meters, keys] = await Promise.all([
      firestore.collection("inventory_items").where("inventoryId", "==", inventoryId).get(),
      firestore.collection("inventory_meter_readings").where("inventoryId", "==", inventoryId).get(),
      firestore.collection("inventory_keys").where("inventoryId", "==", inventoryId).get(),
    ]);
    const [selectedZones, zoneDetails, zoneItems] = await Promise.all([
      firestore.collection("inventory_selected_zones").where("inventoryId", "==", inventoryId).get(),
      firestore.collection("inventory_zone_details").where("inventoryId", "==", inventoryId).get(),
      firestore.collection("inventory_zone_items").where("inventoryId", "==", inventoryId).get(),
    ]);
    return NextResponse.json({
      success: true,
      inventory: invSnap.data(),
      items: items.docs.map((d) => d.data()),
      meterReadings: meters.docs.map((d) => d.data()),
      keys: keys.docs.map((d) => d.data()),
      selectedZones: selectedZones.docs.map((d) => d.data()),
      zoneDetails: zoneDetails.docs.map((d) => d.data()),
      zoneItems: zoneItems.docs.map((d) => d.data()),
    });
  } catch {
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "No se pudo cargar inventario." }] }, { status: 500 });
  }
}

