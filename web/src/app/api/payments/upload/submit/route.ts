import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { getUploadToken } from "@/lib/payments/uploadTokenStore";
import { isAllowedSupportMagic } from "@/domain/payments/supportValidation";
import { isTokenUsable, PAYMENT_UPLOAD_TOKENS_COLLECTION } from "@/domain/payments/paymentUploadToken";
import { auditEvent } from "@/features/contracts/audit-server";
import { sendEmail } from "@/services/email/sendEmail";
import { paymentUploadedEmail } from "@/services/email/emailTemplates";
import { appConfig } from "@/lib/config";
import { checkRateLimit, RATE_LIMIT_RULES, tooManyRequestsJson, clientIpFromRequest } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const schema = z.object({
  token: z.string().min(8),
  storagePath: z.string().min(8),
  amountPaid: z.number().nonnegative(),
  paidDate: z.string().min(4).max(40),
  fileName: z.string().max(200).optional(),
});

/**
 * El inquilino confirma "ya pagué" y adjunta el soporte. Crea un registro de
 * pago **pendiente de confirmación del dueño** (no marca el pago como válido por
 * sí solo) y avisa al arrendador. Marca el token como usado.
 */
export async function POST(request: Request) {
  const rl = await checkRateLimit(clientIpFromRequest(request), RATE_LIMIT_RULES.publicToken);
  if (!rl.ok) {
    const t = tooManyRequestsJson(rl.retryAfterSeconds);
    return NextResponse.json(t.body, { status: 429, headers: t.headers });
  }

  const firestore = getAdminFirestore();
  if (!firestore) return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, errors: [{ field: "body", message: "Datos inválidos." }] }, { status: 422 });

  const doc = await getUploadToken(firestore, parsed.data.token);
  if (!isTokenUsable(doc, Date.now()) || !doc) {
    return NextResponse.json({ success: false, errors: [{ field: "token", message: "El enlace no es válido o expiró." }] }, { status: 410 });
  }

  // La ruta debe estar **directamente** en la carpeta de soportes de ESTE contrato
  // (un solo segmento tras el prefijo, sin subrutas ni traversal).
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET?.trim();
  const expectedPrefix = `gs://${bucketName}/contracts/${doc.contractId}/payment-supports/`;
  const remainder = parsed.data.storagePath.startsWith(expectedPrefix)
    ? parsed.data.storagePath.slice(expectedPrefix.length)
    : null;
  if (!remainder || remainder.includes("/") || remainder.includes("..")) {
    return NextResponse.json({ success: false, errors: [{ field: "storagePath", message: "Soporte no válido." }] }, { status: 422 });
  }

  // Verificación de **magic bytes**: descargamos la cabecera real del objeto y
  // confirmamos que es PDF/JPG/PNG/WEBP. La extensión y el content-type que
  // declara el cliente no bastan (se pueden falsear). Si no coincide, borramos
  // el objeto subido y rechazamos.
  if (bucketName) {
    try {
      const objectPath = `contracts/${doc.contractId}/payment-supports/${remainder}`;
      const fileRef = getStorage().bucket(bucketName).file(objectPath);
      const [head] = await fileRef.download({ start: 0, end: 15 });
      if (!isAllowedSupportMagic(new Uint8Array(head))) {
        await fileRef.delete().catch(() => {});
        return NextResponse.json(
          { success: false, errors: [{ field: "storagePath", message: "El archivo no es un soporte válido (PDF/JPG/PNG/WEBP)." }] },
          { status: 422 },
        );
      }
    } catch {
      // Si no se pudo leer el objeto (no existe / Storage caído), no creamos el
      // registro: el soporte no es verificable.
      return NextResponse.json(
        { success: false, errors: [{ field: "storagePath", message: "No se pudo verificar el soporte subido." }] },
        { status: 422 },
      );
    }
  }

  const now = new Date().toISOString();
  const ownerConfirmToken = randomBytes(24).toString("hex");
  const ref = firestore.collection("payments_log").doc();
  await ref.set({
    id: ref.id,
    leaseProcessId: doc.contractId,
    contractId: doc.contractId,
    contractVersionId: doc.contractVersionId,
    scheduledPaymentId: doc.scheduledPaymentId ?? null,
    periodLabel: doc.periodLabel,
    dueDate: doc.dueDate,
    paidDate: parsed.data.paidDate,
    amountDue: doc.expectedAmount,
    amountPaid: Number(parsed.data.amountPaid) || 0,
    paymentMethod: "otro",
    paymentStatus: "reported_paid",
    supportRequired: true,
    supportValidationStatus: "pending",
    supportFileUrl: parsed.data.storagePath,
    supportFileName: parsed.data.fileName ?? "soporte",
    supportUploadedAt: now,
    // Origen: subido por el inquilino vía enlace mágico; pendiente de confirmación del dueño.
    uploadedByTenantLink: true,
    ownerConfirmed: false,
    ownerConfirmToken,
    ownerConfirmStatus: "pending",
    createdAt: now,
    updatedAt: now,
    createdAtServer: FieldValue.serverTimestamp(),
  });

  // Marca el token como usado (un soporte por periodo; el dueño puede pedir otro).
  await firestore.collection(PAYMENT_UPLOAD_TOKENS_COLLECTION).doc(parsed.data.token).set({ status: "used", usedAt: now }, { merge: true });

  // Marca el pago programado como REPORTADO: detiene recordatorios y el
  // escalamiento (codeudor/conciliación/cobro personal) para ese periodo.
  if (doc.scheduledPaymentId) {
    await firestore
      .collection("scheduled_payments")
      .doc(doc.scheduledPaymentId)
      .set({ status: "reported_paid", supportUploadedAt: now, updatedAt: now }, { merge: true })
      .catch(() => {});
  }

  // Avisa al arrendador para que confirme.
  try {
    const vSnap = await firestore.collection("contract_versions").doc(doc.contractVersionId).get();
    const landlordEmail = ((vSnap.data() as { contractPayload?: { landlord?: { email?: string } } } | undefined)?.contractPayload?.landlord?.email ?? "").trim();
    if (landlordEmail) {
      const base = appConfig.publicUrl.replace(/\/$/, "");
      const tpl = paymentUploadedEmail({
        periodLabel: doc.periodLabel,
        amountText: `$${(Number(parsed.data.amountPaid) || 0).toLocaleString("es-CO")}`,
        confirmUrl: `${base}/api/payments/confirm?token=${ownerConfirmToken}&action=confirm`,
        rejectUrl: `${base}/api/payments/confirm?token=${ownerConfirmToken}&action=reject`,
        reviewUrl: `${base}/dashboard/contracts/${doc.contractId}/payments`,
      });
      await sendEmail({
        to: landlordEmail,
        subject: tpl.subject,
        html: tpl.html,
        text: tpl.text,
        templateCode: "paymentUploadedEmail",
        relatedEntityType: "payment",
        relatedEntityId: ref.id,
      });
    }
  } catch {
    /* el aviso es best-effort */
  }

  auditEvent("payment_uploaded_by_tenant", { contractId: doc.contractId, periodLabel: doc.periodLabel });
  return NextResponse.json({ success: true });
}
