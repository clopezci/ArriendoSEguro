import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { addCredits, createAgency } from "@/lib/agencies/agencyStore";
import { AGENCY_TRIAL_CREDITS } from "@/domain/agencies/types";
import { sendEmail } from "@/services/email/sendEmail";
import { sendTelegram } from "@/services/telegram/sendTelegram";
import { checkRateLimit, RATE_LIMIT_RULES, tooManyRequestsJson, clientIpFromRequest } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const schema = z.object({
  name: z.string().trim().min(2, "El nombre es muy corto.").max(120),
  nit: z.string().trim().max(40).optional().or(z.literal("")),
  contactName: z.string().trim().min(2, "Falta el nombre del contacto.").max(120),
  contactEmail: z.string().trim().email("Correo inválido."),
  contactPhone: z.string().trim().max(30).optional().or(z.literal("")),
  escalationEmail: z.string().trim().email("Correo de escalamiento inválido."),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  monthlyVolume: z.string().trim().max(40).optional().or(z.literal("")),
  message: z.string().trim().max(1000).optional().or(z.literal("")),
});

function empty(v: string | undefined) {
  return v && v.trim() ? v.trim() : undefined;
}

/**
 * POST /api/agencias/registro — auto-registro público de una agencia. Crea la
 * agencia YA (con créditos de prueba), sin aprobación manual: al admin solo le
 * llega un aviso informativo (correo + Telegram). El admin puede revocar la
 * prueba después desde /admin. Sin sesión, con rate-limit.
 */
export async function POST(request: Request) {
  const rl = await checkRateLimit(`agency-signup:${clientIpFromRequest(request)}`, RATE_LIMIT_RULES.leads);
  if (!rl.ok) {
    const { body, headers } = tooManyRequestsJson(rl.retryAfterSeconds);
    return NextResponse.json(body, { status: 429, headers });
  }

  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ success: false, errors: [{ field: "body", message: "JSON inválido." }] }, { status: 422 });
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ success: false, errors: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })) }, { status: 422 });
  }
  const d = parsed.data;

  try {
    const now = new Date().toISOString();
    const agency = await createAgency(firestore, {
      name: d.name,
      nit: empty(d.nit),
      contactEmail: d.contactEmail,
      contactPhone: empty(d.contactPhone),
      escalationEmail: d.escalationEmail,
      ownerUid: "self_signup",
      origin: "self_signup",
      trial: { active: true, startedAt: now, creditsGranted: AGENCY_TRIAL_CREDITS },
    });
    // Créditos de cortesía para que pruebe de una.
    await addCredits(firestore, agency.id, AGENCY_TRIAL_CREDITS);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://arriendoseguro.app";
    const panelUrl = `${appUrl}/agency`;

    // Bienvenida a la agencia (no bloquea el registro si falla).
    try {
      await sendEmail({
        to: agency.contactEmail,
        subject: `Tu prueba en ArriendoSeguro está lista — ${agency.name}`,
        html: `<p>Hola ${d.contactName},</p><p>Tu inmobiliaria <strong>${agency.name}</strong> ya tiene una prueba activa con <strong>${AGENCY_TRIAL_CREDITS} contratos gratis</strong>.</p><p>Entra con este mismo correo (${agency.contactEmail}) a tu panel:</p><p><a href="${panelUrl}">Abrir mi panel de agencia</a></p><p>Ahí puedes cargar tus inmuebles, capturar inquilinos con tu enlace/QR y enviar contratos a firma.</p>`,
        text: `Tu prueba en ArriendoSeguro está lista. ${AGENCY_TRIAL_CREDITS} contratos gratis. Entra con ${agency.contactEmail}: ${panelUrl}`,
        templateCode: "agencyTrialWelcomeEmail",
        relatedEntityType: "agency",
        relatedEntityId: agency.id,
      });
    } catch {
      /* la agencia ya quedó creada */
    }

    // Aviso informativo al admin (correo + Telegram).
    const inbox = process.env.REPORTS_INBOX_EMAIL?.trim() || process.env.CONTACT_INBOX_EMAIL?.trim() || "contacto@arriendoseguro.app";
    try {
      await sendEmail({
        to: inbox,
        subject: `🏢 Nueva agencia en prueba — ${agency.name}`,
        html: `<p>Se registró una agencia y la prueba se activó automáticamente.</p><ul><li><strong>Agencia:</strong> ${agency.name}${d.nit ? ` (NIT ${d.nit})` : ""}</li><li><strong>Contacto:</strong> ${d.contactName} — ${agency.contactEmail}${empty(d.contactPhone) ? ` — ${d.contactPhone}` : ""}</li><li><strong>Ciudad:</strong> ${empty(d.city) ?? "—"}</li><li><strong>Contratos/mes:</strong> ${empty(d.monthlyVolume) ?? "—"}</li><li><strong>Escalamiento:</strong> ${agency.escalationEmail}</li>${empty(d.message) ? `<li><strong>Mensaje:</strong> ${d.message}</li>` : ""}</ul><p>Puedes revisar o revocar la prueba en <a href="${appUrl}/admin">/admin → Agencias</a>.</p>`,
        text: `Nueva agencia en prueba: ${agency.name}. Contacto: ${d.contactName} ${agency.contactEmail}. Revisar/revocar en ${appUrl}/admin`,
        templateCode: "agencyTrialAdminEmail",
        relatedEntityType: "agency",
        relatedEntityId: agency.id,
      });
    } catch {
      /* el aviso es complementario */
    }
    try {
      await sendTelegram(
        `🏢 *Nueva agencia en prueba*\n${agency.name}\nContacto: ${d.contactName} — ${agency.contactEmail}\nCiudad: ${empty(d.city) ?? "—"} · Contratos/mes: ${empty(d.monthlyVolume) ?? "—"}\nRevocar en ${appUrl}/admin`,
      );
    } catch {
      /* Telegram complementario */
    }

    return NextResponse.json({ success: true, agencyId: agency.id });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") console.error("agencias/registro POST", err);
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "No se pudo completar el registro. Intenta de nuevo." }] }, { status: 500 });
  }
}
