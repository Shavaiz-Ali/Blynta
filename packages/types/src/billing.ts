import type { SubscriptionPlan } from "./plans";

export const CREDIT_PRODUCT = {
  AI_CLIPS: "ai-clips",
  STUDIO: "studio",
  ACCOUNT: "account",
} as const;
export type CreditProduct =
  (typeof CREDIT_PRODUCT)[keyof typeof CREDIT_PRODUCT];
export const CREDIT_TRANSACTION_TYPE = {
  OPENING: "opening",
  GRANT: "grant",
  RESERVE: "reserve",
  CHARGE: "charge",
  RELEASE: "release",
  REFUND: "refund",
  ADJUSTMENT: "adjustment",
} as const;
export type CreditTransactionType =
  (typeof CREDIT_TRANSACTION_TYPE)[keyof typeof CREDIT_TRANSACTION_TYPE];
export interface BillingPlan {
  id: SubscriptionPlan;
  credits: number;
  enabled: boolean;
  price?: { amount: string; currencyCode: string };
}
export interface CreditBalance {
  enabled: boolean;
  available: number;
  reserved: number;
  plan: SubscriptionPlan;
  monthlyCredits: number;
  totalGranted?: number;
  totalConsumed?: number;
  paymentCreditsOwed?: number;
  planAllocations?: Record<SubscriptionPlan, number>;
  freeCreditsRenew?: boolean;
  nextRenewal?: string | null;
  clipExample?: {
    sourceCredits: number;
    renderCredits: number;
    totalCredits: number;
  };
  pricing: {
    version: string;
    sourceSeconds: number;
    outputSeconds: number;
    studioSeconds: number;
    studioModifier: number;
    aiCredits: number;
  };
}
export interface CreditEstimate {
  enabled: boolean;
  totalCredits: number;
  available: number;
  availableCredits?: number;
  reservedCredits?: number;
  estimatedSourceCredits?: number;
  estimatedOutputCredits?: number;
  maximumReservation?: number;
  remainingAfterReservation?: number;
  hasEnoughCredits?: boolean;
  creditsNeeded?: number;
  canProceed?: boolean;
  pricingVersion: string;
  sourceCredits?: number;
  renderCredits?: number;
  metadataSourceSeconds?: number;
  sourceSeconds?: number;
  maxOutputSeconds?: number;
  clipTargetMin?: number;
  clipTargetMax?: number;
  duration?: number;
}
export interface CreditTransaction {
  _id: string;
  product: CreditProduct;
  type: CreditTransactionType;
  amount: number;
  availableDelta: number;
  reservedDelta: number;
  description: string;
  relatedId?: string;
  operationId: string;
  pricingVersion?: string;
  createdAt: string;
}
export interface CreditHistoryPage {
  rows: CreditTransaction[];
  page: number;
  total: number;
  totalPages: number;
}
