import { randomBytes } from "node:crypto";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { sendEmail } from "@/services/email/sendEmail";
import { auditEvent } from "@/features/contracts/audit-server";
import { checkRateLimit, RATE_LIMIT_RULES, clientIpFromRequest } from "@/lib/security/rate-limit";
import { appConfig } from "@/lib/config";
import { oneClickPage } from "@/lib/payments/oneClickPage";

export const runtime = "nodejs";

/**
 * El INQUILINO registra (1 clic, sin login) que está en conciliación con el
 * arrendador por un pago. Marca la conciliación como "solicitada" y avisa al
 * dueño con un enlace para ACEPTARLA. Los recordatorios NO se detienen hasta que
 * el dueño acepta.
 */
export async function GET(request: Request) {
  const rl = await checkRateLimit(clientIpFromRequest(request), RATE_LIMIT_RULES.publicToken);
  if (!rl.ok) return oneClickPage("Demasiadas solicitudes", "Espera un momento e inténtalo de nuevo.", false);

  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!token) return oneClickPage("Enlace inválido", "El enlace no es válido.", false);
  const firestore = getAdminFirestore();
  if (!firestore) return oneClickPage("No disponible", "El servicio no está disponible ahora.", false);

  const snap = await firestore.collection("scheduled_payments").where("escConciliationTenantToken", "==", token).limit(1).get().catch(() => null);
  if (!snap || snap.empty) return oneClickPage("Enlace no encontrado", "No encontramos esta solicitud. Es posible que ya se haya procesado.", false);
  const docRef = snap.docs[0].ref;
  const row = snap.docs[0].data() as { contractVersionId?: string; periodLabel?: string; escConciliationStatus?: string; escConciliationOwnerToken?: string };

  if (row.escConciliationStatus === "accepted") {
    return oneClickPage("Ya aceptada", "El arrendador ya aceptó la conciliación de este pago.", true);
  }

  const ownerToken = row.escConciliationOwnerToken || randomBytes(24).toString("hex");
  const now = new Date().toISOString();
  await docRef.set({ escConciliationStatus: "requested", escConciliationRequestedAt: now, escConciliationOwnerToken: ownerToken, updatedAt: now }, { merge: true });

  // Avisar al arrendador con el enlace de aceptación.
  try {
    if (row.contractVersionId) {
      const vSnap = await firestore.collection("contract_versions").doc(row.contractVersionId).get();
      const landlordEmail = ((vSnap.data() as { contractPayload?: { landlord?: { email?: string } } } | undefined)?.contractPayload?.landlord?.email ?? "").trim();
      if (landlordEmail) {
        const base = appConfig.publicUrl.replace(/\/$/, "");
        const acceptUrl = `${base}/api/payments/conciliation/accept?token=${ownerToken}`;
        const per = row.periodLabel ? ` (${row.periodLabel})` : "";
        await sendEmail({
          to: landlordEmail,
          subject: `Tu inquilino registró una conciliación${row.periodLabel ? ` · ${row.periodLabel}` : ""}`,
          html: `<p>Tu inquilino registró que están en un <strong>acuerdo de conciliación</strong> por el pago${per}.</p><p>Si es correcto, <a href="${acceptUrl}">acepta la conciliación</a> para <strong>pausar los recordatorios automáticos</strong> de ese pago. Si no lo reconoces, ignora este correo y los recordatorios continuarán.</p>`,
          text: `Tu inquilino registró una conciliación por el pago${per}. Acéptala para pausar los recordatorios: ${acceptUrl}`,
          templateCode: "paymentEscalationEmail",
          relatedEntityType: "payment",
          relatedEntityId: docRef.id,
        });
      }
    }
  } catch {
    /* best-effort */
  }

  auditEvent("payment_conciliation_requested", { contractId: (snap.docs[0].data() as { contractId?: string }).contractId ?? "" });
  return oneClickPage("Conciliación registrada", "Le avisamos al arrendador para que la acepte. Mientras tanto, los recordatorios pueden continuar hasta que él la confirme.", true);
}
