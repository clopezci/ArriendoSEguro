import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireCronAuth } from "@/lib/security/cron";
import { sendEmail } from "@/services/email/sendEmail";
import { CUSTOM_ALERTS_COLLECTION, nextFireAfter, type AlertFrequency } from "@/domain/contracts/customAlerts";
import { auditEvent } from "@/features/contracts/audit-server";
import { logServerError } from "@/lib/observability/observability";

export const runtime = "nodejs";

const esc = (s: string) => s.replace(/[<>]/g, (c) => (c === "<" ? "&lt;" : "&gt;"));

/**
 * Cron: envía por correo las alertas personalizadas cuya `nextFireAt` ya llegó,
 * y avanza la siguiente según su periodicidad (o desactiva las de "una vez").
 * Protegido por CRON_SECRET. Consulta por un solo campo (`nextFireAt`) para no
 * exigir índice compuesto; las desactivadas tienen `nextFireAt: null` y no entran.
 */
export async function POST(request: Request) {
  const gate = requireCronAuth(request);
  if (!gate.ok) return gate.response;
  try {
    const firestore = getAdminFirestore();
    if (!firestore) {
      return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });
    }
    const now = new Date();
    const nowIso = now.toISOString();
    const snap = await firestore
      .collection(CUSTOM_ALERTS_COLLECTION)
      .where("nextFireAt", "<=", nowIso)
      .limit(2000)
      .get();

    let processed = 0;
    for (const doc of snap.docs) {
      const a = doc.data() as {
        contractId?: string;
        ownerEmail?: string;
        name?: string;
        message?: string;
        frequency?: AlertFrequency;
        nextFireAt?: string | null;
        enabled?: boolean;
      };
      if (a.enabled === false || !a.nextFireAt || !a.frequency) continue;

      if (a.ownerEmail) {
        const name = (a.name ?? "Recordatorio").trim();
        const message = (a.message ?? "").trim();
        await sendEmail({
          to: a.ownerEmail,
          subject: `Recordatorio: ${name}`,
          html: `<p style="font-weight:bold;">${esc(name)}</p><p>${esc(message).replace(/\n/g, "<br/>")}</p><p style="color:#64748b;font-size:12px;">Alerta personalizada de tu contrato en ArriendoSeguro.</p>`,
          text: `${name}\n\n${message}\n\n(Alerta personalizada de tu contrato en ArriendoSeguro.)`,
          templateCode: "customAlertEmail",
          relatedEntityType: "contract",
          relatedEntityId: a.contractId ?? "",
        });
      }

      const next = nextFireAfter(new Date(a.nextFireAt), a.frequency, now);
      await doc.ref.set(
        next ? { nextFireAt: next.toISOString(), lastFiredAt: nowIso } : { enabled: false, nextFireAt: null, lastFiredAt: nowIso },
        { merge: true },
      );
      auditEvent("custom_alert_sent", { contractId: a.contractId ?? "", frequency: a.frequency });
      processed += 1;
    }

    return NextResponse.json({ success: true, processed });
  } catch (err) {
    await logServerError("contracts/custom-alerts/send-due", err);
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "No se pudieron enviar las alertas." }] }, { status: 500 });
  }
}
