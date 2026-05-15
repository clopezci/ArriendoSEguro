import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebase/admin";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { auditEvent } from "@/features/contracts/audit-server";
import { getAllEntitlementsForUser } from "@/domain/platform-payments/entitlements";
import { listFullySignedContractIdsForSignerEmail } from "@/lib/account/signedContractsForEmail";

export const runtime = "nodejs";

const DELETE_CONFIRM_PHRASE = "ELIMINAR MI CUENTA";

const bodySchema = z.object({
  confirmPhrase: z.string().min(3).max(120),
});

type Err = { success: false; errors: { field: string; message: string }[]; code?: string };

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;

  const adminAuth = getAdminAuth();
  const firestore = getAdminFirestore();
  if (!adminAuth || !firestore) {
    return NextResponse.json<Err>(
      { success: false, errors: [{ field: "server", message: "Servicio de administración no disponible." }] },
      { status: 503 },
    );
  }

  let json: unknown;
  try {
    json = JSON.parse(await request.text()) as unknown;
  } catch {
    return NextResponse.json<Err>({ success: false, errors: [{ field: "body", message: "JSON inválido." }] }, { status: 422 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json<Err>(
      {
        success: false,
        errors: parsed.error.issues.map((i) => ({ field: i.path.join(".") || "body", message: i.message })),
      },
      { status: 422 },
    );
  }

  const phrase = parsed.data.confirmPhrase.trim();
  if (phrase !== DELETE_CONFIRM_PHRASE) {
    return NextResponse.json<Err>(
      {
        success: false,
        errors: [
          {
            field: "confirmPhrase",
            message: `Escribe exactamente: ${DELETE_CONFIRM_PHRASE}`,
          },
        ],
      },
      { status: 422 },
    );
  }

  try {
    const signedIds = await listFullySignedContractIdsForSignerEmail(firestore, auth.user.email);
    if (signedIds.length > 0) {
      auditEvent("account_deletion_requested", {
        outcome: "blocked_signed_contracts",
        signedContractsCount: signedIds.length,
        uid: auth.user.uid,
      });
      return NextResponse.json(
        {
          success: false,
          code: "RETENTION_SIGNED_CONTRACTS",
          signedContractsCount: signedIds.length,
          errors: [
            {
              field: "retention",
              message:
                "No podemos eliminar la cuenta de forma automática mientras existan contratos firmados en los que participaste. Conservamos el expediente por obligaciones legales y de trazabilidad. Escríbenos a privacidad@arriendoseguro.com.co para solicitar supresión o anonimización cuando proceda.",
            },
          ],
        },
        { status: 409 },
      );
    }

    auditEvent("account_deletion_requested", { outcome: "accepted", uid: auth.user.uid });

    const entitlements = await getAllEntitlementsForUser(firestore, auth.user.uid);
    if (entitlements.length > 0) {
      const batch = firestore.batch();
      for (const e of entitlements) {
        const ref = firestore.collection("access_entitlements").doc(e.id);
        batch.set(
          ref,
          {
            status: "cancelled",
            updatedAt: new Date().toISOString(),
            cancelledReason: "user_requested_account_deletion",
            updatedAtServer: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      }
      await batch.commit();
    }

    await adminAuth.deleteUser(auth.user.uid);

    auditEvent("account_deletion_completed", { uid: auth.user.uid });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") console.error("cuenta/eliminar", err);
    return NextResponse.json<Err>(
      { success: false, errors: [{ field: "server", message: "No se pudo completar la eliminación. Intenta de nuevo o escribe a privacidad@arriendoseguro.com.co." }] },
      { status: 500 },
    );
  }
}
