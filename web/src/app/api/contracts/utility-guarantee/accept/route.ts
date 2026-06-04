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
import { validateUtilityGuarantee } from "@/domain/contracts/utilityGuarantee";

export const runtime = "nodejs";

const schema = z.object({
  draftId: z.string().min(3),
  lastPeriod1Cop: z.number().int().positive().max(100_000_000),
  lastPeriod2Cop: z.number().int().positive().max(100_000_000),
  agreedAmountCop: z.number().int().positive().max(100_000_000),
});

/**
 * Registra la aceptación de la **garantía para servicios públicos** (Art. 15
 * Ley 820) con captura de IP y user-agent, como el resto de aceptaciones de la
 * app. Valida que el valor pactado no supere el máximo (suma de dos períodos).
 * Se guarda por `draftId` porque ocurre durante el wizard (antes de la versión).
 */
export async function POST(request: Request) {
  try {
    const firestore = getAdminFirestore();
    if (!firestore) {
      return NextResponse.json(
        { success: false, errors: [{ field: "server", message: "Firestore no configurado." }] },
        { status: 503 },
      );
    }

    const auth = await requireAuthenticatedUser(request);
    if (!auth.ok) return auth.response;

    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, errors: [{ field: "body", message: "Datos de la garantía inválidos." }] },
        { status: 422 },
      );
    }
    const data = parsed.data;

    const check = validateUtilityGuarantee({
      lastPeriod1Cop: data.lastPeriod1Cop,
      lastPeriod2Cop: data.lastPeriod2Cop,
      agreedAmountCop: data.agreedAmountCop,
    });
    if (!check.ok) {
      return NextResponse.json(
        { success: false, errors: [{ field: "agreedAmountCop", message: check.error }], maxAllowedCop: check.maxAllowedCop },
        { status: 422 },
      );
    }

    const now = new Date().toISOString();
    const ip = requestClientIp(request);
    const userAgent = requestUserAgent(request);

    const ref = firestore.collection("utility_guarantee_acceptances").doc();
    await ref.set({
      id: ref.id,
      draftId: data.draftId,
      userId: auth.user.uid,
      userEmail: auth.user.email,
      lastPeriod1Cop: data.lastPeriod1Cop,
      lastPeriod2Cop: data.lastPeriod2Cop,
      maxAllowedCop: check.maxAllowedCop,
      agreedAmountCop: data.agreedAmountCop,
      legalBasis: "Art. 15 Ley 820 de 2003",
      acceptedAt: now,
      acceptanceIp: ip ?? null,
      acceptanceIpMasked: ip ? ip.replace(/\.\d+$/, ".x") : null,
      acceptanceUserAgent: userAgent ?? null,
      createdAtServer: FieldValue.serverTimestamp(),
    });

    auditEvent("utility_guarantee_accepted", {
      draftId: data.draftId,
      maxAllowedCop: check.maxAllowedCop,
      agreedAmountCop: data.agreedAmountCop,
    });

    return NextResponse.json({ success: true, acceptedAt: now, maxAllowedCop: check.maxAllowedCop });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") console.error("utility-guarantee/accept", err);
    return NextResponse.json(
      { success: false, errors: [{ field: "server", message: "No se pudo registrar la garantía." }] },
      { status: 500 },
    );
  }
}
