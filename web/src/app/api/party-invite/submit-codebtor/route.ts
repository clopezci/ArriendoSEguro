import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { getInvite, createInvite } from "@/lib/party-invite/inviteStore";
import { PARTY_INVITES_COLLECTION } from "@/domain/party-invite/partyInvite";
import { sanitizeSavedProfile } from "@/domain/saved-entities/savedEntities";
import { checkRateLimit, RATE_LIMIT_RULES, tooManyRequestsJson, clientIpFromRequest } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const schema = z.object({
  tenantToken: z.string().min(8),
  party: z.unknown(),
  thirdPartyAuthorization: z.boolean(),
});

/**
 * El INQUILINO (ya verificado) ingresa él mismo los datos del CODEUDOR,
 * declarando que cuenta con su autorización (Ley 1581). Se guarda como
 * contribución del codeudor para ese contrato, con una atestación de tercero
 * (evidencia del inquilino: IP/fecha). La veracidad y la aceptación propias del
 * codeudor se capturan cuando el codeudor FIRMA el contrato.
 */
export async function POST(request: Request) {
  const rl = await checkRateLimit(clientIpFromRequest(request), RATE_LIMIT_RULES.publicToken);
  if (!rl.ok) {
    const t = tooManyRequestsJson(rl.retryAfterSeconds);
    return NextResponse.json(t.body, { status: 429, headers: t.headers });
  }
  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, errors: [{ field: "body", message: "Datos inválidos." }] }, { status: 422 });
  }

  const tenantInvite = await getInvite(firestore, parsed.data.tenantToken);
  if (!tenantInvite || tenantInvite.role !== "tenant") {
    return NextResponse.json({ success: false, errors: [{ field: "token", message: "Enlace inválido." }] }, { status: 410 });
  }
  if (Date.now() > Date.parse(tenantInvite.expiresAt)) {
    return NextResponse.json({ success: false, errors: [{ field: "token", message: "El enlace expiró." }] }, { status: 410 });
  }
  if (!tenantInvite.otpVerifiedAt) {
    return NextResponse.json({ success: false, errors: [{ field: "otp", message: "Valida primero tu identidad con el código." }] }, { status: 403 });
  }
  if (!parsed.data.thirdPartyAuthorization) {
    return NextResponse.json(
      {
        success: false,
        errors: [{ field: "thirdPartyAuthorization", message: "Debes declarar que cuentas con la autorización del codeudor." }],
      },
      { status: 422 },
    );
  }

  const profile = sanitizeSavedProfile(parsed.data.party);
  if (!profile) {
    return NextResponse.json({ success: false, errors: [{ field: "party", message: "Faltan datos mínimos del codeudor (nombre y documento)." }] }, { status: 422 });
  }
  // El correo del codeudor es obligatorio: sin él no se le puede enviar el enlace
  // de firma y, además, la clave de perfil quedaría vacía (colisión entre codeudores).
  if (!profile.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) {
    return NextResponse.json(
      { success: false, errors: [{ field: "email", message: "El codeudor necesita un correo electrónico válido (allí firmará el contrato)." }] },
      { status: 422 },
    );
  }
  // Ingreso + solvencia (bloqueante si es inferior al canon del contrato).
  const rawIncome = (parsed.data.party as { economicSupport?: { monthlyIncome?: unknown } } | null)?.economicSupport?.monthlyIncome;
  const income = Math.max(0, Math.round(Number(rawIncome) || 0));
  const rent = typeof tenantInvite.monthlyRent === "number" ? tenantInvite.monthlyRent : 0;
  if (income <= 0) {
    return NextResponse.json({ success: false, errors: [{ field: "income", message: "Indica el ingreso mensual del codeudor." }] }, { status: 422 });
  }
  if (rent > 0 && income < rent) {
    return NextResponse.json({ success: false, errors: [{ field: "income", message: "El ingreso del codeudor es inferior al canon." }] }, { status: 422 });
  }
  const contribution = { ...profile, economicSupport: { monthlyIncome: income } };

  const h = request.headers;
  const decode = (v: string | null) => {
    if (!v) return null;
    try {
      return decodeURIComponent(v);
    } catch {
      return v;
    }
  };
  const tenantName = tenantInvite.contribution?.fullName || tenantInvite.inviteeName || "El arrendatario";
  const selfAttestation = {
    truthfulnessOathAccepted: true,
    dataAuthorizationAccepted: true,
    acceptedByInvitee: false,
    mode: "third_party" as const,
    attestedByName: tenantName,
    acceptedAt: new Date().toISOString(),
    ip: clientIpFromRequest(request) || null,
    userAgent: h.get("user-agent") ?? null,
    city: decode(h.get("x-vercel-ip-city")),
    country: h.get("x-vercel-ip-country") ?? null,
  };

  // Creamos (o reutilizamos) el enlace del codeudor para ESTE contrato, a nombre
  // del dueño (inviterUid), y lo dejamos completado con la contribución.
  const invite = await createInvite(firestore, {
    contractDraftId: tenantInvite.contractDraftId,
    role: "solidaryCoDebtor",
    inviteeEmail: profile.email ?? "",
    inviteeName: profile.fullName ?? "",
    inviterUid: tenantInvite.inviterUid,
    inviterEmail: tenantInvite.inviterEmail,
    inviterName: tenantName,
    monthlyRent: tenantInvite.monthlyRent,
  });
  const nowIso = new Date().toISOString();
  await firestore.collection(PARTY_INVITES_COLLECTION).doc(invite.token).set(
    {
      contribution,
      selfAttestation,
      status: "completed",
      completedAt: nowIso,
      createdViaTenantToken: parsed.data.tenantToken,
      enteredByTenant: true,
    },
    { merge: true },
  );

  return NextResponse.json({ success: true });
}
