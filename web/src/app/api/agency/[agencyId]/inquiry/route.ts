import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { requireAgencyMember } from "@/lib/auth/requireAgencyMember";
import { sendEmail } from "@/services/email/sendEmail";
import { sendTelegram } from "@/services/telegram/sendTelegram";

export const runtime = "nodejs";

const schema = z.object({
  topic: z.enum(["prueba_ampliada", "plan", "duda", "soporte", "otro"]).optional(),
  message: z.string().trim().min(3, "Escribe tu mensaje.").max(1500),
});

/**
 * POST /api/agency/[agencyId]/inquiry — la agencia envía una duda/solicitud
 * (p. ej. al quedarse sin créditos o para pedir un plan a la medida). Se guarda
 * en `agency_inquiries` y te llega a correo + Telegram. Requiere ser miembro.
 */
export async function POST(request: Request, { params }: { params: Promise<{ agencyId: string }> }) {
  const { agencyId } = await params;
  const gate = await requireAgencyMember(request, agencyId);
  if (!gate.ok) return gate.response;
  const { firestore, agency, user } = gate;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, errors: [{ field: "body", message: "JSON inválido." }] }, { status: 422 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, errors: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })) }, { status: 422 });
  }
  const topic = parsed.data.topic ?? "duda";
  const message = parsed.data.message;

  const ref = firestore.collection("agency_inquiries").doc();
  await ref.set({
    id: ref.id,
    agencyId,
    agencyName: agency.name,
    topic,
    message,
    fromEmail: user.email,
    status: "open",
    createdAt: new Date().toISOString(),
    createdAtServer: FieldValue.serverTimestamp(),
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://arriendoseguro.app";
  const inbox = process.env.REPORTS_INBOX_EMAIL?.trim() || process.env.CONTACT_INBOX_EMAIL?.trim() || "contacto@arriendoseguro.app";
  try {
    await sendEmail({
      to: inbox,
      subject: `💬 Solicitud de agencia (${topic}) — ${agency.name}`,
      html: `<p>La agencia <strong>${agency.name}</strong> envió una solicitud.</p><ul><li><strong>Tipo:</strong> ${topic}</li><li><strong>De:</strong> ${user.email}</li></ul><p>${message}</p><p><a href="${appUrl}/admin">Abrir /admin</a></p>`,
      text: `Solicitud (${topic}) de ${agency.name} (${user.email}):\n${message}`,
      templateCode: "agencyTrialAdminEmail",
      relatedEntityType: "agency",
      relatedEntityId: agencyId,
    });
  } catch {
    /* la solicitud ya quedó guardada */
  }
  try {
    await sendTelegram(`💬 *Solicitud de agencia* (${topic})\n${agency.name} — ${user.email}\n\n${message.slice(0, 1500)}`);
  } catch {
    /* Telegram complementario */
  }

  return NextResponse.json({ success: true });
}
