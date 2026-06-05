import { NextResponse } from "next/server";
import { getStorage } from "firebase-admin/storage";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { getUploadToken } from "@/lib/payments/uploadTokenStore";
import { tokenStateLabel } from "@/domain/payments/paymentUploadToken";
import { PAYMENT_SETTINGS_COLLECTION, type PaymentSettings } from "@/domain/payments/paymentSettings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Información pública (gated por token) para que el inquilino vea cómo pagar y
 * suba su soporte. No expone datos sensibles del contrato, solo lo necesario.
 */
export async function GET(request: Request) {
  const firestore = getAdminFirestore();
  if (!firestore) return NextResponse.json({ success: false, error: "unavailable" }, { status: 503 });

  const token = new URL(request.url).searchParams.get("token") ?? "";
  const doc = await getUploadToken(firestore, token);
  const state = tokenStateLabel(doc, Date.now());
  if (!doc || state !== "usable") {
    return NextResponse.json({ success: true, state, usable: false });
  }

  // Método de pago configurado por el dueño (con su consentimiento).
  const settingsSnap = await firestore.collection(PAYMENT_SETTINGS_COLLECTION).doc(doc.contractId).get();
  const settings = settingsSnap.exists ? (settingsSnap.data() as PaymentSettings) : null;

  let qrUrl: string | null = null;
  let account: { bank?: string; accountType?: string; accountNumber?: string } | null = null;
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET?.trim();
  if (settings?.method === "qr" && settings.qrStoragePath && bucketName) {
    try {
      const objectPath = settings.qrStoragePath.slice(`gs://${bucketName}/`.length);
      const [url] = await getStorage().bucket(bucketName).file(objectPath).getSignedUrl({
        version: "v4",
        action: "read",
        expires: Date.now() + 1000 * 60 * 20,
      });
      qrUrl = url;
    } catch {
      qrUrl = null;
    }
  } else if (settings?.method === "account") {
    account = { bank: settings.bank, accountType: settings.accountType, accountNumber: settings.accountNumber };
  }

  return NextResponse.json({
    success: true,
    state,
    usable: true,
    info: {
      landlordName: doc.landlordName,
      periodLabel: doc.periodLabel,
      dueDate: doc.dueDate,
      expectedAmount: doc.expectedAmount,
      method: settings?.method ?? "none",
      qrUrl,
      account,
    },
  });
}
