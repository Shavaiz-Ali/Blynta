export interface CreditBalance {
  enabled: boolean;
  available: number;
  reserved: number;
  plan: "free" | "pro" | "business";
  monthlyCredits: number;
  nextRenewal?: string | null;
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
  pricingVersion: string;
  sourceSeconds?: number;
  maxOutputSeconds?: number;
  duration?: number;
}
export interface CreditTransaction {
  _id: string;
  product: "ai-clips" | "studio" | "account";
  type:
    | "opening"
    | "grant"
    | "reserve"
    | "charge"
    | "release"
    | "refund"
    | "adjustment";
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
