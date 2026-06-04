import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { STATUS_INCIDENTS_COLLECTION } from "@/domain/observability/observabilityConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ServiceStatus = { key: string; label: string; status: "operational" | "degraded" | "down"; detail: string };

/**
 * Estado público de los servicios. Hace chequeos en vivo (la app responde,
 * Firestore lee, el correo está configurado) y lista incidentes abiertos. No
 * expone datos sensibles ni requiere autenticación.
 */
export async function GET() {
  const firestore = getAdminFirestore();
  const services: ServiceStatus[] = [];

  // App: si este endpoint responde, la app está arriba.
  services.push({ key: "app", label: "Aplicación web", status: "operational", detail: "Respondiendo." });

  // Base de datos: intentamos una lectura mínima.
  let dbStatus: ServiceStatus["status"] = "operational";
  let dbDetail = "Lectura correcta.";
  if (!firestore) {
    dbStatus = "down";
    dbDetail = "Firebase Admin no configurado.";
  } else {
    try {
      await firestore.collection(STATUS_INCIDENTS_COLLECTION).limit(1).get();
    } catch {
      dbStatus = "down";
      dbDetail = "No se pudo leer la base de datos.";
    }
  }
  services.push({ key: "database", label: "Base de datos", status: dbStatus, detail: dbDetail });

  // Correo: configurado si hay proveedor; si no, modo de respaldo.
  const emailConfigured = Boolean(process.env.RESEND_API_KEY?.trim());
  services.push({
    key: "email",
    label: "Correo transaccional",
    status: emailConfigured ? "operational" : "degraded",
    detail: emailConfigured ? "Proveedor activo." : "En modo de respaldo (sin proveedor de correo).",
  });

  // Incidentes abiertos (no resueltos).
  let incidents: { id: string; title: string; body: string; severity: string; status: string; createdAt: string }[] = [];
  if (firestore) {
    try {
      const snap = await firestore.collection(STATUS_INCIDENTS_COLLECTION).orderBy("createdAtServer", "desc").limit(20).get();
      incidents = snap.docs
        .map((d) => {
          const x = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            title: String(x.title ?? ""),
            body: String(x.body ?? ""),
            severity: String(x.severity ?? "minor"),
            status: String(x.status ?? "investigating"),
            createdAt: String(x.createdAt ?? ""),
          };
        })
        .filter((i) => i.status !== "resolved");
    } catch {
      /* si falla, devolvemos sin incidentes */
    }
  }

  const overall: "operational" | "degraded" | "down" = services.some((s) => s.status === "down")
    ? "down"
    : services.some((s) => s.status === "degraded") || incidents.length > 0
      ? "degraded"
      : "operational";

  return NextResponse.json({ success: true, overall, services, incidents });
}
