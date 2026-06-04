import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import {
  requireAuthenticatedUser,
  requestClientIp,
  requestUserAgent,
} from "@/lib/auth/serverAuth";
import { auditEvent } from "@/features/contracts/audit-server";
import { subjectKeyFromEmail } from "@/lib/reputation/aggregate-store";
import { LOOKUP_CONSENTS_COLLECTION } from "@/app/api/reputation/lookup/request/route";

export const runtime = "nodejs";

const schema = z.object({
  requesterUid: z.string().min(1),
  action: z.enum(["grant", "deny"]),
});

/**
 * El **titular** autoriza o rechaza una solicitud de consulta de su reputación.
 * Registra evidencia Habeas Data (IP, agente, fecha) de la decisión.
 */
export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;
  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json(
      { success: false, errors: [{ field: "server", message: "Firestore no configurado." }] },
      { status: 503 },
    );
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, errors: [{ field: "body", message: "Datos inválidos." }] },
      { status: 422 },
    );
  }

  const docId = `${parsed.data.requesterUid}__${subjectKeyFromEmail(auth.user.email)}`;
  const ref = firestore.collection(LOOKUP_CONSENTS_COLLECTION).doc(docId);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json(
      { success: false, errors: [{ field: "requesterUid", message: "Solicitud no encontrada." }] },
      { status: 404 },
    );
  }
  // Solo el titular (sujeto) puede decidir.
  if ((snap.data() as { subjectEmail?: string }).subjectEmail !== auth.user.email) {
    return NextResponse.json(
      { success: false, errors: [{ field: "auth", message: "No autorizado para esta solicitud." }] },
      { status: 403 },
    );
  }

  const status = parsed.data.action === "grant" ? "granted" : "denied";
  const now = new Date().toISOString();
  await ref.set(
    {
      status,
      respondedAt: now,
      respondedAtServer: FieldValue.serverTimestamp(),
      habeasData: {
        decision: status,
        ip: requestClientIp(request),
        userAgent: requestUserAgent(request),
        at: now,
      },
    },
    { merge: true },
  );

  auditEvent("reputation_lookup_responded", { requesterUid: parsed.data.requesterUid, status });
  return NextResponse.json({ success: true, status });
}
