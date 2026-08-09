"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { AppButton } from "@/components/common/AppButton";
import { DashboardLayout } from "@/features/dashboard/components/DashboardLayout";
import { DashboardHeaderRight } from "@/features/dashboard/components/DashboardHeaderRight";
import { useCurrentUser } from "@/features/auth/queries";
import { useCreateCheckoutSession } from "@/features/billing/queries";
import type { UserPlan as BillingUserPlan } from "./types";
import type { BillingPlanTier } from "@/features/billing/queries";
import { cn } from "@/lib/utils";
import { CoinsIcon, FilmIcon, CrownIcon, CheckIcon, SparklesIcon, ZapIcon, BuildingIcon } from "@/features/dashboard/icons";

/* -------------------------------------------------------------------------- */
/*                                 Types                                      */
/* -------------------------------------------------------------------------- */

type UserPlan = BillingUserPlan | "free" | "pro" | "business";

interface PlanMeta {
  id: "free" | BillingPlanTier;
  name: string;
  price: string;
  priceSuffix: string;
  credits: number;
  cta: (currentPlan: UserPlan) => string;
  features: string[];
  accent: string;
  badge?: string;
  icon: React.ReactNode;
}

/* -------------------------------------------------------------------------- */
/*                           Plan display config                              */
/* -------------------------------------------------------------------------- */
/* NOTE: these are DISPLAY values only. The real source of truth for billing
   amounts is the corresponding Stripe Price object configured in the
   dashboard. Keep these strings in sync with Stripe's configured amounts. */

const DISPLAY_PLANS: PlanMeta[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    priceSuffix: "/month",
    credits: 5,
    cta: (current) => (current === "free" ? "Current plan" : "Downgrade"),
    features: [
      "5 credits per month",
      "Standard exports",
      "Community support",
      "Watermark on clips",
    ],
    accent: "border-border/60 bg-card",
    icon: <FilmIcon className="h-5 w-5" />,
  },
  {
    id: "pro",
    name: "Pro",
    price: "$12",
    priceSuffix: "/month",
    credits: 50,
    cta: (current) =>
      current === "pro"
        ? "Current plan"
        : current === "business"
          ? "Downgrade"
          : "Upgrade to Pro",
    badge: "Most popular",
    features: [
      "50 credits per month",
      "HD clip exports (no watermark)",
      "Priority queue processing",
      "Brand templates & custom fonts",
      "Email support",
    ],
    accent:
      "border-primary/60 bg-primary/[0.08] shadow-[0_0_0_1px_rgba(13,148,136,0.25)]",
    icon: <SparklesIcon className="h-5 w-5" />,
  },
  {
    id: "business",
    name: "Business",
    price: "$39",
    priceSuffix: "/month",
    credits: 200,
    cta: (current) =>
      current === "business" ? "Current plan" : "Upgrade to Business",
    features: [
      "200 credits per month",
      "Everything in Pro",
      "Top-priority processing",
      "Unlimited brand templates",
      "Team seats (coming soon)",
      "Dedicated support SLA",
    ],
    accent: "border-border/60 bg-card",
    icon: <BuildingIcon className="h-5 w-5" />,
  },
];

const PLAN_ORDER: Record<UserPlan, number> = {
  free: 0,
  pro: 1,
  business: 2,
};

/* -------------------------------------------------------------------------- */
/*                              Stat summary bar                              */
/* -------------------------------------------------------------------------- */

interface StatItemProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  accent?: string;
}

function StatItem({ icon, label, value, accent }: StatItemProps) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <div
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
          accent ?? "bg-muted text-muted-foreground"
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground leading-none mb-0.5">
          {label}
        </p>
        <p className="text-sm font-bold text-foreground leading-none truncate">
          {value}
        </p>
      </div>
    </div>
  );
}

interface CurrentPlanBarProps {
  currentPlan: UserPlan;
  creditsBalance: number;
  creditsResetText: string;
  clipsGenerated: number;
}

