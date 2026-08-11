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
  | "open" // reportado, esperando respuesta de la otra parte
  | "in_review" // la otra parte respondió "lo revisaré"
  | "accepted" // la otra parte aceptó / se atenderá
  | "rejected" // la otra parte respondió "no procede" (con motivo)
  | "in_dispute" // negativas repetidas → conflicto: se ofrece asesoría jurídica
  | "resolved" // resuelto
  | "cancelled"; // quien lo creó lo retiró

/**
 * TIPO de reporte/solicitud. Cada rol ve solo los suyos. El inquilino reporta
 * problemas; el dueño hace solicitudes (algunas con texto predeterminado del
 * contrato). `role` = quién puede crearlo; `useCategory` = usa las categorías de
 * daño; `template` = qué texto predeterminado se pre-carga.
 */
export type RequestType =
  | "damage" | "request" | "need" // inquilino
  | "repair" | "charge" | "return" | "complaint" | "owner_request"; // dueño

export type RequestTypeDef = {
  type: RequestType;
  label: string;
  icon: string;
  role: "tenant" | "landlord";
  useCategory: boolean;
  template: "none" | "charge" | "return";
  hint: string;
};

export const REQUEST_TYPES: RequestTypeDef[] = [
  { type: "damage", label: "Daño", icon: "🔧", role: "tenant", useCategory: true, template: "none", hint: "Algo se dañó y necesita reparación." },
  { type: "request", label: "Solicitud", icon: "📩", role: "tenant", useCategory: false, template: "none", hint: "Algo que le pides al dueño." },
  { type: "need", label: "Necesidad", icon: "🙋", role: "tenant", useCategory: false, template: "none", hint: "Algo que necesitas para el inmueble." },
  { type: "repair", label: "Reparación o mejora", icon: "🛠️", role: "landlord", useCategory: true, template: "none", hint: "Informas/coordinas una reparación o mejora." },
  { type: "charge", label: "Solicitud de cobro", icon: "💰", role: "landlord", useCategory: false, template: "charge", hint: "Requerimiento de pago del canon." },
  { type: "return", label: "Entrega / restitución del inmueble", icon: "🏠", role: "landlord", useCategory: false, template: "return", hint: "Solicitas la entrega del inmueble." },
  { type: "complaint", label: "Queja", icon: "⚠️", role: "landlord", useCategory: false, template: "none", hint: "Mal uso, ruido, incumplimiento…" },
  { type: "owner_request", label: "Otra solicitud", icon: "📩", role: "landlord", useCategory: false, template: "none", hint: "Otra solicitud al inquilino." },
];

export function requestTypeDef(type: string | null | undefined): RequestTypeDef | null {
  return REQUEST_TYPES.find((t) => t.type === type) ?? null;
}

/** Bucket del rol: el dueño es "landlord"; inquilino y codeudores son "tenant". */
export function roleBucket(role: string): "landlord" | "tenant" {
  return role === "landlord" ? "landlord" : "tenant";
}

/** ¿Este rol puede crear este tipo? */
export function canCreateType(type: string, role: string): boolean {
  const def = requestTypeDef(type);
  if (!def) return false;
  return def.role === roleBucket(role);
}

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

/** Respuesta de la CONTRAPARTE (quien recibe el reporte/solicitud). */
export type ResponseAction = "will_review" | "accept" | "reject";

export const RESPONSE_ACTION_LABELS: Record<ResponseAction, string> = {
  will_review: "Lo revisaré",
  accept: "De acuerdo / lo atenderé",
  reject: "No procede",
};

export type OwnerResponse = {
  action: ResponseAction;
  reason: string | null;
  at: string;
  byRole?: string;
};

export type MaintenanceRequest = {
  id: string;
  contractId: string;
  contractVersionId: string;
  type: RequestType;
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
  action: ResponseAction,
  reason: string | null,
  at: string,
  byRole?: string,
): { status: MaintenanceStatus; rejectionCount: number; responses: OwnerResponse[] } {
  const responses = [...current.responses, { action, reason: reason?.trim() || null, at, byRole }];
  if (action === "will_review") {
    return { status: "in_review", rejectionCount: current.rejectionCount, responses };
  }
  if (action === "accept") {
    return { status: "accepted", rejectionCount: current.rejectionCount, responses };
  }
  // "reject" = no procede: cuenta para la disputa.
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
