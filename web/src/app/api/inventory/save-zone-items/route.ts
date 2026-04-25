import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";

export const runtime = "nodejs";

const itemSchema = z.object({
  id: z.string().optional(),
  itemName: z.string().min(1),
  conditionStatus: z.enum(["excellent", "good", "fair", "poor", "damaged", "not_applicable"]),
  notes: z.string().optional().default(""),
  photoUrls: z.array(z.string()).default([]),
});

const schema = z.object({
  inventoryId: z.string().min(3),
  selectedZoneId: z.string().min(3),
  items: z.array(itemSchema),
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
    const now = new Date().toISOString();
    const batch = firestore.batch();
    parsed.data.items.forEach((item) => {
      const ref = item.id
        ? firestore.collection("inventory_zone_items").doc(item.id)
        : firestore.collection("inventory_zone_items").doc();
      batch.set(
        ref,
        {
          id: ref.id,
          inventoryId: parsed.data.inventoryId,
          selectedZoneId: parsed.data.selectedZoneId,
          itemName: item.itemName,
          conditionStatus: item.conditionStatus,
          notes: item.notes,
          photoUrls: item.photoUrls,
          createdAt: item.id ? now : now,
          updatedAt: now,
          updatedAtServer: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    });
    await batch.commit();
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, errors: [{ field: "server", message: "No se pudieron guardar elementos de zona." }] },
      { status: 500 },
    );
  }
}

