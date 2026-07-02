import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { sendEmail } from "@/services/email/sendEmail";
import { FOUNDER_ADMIN_EMAILS } from "@/lib/admin/founder-admins";
import { auditEvent } from "@/features/contracts/audit-server";
import { logServerError } from "@/lib/observability/observability";

export const runtime = "nodejs";

const schema = z.object({
  category: z.string().min(2).max(60),
  categoryLabel: z.string().min(2).max(80),
  name: z.string().max(120).optional(),
  phone: z.string().max(40).optional(),
  message: z.string().max(1000).optional(),
});

/**
 * "Me interesa este servicio de aliado". Mientras no haya aliados reales
 * configurados, la solicitud llega al FUNDADOR (mock). Cuando se configuren
 * aliados con su propio correo, se usa el directorio real (/api/partners/lead).
 */
export async function POST(request: Request) {
  try {
    const auth = await requireAuthenticatedUser(request);
    if (!auth.ok) return auth.response;

    const parsed = schema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, errors: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })) },
        { status: 422 },
      );
    }
    const { category, categoryLabel, name, phone, message } = parsed.data;
    const userEmail = auth.user.email ?? "(sin correo)";

    // Destino: correo(s) de fundador (mock). Se reemplazará por el correo del
    // aliado real cuando el fundador los configure en /admin.
    const to = process.env.PARTNER_INTEREST_INBOX?.trim() || FOUNDER_ADMIN_EMAILS[0];
    const html =
      `<p>Nueva solicitud de interés en un servicio de aliado.</p>` +
      `<ul>` +
      `<li><strong>Categoría:</strong> ${categoryLabel} (${category})</li>` +
      `<li><strong>Usuario:</strong> ${userEmail}</li>` +
      (name ? `<li><strong>Nombre:</strong> ${name}</li>` : "") +
      (phone ? `<li><strong>Teléfono:</strong> ${phone}</li>` : "") +
      (message ? `<li><strong>Mensaje:</strong> ${message}</li>` : "") +
      `</ul>` +
      `<p style="color:#64748b;font-size:12px;">Mock de aliados: llega a tu correo hasta que configures el aliado real.</p>`;
    const result = await sendEmail({
      to,
      subject: `Interés en aliado: ${categoryLabel}`,
      html,
      text: `Interés en ${categoryLabel} (${category}). Usuario: ${userEmail}. Tel: ${phone ?? "-"}. Mensaje: ${message ?? "-"}.`,
      templateCode: "partnerInterestEmail",
      relatedEntityType: "partner",
      relatedEntityId: category,
    });
    auditEvent("partner_interest_submitted", { category, delivery: result.status });

    return NextResponse.json({ success: true, delivery: result.status });
  } catch (err) {
    await logServerError("partners/interest", err);
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "No se pudo enviar tu interés." }] }, { status: 500 });
  }
}
