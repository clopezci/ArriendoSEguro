export const users = {
  owner: { uid: "uid_owner", email: "owner@test.com" },
  other: { uid: "uid_other", email: "other@test.com" },
};

export const tokens = {
  owner: "token_owner",
  other: "token_other",
  invalid: "token_invalid",
};

export function makePlatformOrder(input?: Partial<{
  id: string;
  userId: string;
  userEmail: string;
  providerReference: string;
  status: string;
  planCode: string;
  amount: number;
  currency: string;
}>) {
  return {
    id: input?.id ?? "order_1",
    userId: input?.userId ?? users.owner.uid,
    userEmail: input?.userEmail ?? users.owner.email,
    leaseProcessId: null,
    planCode: input?.planCode ?? "plus",
    amount: input?.amount ?? 49900,
    currency: input?.currency ?? "COP",
    status: input?.status ?? "pending",
    paymentProvider: "wompi",
    providerReference: input?.providerReference ?? "AS_PLUS_REF_1",
    checkoutUrl: "https://checkout.test",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

