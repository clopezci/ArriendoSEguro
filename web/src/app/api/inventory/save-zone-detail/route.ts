import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { auditEvent } from "@/features/contracts/audit";

export const runtime = "nodejs";

const schema = z.object({
  inventoryId: z.string().min(3),
  selectedZoneId: z.string().min(3),
  generalCondition: z.enum(["Excelente", "Bueno", "Aceptable", "Regular", "Malo", "No aplica"]),
  cleanlinessStatus: z.enum(["Limpio", "Aceptable", "Sucio", "No aplica"]),
  observations: z.string().optional().default(""),
  damageDescription: z.string().optional().default(""),
  recommendations: z.string().optional().default(""),
  photoUrls: z.array(z.string()).default([]),
  status: z.enum(["in_progress", "completed", "skipped"]).default("in_progress"),
  skipReason: z.string().optional().default(""),
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
    const selectedZoneRef = firestore.collection("inventory_selected_zones").doc(parsed.data.selectedZoneId);
    const selectedZoneSnap = await selectedZoneRef.get();
    if (!selectedZoneSnap.exists) return NextResponse.json({ success: false, errors: [{ field: "selectedZoneId", message: "Zona seleccionada no existe." }] }, { status: 404 });

    const detailSnap = await firestore
      .collection("inventory_zone_details")
      .where("inventoryId", "==", parsed.data.inventoryId)
      .where("selectedZoneId", "==", parsed.data.selectedZoneId)
      .limit(1)
      .get();
    const now = new Date().toISOString();
    const detailRef = detailSnap.empty
      ? firestore.collection("inventory_zone_details").doc()
      : detailSnap.docs[0].ref;
    await Promise.all([
      detailRef.set(
        {
          id: detailRef.id,
          inventoryId: parsed.data.inventoryId,
          selectedZoneId: parsed.data.selectedZoneId,
          generalCondition: parsed.data.generalCondition,
          cleanlinessStatus: parsed.data.cleanlinessStatus,
          observations: parsed.data.observations,
          damageDescription: parsed.data.damageDescription,
          recommendations: parsed.data.recommendations,
          photoUrls: parsed.data.photoUrls,
          completedAt: parsed.data.status === "completed" ? now : null,
          createdAt: detailSnap.empty ? now : (detailSnap.docs[0]?.data().createdAt ?? now),
          updatedAt: now,
          updatedAtServer: FieldValue.serverTimestamp(),
        },
        { merge: true },
      ),
      selectedZoneRef.set(
        {
          status: parsed.data.status,
          skipReason: parsed.data.status === "skipped" ? parsed.data.skipReason : "",
          updatedAt: now,
        },
        { merge: true },
      ),
    ]);
    auditEvent(
      parsed.data.status === "skipped" ? "inventory_zone_skipped" : "inventory_zone_saved",
      { inventoryId: parsed.data.inventoryId, selectedZoneId: parsed.data.selectedZoneId },
    );
    return NextResponse.json({ success: true, zoneDetailId: detailRef.id });
  } catch {
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "No se pudo guardar el detalle de zona." }] }, { status: 500 });
  }
}

