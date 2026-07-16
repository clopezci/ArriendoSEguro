/**
 * Alertas personalizadas del contrato: el dueño crea un recordatorio propio
 * (nombre + mensaje), elige periodicidad y fecha inicial. Un cron diario las
 * envía por correo cuando llega su fecha y avanza la siguiente según la
 * periodicidad. Módulo PURO (sin Firebase/red) para reusar y testear.
 */
export const ALERT_FREQUENCIES = ["once", "daily", "weekly", "monthly", "yearly"] as const;
export type AlertFrequency = (typeof ALERT_FREQUENCIES)[number];

export const ALERT_FREQUENCY_LABELS: Record<AlertFrequency, string> = {
  once: "Una sola vez",
  daily: "Diaria",
  weekly: "Semanal",
  monthly: "Mensual",
  yearly: "Anual",
};

export const CUSTOM_ALERTS_COLLECTION = "custom_alerts";
export const ALERT_NAME_MAX = 80;
export const ALERT_MESSAGE_MAX = 500;

export function isAlertFrequency(v: unknown): v is AlertFrequency {
  return typeof v === "string" && (ALERT_FREQUENCIES as readonly string[]).includes(v);
}

/** Valida los campos de una alerta. Devuelve un mensaje de error o null. */
export function validateCustomAlert(input: {
  name?: unknown;
  message?: unknown;
  frequency?: unknown;
  startDate?: unknown;
}): string | null {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const message = typeof input.message === "string" ? input.message.trim() : "";
  const startDate = typeof input.startDate === "string" ? input.startDate.trim() : "";
  if (name.length < 2 || name.length > ALERT_NAME_MAX) return "Ponle un nombre a la alerta (2 a 80 caracteres).";
  if (message.length < 2 || message.length > ALERT_MESSAGE_MAX) return "Escribe el mensaje del recordatorio (2 a 500 caracteres).";
  if (!isAlertFrequency(input.frequency)) return "Elige una periodicidad válida.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || Number.isNaN(Date.parse(startDate))) return "Elige una fecha inicial válida.";
  return null;
}

/**
 * Próxima fecha de disparo según la periodicidad, saltando fechas ya pasadas
 * hasta superar `now`. Devuelve null para "once" (no se repite).
 */
export function nextFireAfter(current: Date, frequency: AlertFrequency, now: Date): Date | null {
  if (frequency === "once") return null;
  const next = new Date(current.getTime());
  let guard = 0;
  do {
    if (frequency === "daily") next.setUTCDate(next.getUTCDate() + 1);
    else if (frequency === "weekly") next.setUTCDate(next.getUTCDate() + 7);
    else if (frequency === "monthly") next.setUTCMonth(next.getUTCMonth() + 1);
    else if (frequency === "yearly") next.setUTCFullYear(next.getUTCFullYear() + 1);
    guard += 1;
  } while (next.getTime() <= now.getTime() && guard < 4000);
  return next;
}
