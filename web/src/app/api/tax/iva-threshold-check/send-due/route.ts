import { NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/security/cron";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { getTaxConfig, saveTaxConfig } from "@/lib/tax/serverTaxConfig";
import { ivaResponsableThresholdCop } from "@/domain/tax/taxConfig";
import { sendTelegram } from "@/services/telegram/sendTelegram";
import { appConfig } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Vigila los ingresos del año y, si alcanzan el tope legal (3.500 UVT), ACTIVA
 * solo el toggle "Responsable de IVA" y avisa por Telegram al creador para que lo
 * confirme. A partir de ese momento los precios pasan a mostrar "valor + IVA".
 *
 * Idempotente: si ya es responsable, no hace nada. Lo dispara el cron diario.
 */
export async function POST(request: Request) {
  const gate = requireCronAuth(request);
  if (!gate.ok) return gate.response;

  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json({ success: false, error: "server_not_configured" }, { status: 503 });
  }

  const tax = await getTaxConfig(firestore);
  if (tax.ivaResponsable) {
    return NextResponse.json({ success: true, alreadyResponsable: true });
  }

  // Ingresos del año en curso (pagos aprobados registrados en platform_payments).
  const now = new Date();
  const yearStartIso = new Date(now.getFullYear(), 0, 1).toISOString();
  let incomeCop = 0;
  try {
    const snap = await firestore
      .collection("platform_payments")
      .where("createdAt", ">=", yearStartIso)
      .get();
    incomeCop = snap.docs.reduce((sum, d) => sum + (Number((d.data() as { amount?: number }).amount) || 0), 0);
  } catch {
    // Si la consulta falla (índice/dato), no bloqueamos el cron.
    return NextResponse.json({ success: true, skipped: "no se pudo sumar ingresos" });
  }

  const thresholdCop = ivaResponsableThresholdCop(tax);
  const reached = incomeCop >= thresholdCop;

  const adminUrl = `${appConfig.publicUrl.replace(/\/$/, "")}/admin`;
  const fmt = (n: number) => `$${n.toLocaleString("es-CO")}`;

  if (reached) {
    // Auto-activación + alerta.
    await saveTaxConfig(
      firestore,
      { ivaResponsable: true, regime: "responsable", autoActivatedAt: now.toISOString() },
      "sistema (auto-activación por tope)",
    );
    await sendTelegram(
      `🧾 *ArriendoSeguro — IVA activado automáticamente*\n` +
        `Tus ingresos del año (${fmt(incomeCop)}) alcanzaron el tope legal de responsable de IVA (${fmt(thresholdCop)} = 3.500 UVT).\n\n` +
        `Activé el cobro de IVA (${tax.ivaRate}%). Desde ahora los precios muestran valor + IVA.\n` +
        `⚠️ *Confírmalo con tu contador* y revisa la facturación electrónica. Puedes ajustarlo en [el panel](${adminUrl}).`,
    ).catch(() => {});
    return NextResponse.json({ success: true, activated: true, incomeCop, thresholdCop });
  }

  // Pre-aviso al acercarse (≥80%), una sola vez por ventana (marca en la config).
  if (incomeCop >= thresholdCop * 0.8) {
    const warnedAt = tax.thresholdWarnedAt;
    const recentlyWarned = warnedAt && Date.now() - Date.parse(warnedAt) < 30 * 24 * 60 * 60 * 1000;
    if (!recentlyWarned) {
      await saveTaxConfig(firestore, { thresholdWarnedAt: now.toISOString() }, "sistema (pre-aviso IVA)");
      await sendTelegram(
        `⚠️ *ArriendoSeguro — te acercas al tope de IVA*\n` +
          `Ingresos del año: ${fmt(incomeCop)} de ${fmt(thresholdCop)} (3.500 UVT). Al llegar al 100% se activará el IVA automáticamente.`,
      ).catch(() => {});
    }
  }

  return NextResponse.json({ success: true, activated: false, incomeCop, thresholdCop });
}
