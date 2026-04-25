export type PlatformPlanCode = "basic_demo" | "plus" | "premium_future";
export type PlatformOrderPlanCode = "plus";
export type PlatformProvider = "mock" | "wompi";
export type PlatformCurrency = "COP";

export type PlatformOrderStatus =
  | "created"
  | "pending"
  | "approved"
  | "rejected"
  | "expired"
  | "cancelled";

export type AccessType = "demo" | "plus_paid" | "future";
export type AccessEntitlementStatus = "active" | "used" | "expired" | "cancelled";

export interface PlatformOrder {
  id: string;
  userId: string;
  userEmail: string;
  leaseProcessId: string | null;
  planCode: PlatformOrderPlanCode;
  amount: number;
  currency: PlatformCurrency;
  status: PlatformOrderStatus;
  paymentProvider: PlatformProvider;
  providerReference: string;
  checkoutUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformPayment {
  id: string;
  orderId: string;
  userId: string;
  userEmail: string;
  provider: PlatformProvider;
  providerPaymentId: string;
  amount: number;
  currency: PlatformCurrency;
  status: string;
  paymentMethod: string;
  rawProviderResponse: string;
  approvedAt?: string;
  createdAt: string;
}

export interface AccessEntitlement {
  id: string;
  userId: string;
  userEmail: string;
  leaseProcessId: string | null;
  planCode: PlatformPlanCode;
  accessType: AccessType;
  status: AccessEntitlementStatus;
  maxContractsAllowed: number;
  contractsUsed: number;
  validUntil?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WompiWebhookEvent {
  event: string;
  data?: {
    transaction?: {
      id?: string;
      status?: string;
      amount_in_cents?: number;
      currency?: string;
      reference?: string;
      payment_method_type?: string;
    };
  };
  signature?: {
    checksum?: string;
    properties?: string[];
  };
}

