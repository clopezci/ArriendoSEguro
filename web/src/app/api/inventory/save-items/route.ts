import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { auditEvent } from "@/features/contracts/audit-server";

export const runtime = "nodejs";

const itemSchema = z.object({
  id: z.string().optional(),
  zone: z.string().min(1),
  itemName: z.string().min(1),
  conditionStatus: z.enum(["excellent", "good", "fair", "poor", "damaged", "not_applicable"]),
  cleanlinessStatus: z.enum(["clean", "acceptable", "dirty", "not_applicable"]),
  notes: z.string().optional().default(""),
  photoUrls: z.array(z.string()).default([]),
});

const meterSchema = z.object({
  id: z.string().optional(),
  meterType: z.enum(["water", "electricity", "gas", "other"]),
  meterNumber: z.string().optional().default(""),
  readingValue: z.string().optional().default(""),
  photoUrl: z.string().optional().default(""),
});

const keySchema = z.object({
  id: z.string().optional(),
  keyType: z.string().min(1),
  quantity: z.number().int().positive(),
  notes: z.string().optional().default(""),
});

const schema = z.object({
  inventoryId: z.string().min(3),
  items: z.array(itemSchema),
  meterReadings: z.array(meterSchema),
  keys: z.array(keySchema),
});

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, errors: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })) },
        { status: 422 },
      );
    }
    const firestore = getAdminFirestore();
    if (!firestore) return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });

    const invRef = firestore.collection("inventories").doc(parsed.data.inventoryId);
    const invSnap = await invRef.get();
    if (!invSnap.exists) return NextResponse.json({ success: false, errors: [{ field: "inventoryId", message: "Inventario no existe." }] }, { status: 404 });

    const now = new Date().toISOString();
    const batch = firestore.batch();
    parsed.data.items.forEach((item) => {
      const ref = item.id
        ? firestore.collection("inventory_items").doc(item.id)
        : firestore.collection("inventory_items").doc();
      batch.set(
        ref,
        {
          id: ref.id,
          inventoryId: parsed.data.inventoryId,
          ...item,
          createdAt: now,
          updatedAt: now,
          updatedAtServer: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    });
    parsed.data.meterReadings.forEach((meter) => {
      const ref = meter.id
        ? firestore.collection("inventory_meter_readings").doc(meter.id)
        : firestore.collection("inventory_meter_readings").doc();
      batch.set(
        ref,
        {
          id: ref.id,
          inventoryId: parsed.data.inventoryId,
          ...meter,
          createdAt: now,
          updatedAt: now,
          updatedAtServer: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    });
    parsed.data.keys.forEach((key) => {
      const ref = key.id ? firestore.collection("inventory_keys").doc(key.id) : firestore.collection("inventory_keys").doc();
      batch.set(
        ref,
        {
          id: ref.id,
          inventoryId: parsed.data.inventoryId,
          ...key,
          createdAt: now,
          updatedAt: now,
          updatedAtServer: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    });
    batch.set(invRef, { updatedAt: now, updatedAtServer: FieldValue.serverTimestamp() }, { merge: true });
    await batch.commit();
    auditEvent("inventory_items_saved", { inventoryId: parsed.data.inventoryId, items: parsed.data.items.length });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "No se pudo guardar inventario." }] }, { status: 500 });
  }
}

