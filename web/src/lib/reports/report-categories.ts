/** Categorías del formulario de reporte de usuario. Compartido cliente/servidor. */
export const REPORT_CATEGORIES = [
  "Error o bug",
  "Algo no funciona como esperaba",
  "Sugerencia o mejora",
  "Queja",
  "Otro",
] as const;

export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

/** Estados de gestión de un reporte en el panel admin. */
export const REPORT_STATUSES = ["new", "in_review", "resolved", "dismissed"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  new: "Nuevo",
  in_review: "En revisión",
  resolved: "Resuelto",
  dismissed: "Descartado",
};
