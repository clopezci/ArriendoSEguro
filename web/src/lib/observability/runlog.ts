import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";

/**
 * Bitácora de corridas de observabilidad (heartbeat). Cada vez que se ejecuta un
 * cron o el reporte, dejamos un rastro en Firestore. Sirve para DIAGNOSTICAR por
 * qué "no llega nada a Telegram": si NO hay corridas recientes → el cron no está
 * disparando (problema de Vercel/schedule/auth); si hay corridas pero
 * `telegramStatus` = "failed"/"mock" → el problema es el envío (token/chat/config)
 * y aquí queda el detalle del error que normalmente se traga el try/catch.
 */
export const OBSERVABILITY_RUNS_COLLECTION = "observability_runs";

export type ObservabilityRun = {
  at: string;
  source: string; // "cron_6h" | "cron_daily" | "manual_admin" | "selftest"
  telegramStatus?: string;
  telegramSent?: number;
  telegramError?: string | null;
  notes?: string | null;
  extra?: Record<string, unknown> | null;
};

/** Escribe un rastro de corrida. Best-effort: nunca lanza. */
export async function recordObservabilityRun(run: ObservabilityRun): Promise<void> {
  try {
    const firestore = getAdminFirestore();
    if (!firestore) return;
    await firestore.collection(OBSERVABILITY_RUNS_COLLECTION).add({
      ...run,
      telegramError: run.telegramError ?? null,
      notes: run.notes ?? null,
      extra: run.extra ?? null,
      createdAtServer: FieldValue.serverTimestamp(),
    });
  } catch {
    /* si Firestore no está o falla, no rompemos la corrida */
  }
}

/** Últimas N corridas (para el panel de diagnóstico), más recientes primero. */
export async function recentObservabilityRuns(limit = 15): Promise<ObservabilityRun[]> {
  try {
    const firestore = getAdminFirestore();
    if (!firestore) return [];
    const snap = await firestore
      .collection(OBSERVABILITY_RUNS_COLLECTION)
      .orderBy("at", "desc")
      .limit(limit)
      .get();
    return snap.docs.map((d) => d.data() as ObservabilityRun);
  } catch {
    return [];
  }
}
