import { CREDIT_PRODUCT, CREDIT_TRANSACTION_TYPE } from "@blynta/types";

export const CREDIT_TAB = {
  PURCHASES: "purchases",
  HISTORY: "history",
} as const;
export type CreditTab = (typeof CREDIT_TAB)[keyof typeof CREDIT_TAB];
export const CREDIT_TAB_HASH = {
  [CREDIT_TAB.PURCHASES]: "#buy-credits",
  [CREDIT_TAB.HISTORY]: "#credit-history",
} as const;
export function creditTabFromHash(hash: string): CreditTab | undefined {
  if (hash === CREDIT_TAB_HASH.purchases) return CREDIT_TAB.PURCHASES;
  if (hash === CREDIT_TAB_HASH.history) return CREDIT_TAB.HISTORY;
}
export const CREDIT_HISTORY_PAGE_SIZE = 20;
export const BILLING_CHECKOUT_TOAST_ID = "billing-checkout";
export const BILLING_ENDPOINTS = {
  credits: "/billing/credits",
  history: "/billing/credits/history",
  packs: "/billing/credit-packs",
  plans: "/billing/plans",
  checkout: "/billing/checkout-session",
  packCheckout: "/billing/credit-packs/checkout",
  portal: "/billing/customer-portal",
} as const;
export const billingKeys = {
  all: ["billing"] as const,
  credits: () => ["billing", "credits"] as const,
  history: ["billing", "history"] as const,
  historyPage: (page: number, product: string, type: string) =>
    ["billing", "history", page, product, type] as const,
  packs: () => ["billing", "packs"] as const,
  plans: () => ["billing", "plans"] as const,
};
export const CREDIT_PRODUCT_OPTIONS = [
  { value: "all", label: "All products" },
  { value: CREDIT_PRODUCT.AI_CLIPS, label: "AI Clips" },
  { value: CREDIT_PRODUCT.STUDIO, label: "Studio" },
  { value: CREDIT_PRODUCT.ACCOUNT, label: "Account" },
];
export const CREDIT_TYPE_OPTIONS = [
  { value: "all", label: "All transactions" },
  { value: CREDIT_TRANSACTION_TYPE.CHARGE, label: "Charges" },
  { value: CREDIT_TRANSACTION_TYPE.RESERVE, label: "Reservations" },
  { value: CREDIT_TRANSACTION_TYPE.RELEASE, label: "Releases" },
  { value: CREDIT_TRANSACTION_TYPE.GRANT, label: "Credit grants" },
  { value: CREDIT_TRANSACTION_TYPE.REFUND, label: "Refunds" },
  { value: CREDIT_TRANSACTION_TYPE.ADJUSTMENT, label: "Adjustments" },
  { value: CREDIT_TRANSACTION_TYPE.OPENING, label: "Opening balance" },
];
