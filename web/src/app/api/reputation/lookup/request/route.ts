import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { auditEvent } from "@/features/contracts/audit-server";
import { sendEmail } from "@/services/email/sendEmail";
import { reputationLookupRequestEmail } from "@/services/email/emailTemplates";
import { appConfig } from "@/lib/config";
import { normalizeEmail, subjectKeyFromEmail, LOOKUP_CONSENTS_COLLECTION } from "@/lib/reputation/aggregate-store";

export const runtime = "nodejs";

const schema = z.object({ subjectEmail: z.string().email() });

/**
 * Un usuario solicita ver la reputación agregada de otra persona. Queda
 * **pendiente** hasta que el titular **autorice** (Habeas Data). Se notifica al
 * titular por correo. No revela ningún dato hasta que haya consentimiento.
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
      { success: false, errors: [{ field: "subjectEmail", message: "Correo del titular inválido." }] },
      { status: 422 },
    );
  }
  const subjectEmail = normalizeEmail(parsed.data.subjectEmail);
  if (subjectEmail === auth.user.email) {
    return NextResponse.json(
      { success: false, errors: [{ field: "subjectEmail", message: "Tu propia reputación la ves en «Mi reputación»." }] },
      { status: 422 },
    );
  }

  const docId = `${auth.user.uid}__${subjectKeyFromEmail(subjectEmail)}`;
  const ref = firestore.collection(LOOKUP_CONSENTS_COLLECTION).doc(docId);
  const existing = await ref.get();
  const prevStatus = existing.exists ? (existing.data() as { status?: string }).status : undefined;

  // Si ya estaba concedida, no se reescribe el consentimiento.
  if (prevStatus === "granted") {
    return NextResponse.json({ success: true, status: "granted" });
  }

  const now = new Date().toISOString();
  await ref.set(
    {
      requesterUid: auth.user.uid,
      requesterEmail: auth.user.email,
      subjectEmail,
      subjectKey: subjectKeyFromEmail(subjectEmail),
      status: "pending",
      requestedAt: now,
      requestedAtServer: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  const tpl = reputationLookupRequestEmail({
    requesterEmail: auth.user.email,
    manageUrl: `${appConfig.publicUrl.replace(/\/$/, "")}/dashboard/reputacion`,
  });
  await sendEmail({
    to: subjectEmail,
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
    templateCode: "reputationLookupRequestEmail",
    relatedEntityType: "reputation_lookup",
    relatedEntityId: docId,
  });

  auditEvent("reputation_lookup_requested", { requesterUid: auth.user.uid });
  return NextResponse.json({ success: true, status: "pending" });
}
