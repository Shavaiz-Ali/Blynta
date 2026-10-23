import {
  PLAN,
  PLAN_LABELS,
  getPlanChangeType,
  type SubscriptionPlan,
} from "@blynta/types";
import {
  FilmIcon,
  SparklesIcon,
  BuildingIcon,
} from "@/features/dashboard/icons";

// Presentation only. Prices and allocations are supplied by the billing API.
export const PLAN_PRESENTATION = [
  {
    id: PLAN.FREE,
    Icon: FilmIcon,
    accent: "border-border/60 bg-card",
    features: [
      "AI Clips and Studio access",
      "Local timeline editing included",
      "Cloud exports use shared credits",
      "720p and 1080p Studio exports",
    ],
  },
  {
    id: PLAN.PRO,
    Icon: SparklesIcon,
    badge: "Most popular",
    accent:
      "border-primary/60 bg-primary/[0.08] shadow-[0_0_0_1px_rgba(13,148,136,0.25)]",
    features: [
      "AI Clips and Studio access",
      "Local timeline editing included",
      "Cloud exports use shared credits",
      "Advanced clip prompts and styles",
      "720p and 1080p Studio exports",
    ],
  },
  {
    id: PLAN.BUSINESS,
    Icon: BuildingIcon,
    accent: "border-border/60 bg-card",
    features: [
      "Everything in Pro",
      "Shared credits for both products",
      "Cloud exports use shared credits",
      "720p and 1080p Studio exports",
    ],
  },
];
export type PlanPresentation = (typeof PLAN_PRESENTATION)[number];
export function planAllowanceText(
  plan: SubscriptionPlan,
  credits?: number,
  feature = false,
) {
  const amount = credits ?? "—";
  return plan === PLAN.FREE
    ? `${amount} one-time credits`
    : `${amount} credits ${feature ? "per" : "/"} month`;
}
export function planActionLabel(
  current: SubscriptionPlan,
  target: SubscriptionPlan,
) {
  const change = getPlanChangeType(current, target);
  return change === "current"
    ? "Current plan"
    : change === "downgrade"
      ? "Downgrade"
      : `Upgrade to ${PLAN_LABELS[target]}`;
}
