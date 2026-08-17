import { NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/security/cron";
import { appConfig } from "@/lib/config";
import { logServerError } from "@/lib/observability/observability";
import { recordObservabilityRun } from "@/lib/observability/runlog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Da margen para que corran todas las tareas (Vercel lo acota al máximo del plan).
export const maxDuration = 60;

/**
 * Despachador de CRON diario. Vercel Cron dispara este GET una vez al día; aquí
 * ejecutamos (con el mismo CRON_SECRET) cada tarea `send-due`, que son POST.
 *
 * Un solo cron para funcionar en cualquier plan de Vercel (el gratuito limita el
 * número/frecuencia de crons). Añadir una tarea = añadir su ruta a TASKS.
 *
 * Requiere `CRON_SECRET` en el entorno; Vercel lo envía automáticamente en el
 * header `Authorization: Bearer <CRON_SECRET>` de las llamadas de cron.
 */
const TASKS = [
  "/api/payments/tenant-reminders/send-due", // recordatorios de pago al inquilino + escalamiento
  "/api/contracts/renewal-reminders/send-due", // vencimiento / renovación (preaviso 3 meses)
  "/api/contracts/delivery-act-reminders/send-due", // acta de entrega y devolución (última semana)
  "/api/legal/ipc-reminder/send-due", // aviso de incremento anual por IPC
  "/api/contracts/custom-alerts/send-due", // alertas personalizadas del dueño
  "/api/observability/error-alert/send-due", // alertas de errores (operación)
  // Auditoría/reporte de salud: TAMBIÉN aquí (el cron diario SÍ dispara con
  // seguridad). Además tiene su propio cron cada 6 h en vercel.json como extra;
  // si Vercel lo ejecuta, llegan más seguido, pero este garantiza al menos 1/día.
  "/api/observability/audit-report/send-due",
  "/api/tax/iva-threshold-check/send-due", // impuestos: auto-activa IVA al llegar al tope + alerta
  "/api/reputation/retention/purge", // caducidad: borra reputación > 4 años + limpia certificados
] as const;

export async function GET(request: Request) {
  const gate = requireCronAuth(request);
  if (!gate.ok) return gate.response;

  const secret = process.env.CRON_SECRET?.trim() ?? "";
  let origin = "";
  try {
    origin = new URL(request.url).origin;
  } catch {
    origin = appConfig.publicUrl.replace(/\/$/, "");
  }

  const ran = await Promise.all(
    TASKS.map(async (path) => {
      try {
        const res = await fetch(`${origin}${path}`, {
          method: "POST",
          headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
          cache: "no-store",
        });
        return { task: path, status: res.status };
      } catch (err) {
        await logServerError("cron/daily", err);
        return { task: path, status: "error" as const };
      }
    }),
  );

  // Heartbeat del cron diario: deja rastro de que SÍ disparó y con qué resultado
  // por tarea. Si esta bitácora no crece, el cron no se está ejecutando (Vercel).
  const ranAt = new Date().toISOString();
  await recordObservabilityRun({
    at: ranAt,
    source: "cron_daily",
    notes: `tareas:${ran.length}`,
    extra: { ran },
  });

  return NextResponse.json({ success: true, ranAt, ran });
}
