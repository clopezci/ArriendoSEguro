/**
 * Módulo de **mantenimiento / reparaciones** del inmueble arrendado.
 *
 * Flujo: el **inquilino reporta** un daño (abierto) → el **dueño responde**
 * (acepta o rechaza con motivo). Si el inquilino insiste tras un rechazo, el
 * reporte se reabre. Cuando el dueño rechaza repetidamente (umbral), el reporte
 * pasa a **en disputa** y a ambas partes se les ofrece la asesoría jurídica de
 * un aliado. Módulo **puro** (sin Node ni red) para poder testear la lógica.
 */

export type MaintenanceStatus =
  | "open" // reportado por el inquilino, esperando respuesta del dueño
  | "accepted" // el dueño aceptó atenderlo
  | "rejected" // el dueño lo rechazó (con motivo)
  | "in_dispute" // rechazos repetidos → conflicto: se ofrece asesoría jurídica
  | "resolved" // reparación resuelta
  | "cancelled"; // el inquilino lo retiró

export type MaintenanceCategory =
  | "plumbing"
  | "electrical"
  | "structural"
  | "appliances"
  | "locks"
  | "other";

export const MAINTENANCE_CATEGORY_LABELS: Record<MaintenanceCategory, string> = {
  plumbing: "Plomería / agua",
  electrical: "Electricidad",
  structural: "Estructura / techos / humedad",
  appliances: "Electrodomésticos",
  locks: "Cerraduras / seguridad",
  other: "Otro",
};

export const MAINTENANCE_CATEGORIES = Object.keys(MAINTENANCE_CATEGORY_LABELS) as MaintenanceCategory[];

/** Rechazos del dueño a partir de los cuales el reporte entra en disputa. */
export const DISPUTE_REJECTION_THRESHOLD = 2;

export const MAINTENANCE_TITLE_MAX = 120;
export const MAINTENANCE_DESC_MAX = 1500;
export const MAINTENANCE_REASON_MAX = 1000;

export type OwnerResponse = {
  action: "accept" | "reject";
  reason: string | null;
  at: string;
};

export type MaintenanceRequest = {
  id: string;
  contractId: string;
  contractVersionId: string;
  reportedByUid: string;
  reportedByEmail: string;
  reportedByRole: string;
  title: string;
  description: string;
  category: MaintenanceCategory;
  photoPath: string | null;
  status: MaintenanceStatus;
  rejectionCount: number;
  responses: OwnerResponse[];
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
};

/** ¿El estado corresponde a un conflicto que amerita ofrecer asesoría jurídica? */
export function isInDispute(status: MaintenanceStatus): boolean {
  return status === "in_dispute";
}

/** ¿Está el reporte cerrado (sin más acciones de flujo)? */
export function isClosed(status: MaintenanceStatus): boolean {
  return status === "resolved" || status === "cancelled";
}

export type MaintenanceInput = {
  title: string;
  description: string;
  category: string;
};

export function validateMaintenanceInput(
  input: MaintenanceInput,
): { ok: true; values: { title: string; description: string; category: MaintenanceCategory } } | { ok: false; error: string } {
  const title = (input.title ?? "").trim();
  const description = (input.description ?? "").trim();
  const category = (input.category ?? "").trim();
  if (title.length < 3 || title.length > MAINTENANCE_TITLE_MAX) {
    return { ok: false, error: `El título debe tener entre 3 y ${MAINTENANCE_TITLE_MAX} caracteres.` };
  }
  if (description.length < 5 || description.length > MAINTENANCE_DESC_MAX) {
    return { ok: false, error: `Describe el problema (entre 5 y ${MAINTENANCE_DESC_MAX} caracteres).` };
  }
  if (!(MAINTENANCE_CATEGORIES as string[]).includes(category)) {
    return { ok: false, error: "Elige una categoría válida." };
  }
  return { ok: true, values: { title, description, category: category as MaintenanceCategory } };
}

/**
 * Aplica una respuesta del dueño (aceptar/rechazar) al reporte y calcula el
 * nuevo estado y el contador de rechazos. Al **rechazar**, si con este rechazo
 * se alcanza el umbral, el reporte entra en **disputa**.
 */
export function applyOwnerResponse(
  current: Pick<MaintenanceRequest, "status" | "rejectionCount" | "responses">,
  action: "accept" | "reject",
  reason: string | null,
  at: string,
): { status: MaintenanceStatus; rejectionCount: number; responses: OwnerResponse[] } {
  const responses = [...current.responses, { action, reason: reason?.trim() || null, at }];
  if (action === "accept") {
    return { status: "accepted", rejectionCount: current.rejectionCount, responses };
  }
  const rejectionCount = current.rejectionCount + 1;
  const status: MaintenanceStatus = rejectionCount >= DISPUTE_REJECTION_THRESHOLD ? "in_dispute" : "rejected";
  return { status, rejectionCount, responses };
}

/**
 * Reapertura por parte del inquilino tras un rechazo (insistir). Mantiene el
 * historial de rechazos; si ya estaba en disputa, permanece en disputa.
 */
export function reopenAfterRejection(
  current: Pick<MaintenanceRequest, "status" | "rejectionCount">,
): { status: MaintenanceStatus } {
  if (current.status === "in_dispute") return { status: "in_dispute" };
  if (current.status === "rejected") return { status: "open" };
  return { status: current.status };
}