function CurrentPlanBar({
  currentPlan,
  creditsBalance,
  creditsResetText,
  clipsGenerated,
}: CurrentPlanBarProps) {
  const planLabel =
    currentPlan === "free"
      ? "Free"
      : currentPlan === "pro"
        ? "Pro"
        : currentPlan === "business"
          ? "Business"
          : "Free";

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 rounded-xl border border-border/60 bg-muted/20">
      <StatItem
        icon={<CoinsIcon className="h-4 w-4" />}
        label="Credits remaining"
        value={
          <>
            <span>{creditsBalance}</span>
            <span className="text-[10px] font-normal text-muted-foreground ml-1">
              · {creditsResetText}
            </span>
          </>
        }
        accent="bg-secondary/15 text-secondary-foreground"
      />

      <div className="h-6 w-px bg-border/60 hidden sm:block" />

      <StatItem
        icon={<FilmIcon className="h-4 w-4" />}
        label="Clips generated"
        value={clipsGenerated}
        accent="bg-chart-1/15 text-chart-1"
      />

      <div className="h-6 w-px bg-border/60 hidden sm:block" />

      <StatItem
        icon={<CrownIcon className="h-4 w-4" />}
        label="Current plan"
        value={planLabel}
        accent="bg-primary/15 text-primary"
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                Plan card                                   */
/* -------------------------------------------------------------------------- */

interface PlanCardProps {
  plan: PlanMeta;
  currentPlan: UserPlan;
  isLoading: boolean;
  onUpgrade: (tier: BillingPlanTier) => void;
}

function PlanCard({ plan, currentPlan, isLoading, onUpgrade }: PlanCardProps) {
  const tierRank = PLAN_ORDER[plan.id];
  const currentRank = PLAN_ORDER[currentPlan] ?? 0;
  const isCurrent = plan.id === currentPlan;
  const isUpgrade = tierRank > currentRank;
  const isDowngrade = tierRank < currentRank;

  // Action state: current plan -> disabled badge, downgrade -> disabled, upgrade -> actionable
  const actionDisabled = isCurrent || isDowngrade;
  const isProAndActionable = plan.id === "pro" && !actionDisabled;
  const isBusinessActionable = plan.id === "business" && !actionDisabled;

  const buttonLabel = plan.cta(currentPlan);

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-2xl border p-5 sm:p-6 shadow-sm transition-all",
        plan.accent
      )}
    >
      {/* Badge */}
      {plan.badge && (
        <div className="absolute -top-3 left-5 inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary text-primary-foreground shadow-xs">
          <ZapIcon className="h-3 w-3 mr-1" />
          {plan.badge}
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg",
              plan.id === "pro"
                ? "bg-primary/15 text-primary"
                : "bg-muted text-muted-foreground"
            )}
          >
            {plan.icon}
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground leading-none">
              {plan.name}
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {plan.credits} credits / month
            </p>
          </div>
        </div>
      </div>

      <div className="mb-5">
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-extrabold tracking-tight text-foreground">
            {plan.price}
          </span>
          <span className="text-sm text-muted-foreground font-medium">
            {plan.priceSuffix}
          </span>
        </div>
      </div>

      <ul className="space-y-2.5 mb-6 flex-1">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-xs text-foreground/80">
            <span
              className={cn(
                "mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full",
                plan.id === "pro"
                  ? "bg-primary/20 text-primary"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <CheckIcon className="h-2.5 w-2.5" />
            </span>
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      {isCurrent ? (
        <div className="inline-flex items-center justify-center h-9 w-full rounded-lg border border-primary/40 bg-primary/10 text-primary text-xs font-bold tracking-wide uppercase">
          <CrownIcon className="h-3.5 w-3.5 mr-1.5" />
          Current plan
        </div>
      ) : (
        <AppButton
          size="default"
          className="h-9 w-full text-sm font-semibold"
          variant={
            plan.id === "pro"
              ? "default"
              : "outline"
          }
          disabled={actionDisabled || isLoading}
          isLoading={isLoading && (isProAndActionable || isBusinessActionable)}
          onClick={() => {
            if (actionDisabled) return;
            if (plan.id !== "free") onUpgrade(plan.id as BillingPlanTier);
          }}
        >
          {buttonLabel}
        </AppButton>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                           Success / cancel banners                         */
/* -------------------------------------------------------------------------- */

interface FeedbackBannerProps {
  variant: "success" | "canceled";
  onDismiss: () => void;
}

function FeedbackBanner({ variant, onDismiss }: FeedbackBannerProps) {
  const isSuccess = variant === "success";

  return (
    <div
      className={cn(
        "w-full flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-3 rounded-xl border text-sm shadow-sm",
        isSuccess
          ? "border-primary/40 bg-primary/[0.10] text-foreground"
          : "border-border/80 bg-card text-muted-foreground"
      )}
    >
      <div className="flex items-start gap-2.5 min-w-0">
        <div
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full mt-0.5",
            isSuccess ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
          )}
        >
          {isSuccess ? (
            <CheckIcon className="h-3.5 w-3.5" />
          ) : (
            <CrownIcon className="h-3.5 w-3.5" />
          )}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-foreground">
            {isSuccess
              ? "Upgrade successful — welcome!"
              : "Checkout was canceled."}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isSuccess
              ? "Your plan has been updated and credits have been added to your account. Start creating more clips!"
              : "No charges were made. Your plan remains unchanged — upgrade whenever you're ready."}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors shrink-0"
      >
        Dismiss
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                               Skeletons                                    */
/* -------------------------------------------------------------------------- */

function CurrentPlanBarSkeleton() {
  return (
    <div className="flex flex-wrap items-center gap-6 px-4 py-3 rounded-xl border border-border/60 bg-muted/20">
      {[0, 1, 2].map((i) => (
        <React.Fragment key={i}>
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-muted animate-pulse" />
            <div className="space-y-1">
              <div className="h-2.5 w-16 rounded bg-muted animate-pulse" />
              <div className="h-3.5 w-10 rounded bg-muted animate-pulse" />
            </div>
          </div>
          {i < 2 && <div className="h-6 w-px bg-border/60 hidden sm:block" />}
        </React.Fragment>
      ))}
    </div>
  );
}

function PlanCardSkeleton() {
  return (
    <div className="relative flex flex-col rounded-2xl border border-border/60 bg-card p-5 sm:p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-muted animate-pulse" />
          <div className="space-y-1.5">
            <div className="h-3 w-14 rounded bg-muted animate-pulse" />
            <div className="h-2 w-20 rounded bg-muted animate-pulse" />
          </div>
        </div>
      </div>
      <div className="mb-5">
        <div className="flex items-baseline gap-1">
          <div className="h-7 w-16 rounded bg-muted animate-pulse" />
          <div className="h-3 w-12 rounded bg-muted animate-pulse" />
        </div>
      </div>
      <ul className="space-y-2.5 mb-6 flex-1">
        {[0, 1, 2, 3].map((i) => (
          <li key={i} className="flex items-start gap-2">
            <div className="mt-0.5 h-3.5 w-3.5 rounded-full bg-muted animate-pulse shrink-0" />
            <div className="h-3.5 w-full rounded bg-muted animate-pulse" />
          </li>
        ))}
      </ul>
      <div className="h-9 w-full rounded-lg bg-muted animate-pulse" />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                          BillingPage — main export                         */
/* -------------------------------------------------------------------------- */

export function BillingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showSuccess = searchParams?.get("success") === "true";
  const showCanceled = searchParams?.get("canceled") === "true";

  const { data: profile, isLoading: profileLoading } = useCurrentUser();
  const clipsGenerated = 0;

  const createCheckout = useCreateCheckoutSession({});

  const creditsResetText = profile?.creditsResetAt
    ? new Date(profile.creditsResetAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      })
    : "Resets monthly";

  const currentPlan: UserPlan = (profile?.plan as UserPlan) ?? "free";

  // When user lands with ?success=true or ?canceled=true, strip the params out
  // of the URL once they've been shown once so a refresh doesn't re-trigger.
  const [dismissSuccess, setDismissSuccess] = React.useState(!showSuccess);
  const [dismissCancel, setDismissCancel] = React.useState(!showCanceled);

  React.useEffect(() => {
    if (!showSuccess && !showCanceled) return;
    if (typeof window === "undefined") return;
    // Already dismissed; do nothing.
    if (dismissSuccess && dismissCancel) return;

    const t = window.setTimeout(() => {
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.delete("success");
      nextUrl.searchParams.delete("canceled");
      nextUrl.searchParams.delete("session_id");
      window.history.replaceState({}, "", nextUrl.toString());
    }, 1500);
    return () => window.clearTimeout(t);
  }, [showSuccess, showCanceled, dismissSuccess, dismissCancel]);

  const headerContent = (
    <div className="flex-1 min-w-0 flex items-center">
      {profile ? (
        <DashboardHeaderRight profile={profile} />
      ) : (
        <div className="ml-auto flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-muted animate-pulse" />
          <div className="h-9 w-9 rounded-xl bg-muted animate-pulse" />
        </div>
      )}
    </div>
  );

  const handleUpgrade = (tier: BillingPlanTier) => {
    createCheckout.mutate({ plan: tier });
  };

  return (
    <DashboardLayout headerContent={headerContent}>
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 lg:py-8 space-y-6">
        {/* ── Feedback banner (success / canceled) ── */}
        {showSuccess && !dismissSuccess && (
          <FeedbackBanner
            variant="success"
            onDismiss={() => setDismissSuccess(true)}
          />
        )}
        {showCanceled && !dismissCancel && (
          <FeedbackBanner
            variant="canceled"
            onDismiss={() => setDismissCancel(true)}
          />
        )}

        {/* ── Page heading ── */}
        <div className="space-y-1.5">
          {profileLoading ? (
            <div className="space-y-1.5">
              <div className="h-8 w-56 bg-muted rounded-lg animate-pulse" />
              <div className="h-4 w-72 bg-muted rounded-md animate-pulse" />
            </div>
          ) : (
            <>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                Billing &amp; Plan
              </h1>
              <p className="text-sm text-muted-foreground">
                Manage your subscription, view remaining credits, and upgrade anytime.
              </p>
            </>
          )}
        </div>

        {/* ── Current plan / credits summary ── */}
        {profileLoading ? (
          <CurrentPlanBarSkeleton />
        ) : (
          <CurrentPlanBar
            currentPlan={currentPlan}
            creditsBalance={profile?.creditsBalance ?? 0}
            creditsResetText={creditsResetText}
            clipsGenerated={clipsGenerated}
          />
        )}

        {/* ── Plan cards grid ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {profileLoading
            ? [0, 1, 2].map((i) => <PlanCardSkeleton key={i} />)
            : DISPLAY_PLANS.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  currentPlan={currentPlan}
                  isLoading={createCheckout.isPending}
                  onUpgrade={handleUpgrade}
                />
              ))}
        </div>

        {/* ── Footer note ── */}
        <div className="pt-2 text-xs text-muted-foreground flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <p>
            All charges are in USD and processed securely by Stripe. Monthly
            subscriptions renew automatically; cancel anytime from this page.
          </p>
          <p>
            Need a custom volume plan?{" "}
            <button
              type="button"
              onClick={() => router.push("/settings")}
              className="font-semibold text-foreground underline-offset-2 hover:underline"
            >
              Contact support
            </button>
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
