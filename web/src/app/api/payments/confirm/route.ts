import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { auditEvent } from "@/features/contracts/audit-server";
import { sendEmail } from "@/services/email/sendEmail";
import { paymentConfirmedToTenantEmail } from "@/services/email/emailTemplates";
import { checkRateLimit, RATE_LIMIT_RULES, clientIpFromRequest } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

function page(title: string, body: string, ok: boolean): Response {
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/><title>${title} · ArriendoSeguro</title>
    <style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:system-ui,Arial,sans-serif;background:#f8fafc;color:#0f172a;padding:24px}
    .c{max-width:420px;text-align:center;background:#fff;border:1px solid #cbd5e1;border-radius:18px;padding:28px}
    .b{width:48px;height:48px;margin:0 auto 14px;border-radius:14px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:22px;background:${ok ? "#16a34a" : "#6d28d9"}}
    h1{font-size:18px;margin:0 0 8px}p{font-size:14px;color:#475569;margin:0}</style></head>
    <body><div class="c"><div class="b">${ok ? "✓" : "ℹ"}</div><h1>${title}</h1><p>${body}</p></div></body></html>`;
  return new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

/**
 * Confirmación del dueño en 1 clic (sin login) de un soporte de pago subido por
 * el inquilino. `action=confirm` valida el pago; `action=reject` lo marca por
 * revisar. Notifica al inquilino. El token está en el registro de pago.
 */
export async function GET(request: Request) {
  const rl = await checkRateLimit(clientIpFromRequest(request), RATE_LIMIT_RULES.publicToken);
  if (!rl.ok) return page("Demasiadas solicitudes", "Espera un momento e inténtalo de nuevo.", false);

  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  const action = url.searchParams.get("action") ?? "";
  if (!token || (action !== "confirm" && action !== "reject")) {
    return page("Enlace inválido", "El enlace de confirmación no es válido.", false);
  }

  const firestore = getAdminFirestore();
  if (!firestore) return page("No disponible", "El servicio no está disponible en este momento.", false);

  const snap = await firestore.collection("payments_log").where("ownerConfirmToken", "==", token).limit(1).get().catch(() => null);
  if (!snap || snap.empty) {
    return page("Enlace no encontrado", "No encontramos este pago. Es posible que ya lo hayas confirmado.", false);
  }
  const docRef = snap.docs[0].ref;
  const data = snap.docs[0].data() as { contractVersionId?: string; periodLabel?: string };
  const confirmed = action === "confirm";
  const now = new Date().toISOString();

  await docRef.set(
    {
      ownerConfirmed: confirmed,
      ownerConfirmStatus: confirmed ? "confirmed" : "rejected",
      ownerConfirmedAt: now,
      ownerConfirmToken: FieldValue.delete(),
      supportValidationStatus: confirmed ? "valid" : "invalid",
      paymentStatus: confirmed ? "reported_paid" : "disputed",
      updatedAt: now,
    },
    { merge: true },
  );

  // Avisa a AMBAS partes (inquilino y arrendador) cuando se confirma; en rechazo,
  // solo al inquilino (el dueño fue quien rechazó).
  try {
    if (data.contractVersionId) {
      const vSnap = await firestore.collection("contract_versions").doc(data.contractVersionId).get();
      const payload = (vSnap.data() as { contractPayload?: { tenant?: { email?: string }; landlord?: { email?: string } } } | undefined)?.contractPayload;
      const tenantEmail = (payload?.tenant?.email ?? "").trim();
      const landlordEmail = (payload?.landlord?.email ?? "").trim();
      const period = data.periodLabel ?? "";
      if (tenantEmail) {
        const tpl = paymentConfirmedToTenantEmail({ periodLabel: period, confirmed });
        await sendEmail({
          to: tenantEmail,
          subject: tpl.subject,
          html: tpl.html,
          text: tpl.text,
          templateCode: "paymentConfirmedToTenantEmail",
          relatedEntityType: "payment",
          relatedEntityId: docRef.id,
        });
      }
      // Constancia al dueño (solo en confirmación).
      if (confirmed && landlordEmail) {
        await sendEmail({
          to: landlordEmail,
          subject: `Pago confirmado${period ? ` · ${period}` : ""}`,
          html: `<p>Confirmaste el pago${period ? ` del periodo <strong>${period.replace(/[<>]/g, "")}</strong>` : ""}. Avisamos a ambas partes y quedó registrado en tu expediente.</p>`,
          text: `Confirmaste el pago${period ? ` del periodo ${period}` : ""}. Avisamos a ambas partes y quedó registrado.`,
          templateCode: "paymentConfirmedToTenantEmail",
          relatedEntityType: "payment",
          relatedEntityId: docRef.id,
        });
      }
    }
  } catch {
    /* best-effort */
  }

  auditEvent("payment_owner_confirmed", { confirmed });
  return confirmed
    ? page("¡Pago confirmado!", "Registramos que recibiste el pago. Avisamos a ambas partes. ¡Gracias!", true)
    : page("Registrado", "Marcamos el pago como pendiente de revisión y avisamos al inquilino.", true);
}
