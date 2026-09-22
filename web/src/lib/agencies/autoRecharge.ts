import "server-only";
import type { Firestore } from "firebase-admin/firestore";
import { getAgency, getCredits, updateAgency } from "@/lib/agencies/agencyStore";
import { getAgencyPlan } from "@/domain/agencies/plans";
import { createAgencyCreditOrder } from "@/lib/agencies/creditOrders";
import { sendEmail } from "@/services/email/sendEmail";

/**
 * Auto-recarga asistida (plan Ilimitado): si la agencia la activó y su saldo
 * bajó del umbral, genera automáticamente una orden del plan elegido y le manda
 * el link de pago. Prepago (garantiza el cobro), sin frenar su operación. Evita
 * duplicar órdenes con `pendingOrderId`. Best-effort: nunca lanza.
 *
 * (El cobro 100% silencioso con tarjeta tokenizada requiere habilitar payment
 * sources de Wompi; esta versión asistida es el paso seguro previo.)
 */
export async function triggerAutoRechargeIfNeeded(
  firestore: Firestore,
  agencyId: string,
  actorUid: string,
): Promise<void> {
  try {
    const agency = await getAgency(firestore, agencyId);
    const cfg = agency?.autoRecharge;
    if (!agency || !cfg?.enabled || !cfg.planCode) return;

    const balance = (await getCredits(firestore, agencyId)).balance;
    if (balance > (cfg.thresholdCredits ?? 0)) return;

    // ¿Ya hay una orden de auto-recarga pendiente? No dupliques… salvo que esté
    // ABANDONADA (checkout nunca pagado): si lleva >24h en pending/created, la
    // damos por vencida y permitimos generar una nueva (si no, la auto-recarga
    // quedaría bloqueada para siempre con saldo en 0).
    const ABANDON_MS = 24 * 60 * 60 * 1000;
    if (cfg.pendingOrderId) {
      const snap = await firestore.collection("platform_orders").doc(cfg.pendingOrderId).get();
      const data = snap.exists ? (snap.data() as { status?: string; createdAt?: string }) : null;
      const st = data?.status ?? null;
      if (st === "approved" || st === "settled") return; // ya se pagó/liquidó
      if (st === "pending" || st === "created") {
        const ageMs = data?.createdAt ? Date.now() - new Date(data.createdAt).getTime() : Number.POSITIVE_INFINITY;
        if (ageMs < ABANDON_MS) return; // aún vigente: no dupliques
        // vencida → continúa y se generará una nueva orden (se reemplaza pendingOrderId)
      }
    }

    const plan = await getAgencyPlan(firestore, cfg.planCode);
    if (!plan) return;

    const order = await createAgencyCreditOrder(firestore, {
      agencyId,
      plan,
      userId: actorUid,
      userEmail: agency.contactEmail,
      via: "auto_recharge",
    });

    await updateAgency(firestore, agencyId, {
      autoRecharge: { enabled: cfg.enabled, planCode: cfg.planCode, thresholdCredits: cfg.thresholdCredits, pendingOrderId: order.orderId },
    });

    if (agency.contactEmail) {
      await sendEmail({
        to: agency.contactEmail,
        subject: `Recarga tu saldo de créditos — ${agency.name}`,
        html: `<p>Hola,</p><p>Tu saldo de créditos está bajo (<strong>${balance}</strong>). Para no frenar la firma de tus contratos, recarga el plan <strong>${plan.name}</strong> (${plan.credits} créditos):</p><p><a href="${order.checkoutUrl}">Pagar recarga</a></p><p>Al confirmarse el pago, tus créditos se recargan automáticamente.</p>`,
        text: `Tu saldo de créditos está bajo (${balance}). Recarga ${plan.name}: ${order.checkoutUrl}`,
        templateCode: "agencyAutoRechargeEmail",
        relatedEntityType: "agency",
        relatedEntityId: agencyId,
      }).catch(() => {});
    }
  } catch {
    /* best-effort */
  }
}
