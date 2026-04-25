import type { AccessType, PlatformPlanCode } from "./types";

export const PLATFORM_PLAN_PLUS_PRICE_COP = 39_900;

export const PLATFORM_PLANS: Record<
  PlatformPlanCode,
  {
    code: PlatformPlanCode;
    title: string;
    priceCop: number;
    purchasable: boolean;
    accessType: AccessType;
  }
> = {
  basic_demo: {
    code: "basic_demo",
    title: "Plan Básico Demo",
    priceCop: 0,
    purchasable: false,
    accessType: "demo",
  },
  plus: {
    code: "plus",
    title: "Plan Plus",
    priceCop: PLATFORM_PLAN_PLUS_PRICE_COP,
    purchasable: true,
    accessType: "plus_paid",
  },
  premium_future: {
    code: "premium_future",
    title: "Plan Premium",
    priceCop: 0,
    purchasable: false,
    accessType: "future",
  },
};

