import { PLATFORM_PLAN_PLUS_PRICE_COP } from "./plans";

export function validatePurchasablePlan(planCode: string): {
  ok: boolean;
  message?: string;
} {
  if (planCode === "plus") return { ok: true };
  if (planCode === "premium_future") return { ok: false, message: "El Plan Premium estará disponible próximamente." };
  if (planCode === "basic_demo") return { ok: false, message: "El Plan Demo no requiere pago." };
  return { ok: false, message: "Plan no válido para checkout." };
}

export function normalizeCreateOrderIdentity(input: {
  tokenUserId: string;
  tokenUserEmail: string;
  planCode: "plus";
  leaseProcessId?: string;
}): {
  userId: string;
  userEmail: string;
  planCode: "plus";
  amount: number;
  currency: "COP";
  leaseProcessId: string | null;
} {
  return {
    userId: input.tokenUserId,
    userEmail: input.tokenUserEmail,
    planCode: input.planCode,
    amount: PLATFORM_PLAN_PLUS_PRICE_COP,
    currency: "COP",
    leaseProcessId: input.leaseProcessId ?? null,
  };
}

