import { NextResponse } from "next/server";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebase/admin";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { getAllEntitlementsForUser } from "@/domain/platform-payments/entitlements";
import { auditEvent } from "@/features/contracts/audit-server";

export const runtime = "nodejs";

/**
 * Derecho de acceso (Habeas Data, Ley 1581 de 2012, art. 8): el titular puede
 * pedir y obtener una copia de los datos que la plataforma tiene sobre él.
 * Este endpoint arma automáticamente ese "expediente de datos" a partir de las
 * colecciones que referencian al usuario (por su `uid` o su correo) y lo
 * devuelve en secciones tipo tabla, listas para verse en pantalla o descargarse.
 *
 * Cada consulta va aislada en `safe()`: si una colección falla (p. ej. falta un
 * índice), esa sección queda vacía pero el resto del reporte se entrega igual.
 */

type Cell = string | number | boolean | null;
type ExportSection = {
  key: string;
  title: string;
  description?: string;
  columns: string[];
  rows: Record<string, Cell>[];
};

const MAX_ROWS = 500;

function str(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

/** Toma un documento y proyecta solo las columnas indicadas, como texto plano. */
function pick(data: Record<string, unknown>, columns: string[]): Record<string, Cell> {
  const row: Record<string, Cell> = {};
  for (const c of columns) row[c] = str(data[c]);
  return row;
}

async function safe(fn: () => Promise<ExportSection>): Promise<ExportSection> {
  try {
    return await fn();
  } catch {
    return { key: "error", title: "", columns: [], rows: [] };
  }
}

export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;

  const adminAuth = getAdminAuth();
  const firestore = getAdminFirestore();
  if (!adminAuth || !firestore) {
    return NextResponse.json(
      { success: false, errors: [{ field: "server", message: "Servicio de administración no disponible." }] },
      { status: 503 },
    );
  }

  const uid = auth.user.uid;
  const email = auth.user.email.toLowerCase();

  try {
    const sections: ExportSection[] = [];

    // 1) Identidad de la cuenta (desde Firebase Auth).
    sections.push(
      await safe(async () => {
        const rec = await adminAuth.getUser(uid);
        const rows: Record<string, Cell>[] = [
          { campo: "Identificador de cuenta (UID)", valor: rec.uid },
          { campo: "Correo", valor: rec.email ?? email },
          { campo: "Correo verificado", valor: rec.emailVerified ? "Sí" : "No" },
          { campo: "Nombre", valor: rec.displayName ?? "" },
          { campo: "Teléfono", valor: rec.phoneNumber ?? "" },
          { campo: "Proveedores de acceso", valor: rec.providerData.map((p) => p.providerId).join(", ") },
          { campo: "Fecha de creación", valor: rec.metadata.creationTime ?? "" },
          { campo: "Último acceso", valor: rec.metadata.lastSignInTime ?? "" },
          { campo: "Cuenta deshabilitada", valor: rec.disabled ? "Sí" : "No" },
        ];
        return {
          key: "identidad",
          title: "Identidad de la cuenta",
          description: "Datos con los que te identificamos para el acceso.",
          columns: ["campo", "valor"],
          rows,
        };
      }),
    );

    // 2) Consentimientos (user_consents).
    sections.push(
      await safe(async () => {
        const cols = ["version", "surface", "acceptedAt", "ipAddress", "userAgent", "consentHash"];
        const snap = await firestore.collection("user_consents").where("uid", "==", uid).limit(MAX_ROWS).get();
        return {
          key: "consentimientos",
          title: "Consentimientos otorgados",
          description: "Autorizaciones de tratamiento de datos que registraste, con su evidencia.",
          columns: cols,
          rows: snap.docs.map((d) => pick(d.data() as Record<string, unknown>, cols)),
        };
      }),
    );

    // 3) Plan / accesos (access_entitlements).
    sections.push(
      await safe(async () => {
        const ents = await getAllEntitlementsForUser(firestore, uid);
        const cols = ["type", "status", "validUntil", "contractsUsed", "maxContractsAllowed", "source"];
        return {
          key: "plan",
          title: "Planes y accesos",
          description: "Planes (Plus/demo) asociados a tu cuenta.",
          columns: cols,
          rows: ents.map((e) => pick(e as unknown as Record<string, unknown>, cols)),
        };
      }),
    );

    // 4) Contratos donde eres titular (contracts.ownerUid).
    sections.push(
      await safe(async () => {
        const cols = ["id", "status", "contractVersion", "createdAt", "updatedAt"];
        const snap = await firestore.collection("contracts").where("ownerUid", "==", uid).limit(MAX_ROWS).get();
        return {
          key: "contratos",
          title: "Contratos que creaste",
          description: "Expedientes de arrendamiento de los que eres titular en la plataforma.",
          columns: cols,
          rows: snap.docs.map((d) => pick({ id: d.id, ...(d.data() as Record<string, unknown>) }, cols)),
        };
      }),
    );

    // 5) Firmas realizadas con tu correo (signatures.signerEmail).
    sections.push(
      await safe(async () => {
        const cols = ["contractId", "signerRole", "signatureStatus", "signedAt", "createdAt"];
        const snap = await firestore.collection("signatures").where("signerEmail", "==", email).limit(MAX_ROWS).get();
        return {
          key: "firmas",
          title: "Firmas electrónicas",
          description: "Firmas registradas con tu correo y su estado.",
          columns: cols,
          rows: snap.docs.map((d) => pick(d.data() as Record<string, unknown>, cols)),
        };
      }),
    );

    // 6) Reputación recibida (reputation_reviews.subjectEmail).
    sections.push(
      await safe(async () => {
        const cols = ["contractId", "direction", "stars", "createdAt"];
        const snap = await firestore
          .collection("reputation_reviews")
          .where("subjectEmail", "==", email)
          .limit(MAX_ROWS)
          .get();
        return {
          key: "reputacion_recibida",
          title: "Calificaciones que recibiste",
          description: "Evaluaciones estructuradas de la experiencia hechas sobre ti.",
          columns: cols,
          rows: snap.docs.map((d) => pick(d.data() as Record<string, unknown>, cols)),
        };
      }),
    );

    // 7) Reputación emitida (reputation_reviews.raterUid).
    sections.push(
      await safe(async () => {
        const cols = ["subjectEmail", "contractId", "direction", "stars", "createdAt"];
        const snap = await firestore
          .collection("reputation_reviews")
          .where("raterUid", "==", uid)
          .limit(MAX_ROWS)
          .get();
        return {
          key: "reputacion_emitida",
          title: "Calificaciones que emitiste",
          description: "Evaluaciones que hiciste sobre la otra parte.",
          columns: cols,
          rows: snap.docs.map((d) => pick(d.data() as Record<string, unknown>, cols)),
        };
      }),
    );

    // 8) Mensajes de contacto (contact_messages.email).
    sections.push(
      await safe(async () => {
        const cols = ["name", "email", "message", "createdAt"];
        const snap = await firestore.collection("contact_messages").where("email", "==", email).limit(MAX_ROWS).get();
        return {
          key: "mensajes_contacto",
          title: "Mensajes de contacto",
          description: "Mensajes que enviaste por el formulario de contacto.",
          columns: cols,
          rows: snap.docs.map((d) => pick(d.data() as Record<string, unknown>, cols)),
        };
      }),
    );

    const cleaned = sections.filter((s) => s.key !== "error");

    auditEvent("account_data_access_requested", {
      uid,
      sections: cleaned.length,
      rows: cleaned.reduce((n, s) => n + s.rows.length, 0),
    });

    return NextResponse.json({
      success: true,
      generatedAt: new Date().toISOString(),
      subject: { uid, email },
      legalBasis: "Ley 1581 de 2012 (Habeas Data), art. 8 — derecho de acceso.",
      sections: cleaned,
    });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") console.error("cuenta/mis-datos", err);
    return NextResponse.json(
      { success: false, errors: [{ field: "server", message: "No se pudo generar el reporte de datos. Intenta de nuevo." }] },
      { status: 500 },
    );
  }
}
