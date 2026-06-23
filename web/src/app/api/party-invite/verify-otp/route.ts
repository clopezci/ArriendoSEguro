import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { getInvite } from "@/lib/party-invite/inviteStore";
import {
  PARTY_INVITES_COLLECTION,
  SAVED_PARTY_PROFILES_COLLECTION,
  isInviteUsable,
  savedPartyProfileKey,
} from "@/domain/party-invite/partyInvite";
import { verifyOtpCode, SIGNATURE_OTP_MAX_VERIFY_ATTEMPTS } from "@/domain/signatures/signatureOtp";
import { checkRateLimit, RATE_LIMIT_RULES, tooManyRequestsJson, clientIpFromRequest } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const schema = z.object({ token: z.string().min(8), code: z.string().min(4).max(8) });

/** Valida el OTP; si hay perfil guardado del tercero, lo devuelve para prellenar. */
export async function POST(request: Request) {
  const rl = await checkRateLimit(clientIpFromRequest(request), RATE_LIMIT_RULES.signatureOtp);
  if (!rl.ok) {
    const t = tooManyRequestsJson(rl.retryAfterSeconds);
    return NextResponse.json(t.body, { status: 429, headers: t.headers });
  }
  const firestore = getAdminFirestore();
  if (!firestore) return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, errors: [{ field: "body", message: "Datos inválidos." }] }, { status: 422 });

  const invite = await getInvite(firestore, parsed.data.token);
  if (!isInviteUsable(invite, Date.now()) || !invite) {
    return NextResponse.json({ success: false, errors: [{ field: "token", message: "El enlace no es válido o expiró." }] }, { status: 410 });
  }
  if (!invite.otpHash || !invite.otpExpiresAt) {
    return NextResponse.json({ success: false, errors: [{ field: "code", message: "Solicita primero un código." }] }, { status: 422 });
  }
  if (Date.now() > Date.parse(invite.otpExpiresAt)) {
    return NextResponse.json({ success: false, errors: [{ field: "code", message: "El código expiró. Solicita uno nuevo." }] }, { status: 410 });
  }
  if ((invite.otpVerifyAttempts ?? 0) >= SIGNATURE_OTP_MAX_VERIFY_ATTEMPTS) {
    return NextResponse.json({ success: false, errors: [{ field: "code", message: "Demasiados intentos. Solicita un código nuevo." }] }, { status: 422 });
  }

  const ok = verifyOtpCode(invite.otpHash, invite.token, parsed.data.code);
  if (!ok) {
    await firestore.collection(PARTY_INVITES_COLLECTION).doc(invite.token).set(
      { otpVerifyAttempts: FieldValue.increment(1) },
      { merge: true },
    );
    return NextResponse.json({ success: false, errors: [{ field: "code", message: "Código incorrecto." }] }, { status: 422 });
  }

  await firestore.collection(PARTY_INVITES_COLLECTION).doc(invite.token).set(
    { otpVerifiedAt: new Date().toISOString(), otpHash: null },
    { merge: true },
  );

  // El OTP probó identidad: si la persona tiene un perfil guardado, lo devolvemos.
  let profile: unknown = null;
  try {
    const key = savedPartyProfileKey(invite.role, invite.inviteeEmail);
    const snap = await firestore.collection(SAVED_PARTY_PROFILES_COLLECTION).doc(key).get();
    profile = snap.exists ? (snap.data()?.profile ?? null) : null;
  } catch {
    profile = null;
  }

  return NextResponse.json({ success: true, profile });
}
