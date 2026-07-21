import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireCronAuth } from "@/lib/security/cron";
import { maybeSendErrorAlert } from "@/lib/observability/errorAlert";

export const runtime = "nodejs";

/**
 * Cron: avisa por correo y Telegram cuando hay errores recientes sin resolver por
 * encima del umbral (mínimo 1). Respeta el "cooldown" para no saturar. La misma
 * evaluación se dispara además en la ingesta de errores (`client-error`) para que
 * el aviso llegue al instante. Protegido por CRON_SECRET.
 */
export async function POST(request: Request) {
  const gate = requireCronAuth(request);
  if (!gate.ok) return gate.response;

  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });
  }

  const result = await maybeSendErrorAlert(firestore);
  if (!result.sent) {
    return NextResponse.json({ success: true, skipped: result.reason, distinctErrors: result.distinctErrors ?? 0 });
  }
  return NextResponse.json({
    success: true,
    sent: result.emailSent ?? 0,
    telegramSent: result.telegramSent ?? 0,
    distinctErrors: result.distinctErrors ?? 0,
    totalOccurrences: result.totalOccurrences ?? 0,
  });
}
