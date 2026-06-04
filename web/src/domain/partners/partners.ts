/**
 * Aliados (servicios de terceros) y control de referidos para comisión.
 *
 * Modelo: el usuario pulsa "Contactar" en un aliado → se crea un **lead** y se
 * envía a los correos (ocultos) del aliado. El ciclo se cierra con **doble
 * confirmación** independiente (aliado y usuario) mediante enlaces con token.
 *
 * Anti-fraude: nosotros guardamos el registro del envío (fecha) y la
 * confirmación del **usuario**. Si el aliado niega el referido para no pagar la
 * comisión, el "sí" del usuario es la evidencia. El admin resuelve las disputas.
 *
 * Módulo **puro** (sin Firebase ni red).
 */

export const PARTNERS_COLLECTION = "partners";
export const PARTNER_LEADS_COLLECTION = "partner_leads";

export const PARTNER_CATEGORIES = [
  "recaudo",
  "seguro",
  "estudio_credito",
  "mantenimiento",
  "juridica",
  "cobranza",
  "otro",
] as const;
export type PartnerCategory = (typeof PARTNER_CATEGORIES)[number];

export const PARTNER_CATEGORY_LABELS: Record<PartnerCategory, string> = {
  recaudo: "Recaudo del canon",
  seguro: "Seguro de arrendamiento",
  estudio_credito: "Estudio de crédito",
  mantenimiento: "Mantenimiento y reparaciones",
  juridica: "Asesoría jurídica",
  cobranza: "Cobranza",
  otro: "Otro servicio",
};

export function isPartnerCategory(v: unknown): v is PartnerCategory {
  return typeof v === "string" && (PARTNER_CATEGORIES as readonly string[]).includes(v);
}

export type LeadResponse = "taken" | "not_taken";

export type LeadOutcomeCode =
  | "pending"
  | "awaiting_partner"
  | "awaiting_user"
  | "converted"
  | "not_converted"
  | "disputed";

export interface LeadOutcome {
  code: LeadOutcomeCode;
  label: string;
  /** Si hay base creíble para cobrar comisión (al menos una parte confirma "tomado"). */
  commissionEligible: boolean;
  /** Conflicto entre las dos confirmaciones: requiere revisión del admin. */
  needsReview: boolean;
}

/**
 * Deriva el estado del lead a partir de las dos confirmaciones independientes.
 */
export function deriveLeadOutcome(
  partnerResponse: LeadResponse | null | undefined,
  userResponse: LeadResponse | null | undefined,
): LeadOutcome {
  const p = partnerResponse ?? null;
  const u = userResponse ?? null;

  if (p === "taken" && u === "taken") {
    return { code: "converted", label: "Convertido (ambos confirman)", commissionEligible: true, needsReview: false };
  }
  if (p === "not_taken" && u === "not_taken") {
    return { code: "not_converted", label: "No se concretó", commissionEligible: false, needsReview: false };
  }
  // Conflicto explícito entre ambas partes.
  if ((p === "taken" && u === "not_taken") || (p === "not_taken" && u === "taken")) {
    return { code: "disputed", label: "En disputa (revisar)", commissionEligible: u === "taken", needsReview: true };
  }
  // Falta una de las dos respuestas.
  if (u === "taken" && p == null) {
    return { code: "awaiting_partner", label: "Usuario confirmó; falta el aliado", commissionEligible: true, needsReview: false };
  }
  if (p === "taken" && u == null) {
    return { code: "awaiting_user", label: "Aliado confirmó; falta el usuario", commissionEligible: true, needsReview: false };
  }
  if (u === "not_taken" && p == null) {
    return { code: "awaiting_partner", label: "Usuario dijo que no; falta el aliado", commissionEligible: false, needsReview: false };
  }
  if (p === "not_taken" && u == null) {
    return { code: "awaiting_user", label: "Aliado dijo que no; falta el usuario", commissionEligible: false, needsReview: false };
  }
  return { code: "pending", label: "Pendiente de confirmación", commissionEligible: false, needsReview: false };
}

/** Normaliza y valida los campos de un aliado para guardarlo. */
export interface PartnerInput {
  name: string;
  category: PartnerCategory;
  description?: string;
  websiteUrl?: string;
  contactEmails: string[];
  active: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export function parseContactEmails(raw: string | string[]): string[] {
  const list = Array.isArray(raw) ? raw : String(raw ?? "").split(/[,;\n]/);
  const out: string[] = [];
  for (const e of list) {
    const t = e.trim().toLowerCase();
    if (EMAIL_RE.test(t) && !out.includes(t)) out.push(t);
  }
  return out;
}

export function validatePartnerInput(input: {
  name?: unknown;
  category?: unknown;
  description?: unknown;
  websiteUrl?: unknown;
  contactEmails?: unknown;
  active?: unknown;
}): { ok: true; value: PartnerInput } | { ok: false; message: string } {
  const name = String(input.name ?? "").trim();
  if (name.length < 2 || name.length > 120) return { ok: false, message: "El nombre del aliado es obligatorio." };
  if (!isPartnerCategory(input.category)) return { ok: false, message: "Categoría inválida." };
  const emails = parseContactEmails((input.contactEmails as string | string[]) ?? "");
  if (emails.length === 0) return { ok: false, message: "Indica al menos un correo de contacto del aliado." };
  const websiteUrl = String(input.websiteUrl ?? "").trim();
  if (websiteUrl && !/^https?:\/\//i.test(websiteUrl)) {
    return { ok: false, message: "El enlace debe empezar con http:// o https://" };
  }
  return {
    ok: true,
    value: {
      name,
      category: input.category,
      description: String(input.description ?? "").trim().slice(0, 600) || undefined,
      websiteUrl: websiteUrl || undefined,
      contactEmails: emails,
      active: Boolean(input.active),
    },
  };
}

/** Aliados de prueba (se siembran si el directorio está vacío; edítalos en /admin). */
export function seedTestPartners(fallbackEmail: string): PartnerInput[] {
  const email = EMAIL_RE.test(fallbackEmail) ? fallbackEmail.toLowerCase() : "aliados@arriendoseguro.app";
  return [
    {
      name: "Aliado de prueba · Recaudo",
      category: "recaudo",
      description: "Ejemplo de aliado de recaudo del canon. Edítalo o desactívalo en el panel.",
      websiteUrl: "https://arriendoseguro.app",
      contactEmails: [email],
      active: true,
    },
    {
      name: "Aliado de prueba · Seguro de arrendamiento",
      category: "seguro",
      description: "Ejemplo de aliado de seguro de arrendamiento. Edítalo o desactívalo en el panel.",
      websiteUrl: "https://arriendoseguro.app",
      contactEmails: [email],
      active: true,
    },
    {
      name: "Aliado de prueba · Estudio de crédito",
      category: "estudio_credito",
      description: "Ejemplo de aliado de estudio de crédito. Edítalo o desactívalo en el panel.",
      websiteUrl: "https://arriendoseguro.app",
      contactEmails: [email],
      active: true,
    },
  ];
}
