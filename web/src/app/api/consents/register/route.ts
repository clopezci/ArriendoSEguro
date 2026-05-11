import { NextResponse } from "next/server";
import { z } from "zod";
import {
  requestClientIp,
  requestUserAgent,
  requireAuthenticatedUser,
} from "@/lib/auth/serverAuth";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { recordUserConsent } from "@/lib/firebase/consents";
import { CONSENT_CURRENT_VERSION } from "@/domain/consents/consentVersions";

export const runtime = "nodejs";

const bodySchema = z.object({
  version: z.string().min(1),
  surface: z.enum(["REGISTRATION", "CONTRACT_WIZARD_START"]),
});

export async function POST(request: Request) {
  try {
    const auth = await requireAuthenticatedUser(request);
    if (!auth.ok) return auth.response;

    const firestore = getAdminFirestore();
    if (!firestore) {
      return NextResponse.json(
        { success: false, errors: [{ field: "server", message: "Firestore no configurado." }] },
        { status: 503 },
      );
    }

    const raw = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          errors: parsed.error.issues.map((i) => ({
            field: i.path.join("."),
            message: i.message,
          })),
        },
        { status: 400 },
      );
    }
    const { version, surface } = parsed.data;
    if (version !== CONSENT_CURRENT_VERSION) {
      return NextResponse.json(
        {
          success: false,
          errors: [{ field: "version", message: "Versión de consentimiento no vigente." }],
        },
        { status: 400 },
      );
    }

    const ip = requestClientIp(request);
    const ua = requestUserAgent(request);

    const result = await recordUserConsent(firestore, {
      uid: auth.user.uid,
      email: auth.user.email,
      version,
      surface,
      ipAddress: ip,
      userAgent: ua,
    });
    if (!result.ok) {
      return NextResponse.json(
        { success: false, errors: [{ field: "version", message: result.reason }] },
        { status: 400 },
      );
    }

    await firestore.collection("audit_logs").add({
      event: "data_consent_accepted",
      uid: auth.user.uid,
      email: auth.user.email,
      version,
      surface,
      consentId: result.id,
      ipAddress: ip,
      userAgent: ua,
      at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, id: result.id, version });
  } catch {
    return NextResponse.json(
      {
        success: false,
        errors: [{ field: "server", message: "No se pudo registrar el consentimiento." }],
      },
      { status: 500 },
    );
  }
}
