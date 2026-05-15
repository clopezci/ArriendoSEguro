/**
 * Tipos de novedad o solicitud entre partes del expediente (Bloque 10).
 * Valores en mayúsculas para persistencia estable en Firestore.
 */
export const NOVEDAD_TIPO_IDS = [
  "INCUMPLIMIENTO_PAGO",
  "DANIO_PROPIEDAD",
  "FALLA_SERVICIOS",
  "RUIDO_CONVIVENCIA",
  "SOLICITUD_REPARACION",
  "SOLICITUD_PRORROGA",
  "OTRA",
] as const;

export type NovedadTipoId = (typeof NOVEDAD_TIPO_IDS)[number];

export const NOVEDAD_TIPO_LABELS: Record<NovedadTipoId, string> = {
  INCUMPLIMIENTO_PAGO: "Incumplimiento de pago",
  DANIO_PROPIEDAD: "Daño en la propiedad",
  FALLA_SERVICIOS: "Falla de servicios",
  RUIDO_CONVIVENCIA: "Ruido o convivencia",
  SOLICITUD_REPARACION: "Solicitud de reparación",
  SOLICITUD_PRORROGA: "Solicitud de prórroga",
  OTRA: "Otra",
};

export type ExpedienteNovedadRecord = {
  id: string;
  contractId: string;
  contractVersionId: string;
  tipo: NovedadTipoId;
  description: string;
  createdAt: string;
  authorUserId: string;
  authorEmail: string;
  authorRole: string;
  /** Correos a los que se intentó notificar (contraparte y codeudor si aplica). */
  notifiedEmails?: string[];
  attachmentStoragePath?: string;
  attachmentContentType?: string;
  attachmentOriginalName?: string;
  attachmentUrl?: string | null;
};
