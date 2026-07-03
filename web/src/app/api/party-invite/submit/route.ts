import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { getInvite } from "@/lib/party-invite/inviteStore";
import {
  PARTY_INVITES_COLLECTION,
  SAVED_PARTY_PROFILES_COLLECTION,
  savedPartyProfileKey,
} from "@/domain/party-invite/partyInvite";
import { sanitizeSavedProfile } from "@/domain/saved-entities/savedEntities";
import { checkRateLimit, RATE_LIMIT_RULES, tooManyRequestsJson, clientIpFromRequest } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const schema = z.object({
  token: z.string().min(8),
  party: z.unknown(),
  saveProfile: z.boolean().optional(),
  acceptances: z
    .object({
      truthfulnessOath: z.boolean(),
      dataAuthorization: z.boolean(),
    })
    .optional(),
});

/** El invitado envía sus datos (requiere OTP ya verificado). */
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

  const invite = await getInvite(firestore, parsed.data.token);
  if (!invite) return NextResponse.json({ success: false, errors: [{ field: "token", message: "Enlace inválido." }] }, { status: 410 });
  if (Date.now() > Date.parse(invite.expiresAt)) {
    return NextResponse.json({ success: false, errors: [{ field: "token", message: "El enlace expiró." }] }, { status: 410 });
  }
  if (!invite.otpVerifiedAt) {
    return NextResponse.json({ success: false, errors: [{ field: "otp", message: "Valida primero el código enviado a tu correo." }] }, { status: 403 });
  }

  const profile = sanitizeSavedProfile(parsed.data.party);
  if (!profile) {
    return NextResponse.json({ success: false, errors: [{ field: "party", message: "Faltan datos mínimos (nombre y documento)." }] }, { status: 422 });
  }

  // Evidencia legal de la aceptación del TITULAR (captada en el servidor, no por
  // el cliente): juramento + autorización de tratamiento de datos, con IP, fecha
  // y user-agent. Es lo que evita que el dueño tenga que (o pueda) falsear estas
  // aceptaciones al importar los datos.
  const acc = parsed.data.acceptances;
  if (!acc || !acc.truthfulnessOath || !acc.dataAuthorization) {
    return NextResponse.json(
      {
        success: false,
        errors: [
          {
            field: "acceptances",
            message:
              "Debes aceptar la declaración bajo juramento y la autorización de tratamiento de datos para continuar.",
          },
        ],
      },
      { status: 422 },
    );
  }
  const h = request.headers;
  const decode = (v: string | null) => {
    if (!v) return null;
    try {
      return decodeURIComponent(v);
    } catch {
      return v;
    }
  };
  const selfAttestation = {
    truthfulnessOathAccepted: true,
    dataAuthorizationAccepted: true,
    acceptedByInvitee: true as const,
    acceptedAt: new Date().toISOString(),
    ip: clientIpFromRequest(request) || null,
    userAgent: h.get("user-agent") ?? null,
    city: decode(h.get("x-vercel-ip-city")),
    country: h.get("x-vercel-ip-country") ?? null,
  };

  const nowIso = new Date().toISOString();
  await firestore.collection(PARTY_INVITES_COLLECTION).doc(invite.token).set(
    { contribution: profile, selfAttestation, status: "completed", completedAt: nowIso },
    { merge: true },
  );

  if (parsed.data.saveProfile) {
    const key = savedPartyProfileKey(invite.role, invite.inviteeEmail);
    await firestore.collection(SAVED_PARTY_PROFILES_COLLECTION).doc(key).set(
      {
        role: invite.role,
        email: invite.inviteeEmail,
        profile,
        updatedAt: nowIso,
        updatedAtServer: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }

  return NextResponse.json({ success: true });
}
