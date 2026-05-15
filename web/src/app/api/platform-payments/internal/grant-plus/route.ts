import { NextResponse } from "next/server";
import { z } from "zod";
import { isInternalAdminEmail } from "@/lib/admin/internal-admin";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebase/admin";
import { grantManualPlusEntitlement } from "@/domain/platform-payments/manual-grant";
import { plusAccessConfirmedEmail } from "@/services/email/emailTemplates";
import { sendEmail } from "@/services/email/sendEmail";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().email(),
  validDays: z.number().int().min(1).max(365).optional(),
});

function isInternalEnabled() {
  return process.env.NODE_ENV === "development" || process.env.ADMIN_INTERNAL_ENABLED === "true";
}

function isAllowedAdmin(email: string) {
  if (process.env.NODE_ENV === "development") return true;
  return isInternalAdminEmail(email);
}

export async function POST(request: Request) {
  if (!isInternalEnabled()) {
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "No disponible." }] }, { status: 404 });
  }

  const authUser = await requireAuthenticatedUser(request);
  if (!authUser.ok) return authUser.response;
  if (!isAllowedAdmin(authUser.user.email)) {
    return NextResponse.json(
      { success: false, errors: [{ field: "auth", message: "No autorizado para operación interna." }] },
      { status: 403 },
    );
  }

  const firestore = getAdminFirestore();
  const auth = getAdminAuth();
  if (!firestore || !auth) {
    return NextResponse.json(
      { success: false, errors: [{ field: "server", message: "Firebase Admin no configurado." }] },
      { status: 503 },
    );
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, errors: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })) },
      { status: 422 },
    );
  }

  const result = await grantManualPlusEntitlement(
    { auth, firestore, requestedBy: authUser.user.email },
    { email: parsed.data.email, validDays: parsed.data.validDays },
  );

  if (!result.ok) {
    if (result.reason === "user_not_found") {
      return NextResponse.json(
        {
          success: false,
          errors: [{ field: "email", message: "El usuario no existe en Auth. Debe registrarse primero." }],
        },
        { status: 404 },
      );
    }
    return NextResponse.json(
      {
        success: false,
        errors: [{ field: "server", message: "No se pudo crear el entitlement manual." }],
      },
      { status: 500 },
    );
  }

  const plusTemplate = plusAccessConfirmedEmail({
    userEmail: result.userEmail,
    source: "manual",
  });
  const emailResult = await sendEmail({
    to: result.userEmail,
    subject: plusTemplate.subject,
    html: plusTemplate.html,
    text: plusTemplate.text,
    templateCode: "plusAccessConfirmedEmail",
    relatedEntityType: "access_entitlement",
    relatedEntityId: result.entitlementId,
  });

  return NextResponse.json({
    success: true,
    status: result.status,
    entitlementId: result.entitlementId,
    userId: result.userId,
    userEmail: result.userEmail,
    emailDelivery:
      emailResult.status === "sent" || emailResult.status === "mock"
        ? "ok"
        : emailResult.status === "failed"
          ? "failed"
          : "skipped",
  });
}

