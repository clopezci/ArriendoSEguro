import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { auditEvent } from "@/features/contracts/audit";

export const runtime = "nodejs";

const schema = z.object({
  inventoryId: z.string().min(3),
  zones: z.array(
    z.object({
      zoneCode: z.string().min(1),
      zoneName: z.string().min(1),
      customZoneName: z.string().optional(),
      order: z.number().int().nonnegative(),
    }),
  ),
});

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          errors: parsed.error.issues.map((i) => ({
            field: i.path.join("."),
            message: i.message,
          })),
        },
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
        { success: false, errors: [{ field: "inventoryId", message: "Inventario no existe." }] },
        { status: 404 },
      );
    }
    const now = new Date().toISOString();
    const existingSnap = await firestore
      .collection("inventory_selected_zones")
      .where("inventoryId", "==", parsed.data.inventoryId)
      .get();
    const existingByCode = new Map(
      existingSnap.docs.map((d) => {
        const row = d.data() as { zoneCode?: string };
        return [row.zoneCode ?? d.id, d];
      }),
    );
    const batch = firestore.batch();
    parsed.data.zones.forEach((zone) => {
      const existing = existingByCode.get(zone.zoneCode);
      const ref = existing?.ref ?? firestore.collection("inventory_selected_zones").doc();
      batch.set(
        ref,
        {
          id: ref.id,
          inventoryId: parsed.data.inventoryId,
          zoneCode: zone.zoneCode,
          zoneName: zone.zoneName,
          customZoneName: zone.customZoneName ?? "",
          order: zone.order,
          status: existing ? (existing.data().status ?? "pending") : "pending",
          createdAt: existing?.data().createdAt ?? now,
          updatedAt: now,
          updatedAtServer: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      existingByCode.delete(zone.zoneCode);
    });
    existingByCode.forEach((doc) => {
      batch.set(doc.ref, { status: "skipped", updatedAt: now }, { merge: true });
    });
    batch.set(invRef, { updatedAt: now }, { merge: true });
    await batch.commit();
    auditEvent("inventory_zones_selected", {
      inventoryId: parsed.data.inventoryId,
      zones: parsed.data.zones.length,
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, errors: [{ field: "server", message: "No se pudieron guardar zonas." }] },
      { status: 500 },
    );
  }
}

