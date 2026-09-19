import "server-only";
import type { Firestore } from "firebase-admin/firestore";

/**
 * Catálogo de planes de crédito para agencias (prepago). Cada plan = un paquete
 * de créditos por un precio. Editable desde /admin (se guarda en Firestore); si
 * no hay config guardada, usa los valores por defecto.
 */

export interface AgencyPlan {
  code: string;
  name: string;
  credits: number;
  priceCop: number;
  active: boolean;
}

/** Planes por defecto (confirmados con el usuario, anclados al precio real $79.900). */
export const DEFAULT_AGENCY_PLANS: AgencyPlan[] = [
  { code: "inicial", name: "Agencia Inicial", credits: 10, priceCop: 599_000, active: true },
  { code: "crecimiento", name: "Agencia Crecimiento", credits: 30, priceCop: 1_497_000, active: true },
  { code: "pro", name: "Agencia Pro", credits: 60, priceCop: 2_394_000, active: true },
  { code: "enterprise", name: "Agencia Enterprise", credits: 120, priceCop: 3_588_000, active: true },
];

const CONFIG_PATH = "admin_config/agency_plans";

function sanitizePlans(input: unknown): AgencyPlan[] {
  if (!Array.isArray(input)) return [];
  const out: AgencyPlan[] = [];
  const used = new Set<string>();
  for (const raw of input.slice(0, 20)) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const name = typeof r.name === "string" ? r.name.trim().slice(0, 80) : "";
    const credits = Math.floor(Number(r.credits ?? 0));
    const priceCop = Math.floor(Number(r.priceCop ?? 0));
    if (!name || credits <= 0 || priceCop <= 0) continue;
    let code = (typeof r.code === "string" && r.code.trim() ? r.code : name)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "plan";
    while (used.has(code)) code = `${code}_2`;
    used.add(code);
    out.push({ code, name, credits, priceCop, active: r.active !== false });
  }
  return out;
}

export async function getAgencyPlans(firestore: Firestore): Promise<AgencyPlan[]> {
  try {
    const snap = await firestore.doc(CONFIG_PATH).get();
    const data = snap.exists ? (snap.data() as { plans?: unknown }) : null;
    const plans = sanitizePlans(data?.plans);
    if (plans.length) return plans;
  } catch {
    /* usa defaults */
  }
  return DEFAULT_AGENCY_PLANS;
}

export async function getAgencyPlan(firestore: Firestore, code: string): Promise<AgencyPlan | null> {
  const plans = await getAgencyPlans(firestore);
  return plans.find((p) => p.code === code && p.active) ?? null;
}

export async function setAgencyPlans(firestore: Firestore, input: unknown): Promise<AgencyPlan[]> {
  const plans = sanitizePlans(input);
  await firestore.doc(CONFIG_PATH).set({ plans, updatedAt: new Date().toISOString() }, { merge: true });
  return plans;
}
