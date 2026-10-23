import { UserPlan, type SubscriptionPlan } from "./contracts";

// Reuse the serialized contract; do not declare another set of plan IDs.
export { UserPlan as PLAN } from "./contracts";
export type { SubscriptionPlan } from "./contracts";
export type PaidPlan = Exclude<SubscriptionPlan, "free">;
export const PLAN_LABELS: Record<SubscriptionPlan, string> = {
  [UserPlan.FREE]: "Free",
  [UserPlan.PRO]: "Pro",
  [UserPlan.BUSINESS]: "Business",
};
const order: Record<SubscriptionPlan, number> = {
  [UserPlan.FREE]: 0,
  [UserPlan.PRO]: 1,
  [UserPlan.BUSINESS]: 2,
};
/** Presentation ordering only. The backend decides whether a change is permitted. */
export function getPlanChangeType(
  current: SubscriptionPlan,
  target: SubscriptionPlan,
): "current" | "upgrade" | "downgrade" {
  return current === target
    ? "current"
    : order[target] > order[current]
      ? "upgrade"
      : "downgrade";
}
export function isPaidPlan(plan: string | null | undefined): plan is PaidPlan {
  return plan === UserPlan.PRO || plan === UserPlan.BUSINESS;
}
