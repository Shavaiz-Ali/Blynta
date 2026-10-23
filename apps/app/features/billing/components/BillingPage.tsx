"use client";

import * as React from "react";
import { CreditHistory } from "./CreditHistory";
import { CreditPacks } from "./CreditPacks";
import { usePaddle } from "../paddle-context";
import { HowCreditsWork } from "./HowCreditsWork";
import { Scissors, WandSparkles, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  AppButton,
  AppCardRoot,
  AppBadge,
  AppSkeleton,
  AppTabs,
  AppTabsContent,
} from "@blynta/ui";
import { PageContent } from "@/components/layout/PageContent";

import { useCurrentUser } from "@/features/auth/queries";
import {
  useCreateCheckoutSession,
  useCustomerPortal,
  useCreditBalance,
  useBillingPlans,
} from "../queries";
import {
  PLAN,
  PLAN_LABELS,
  isPaidPlan,
  getPlanChangeType,
  type SubscriptionPlan as UserPlan,
  type BillingPlan,
} from "@blynta/types";
import {
  PLAN_PRESENTATION,
  planAllowanceText,
  planActionLabel,
  type PlanPresentation,
} from "../plans";
import {
  CREDIT_TAB,
  CREDIT_TAB_HASH,
  creditTabFromHash,
  BILLING_CHECKOUT_TOAST_ID,
  type CreditTab,
} from "../constants";
import { formatBillingPrice } from "../format";
import type { BillingPlanTier } from "../queries";
import { cn } from "@/lib/utils";
import {
  CoinsIcon,
  FilmIcon,
  CrownIcon,
  CheckIcon,
  ZapIcon,
} from "@/features/dashboard/icons";

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
          accent ?? "bg-muted text-muted-foreground",
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
  creditsBalance: number | string;
  allowance?: number;
  creditsResetText: string;
  reserved: number | string;
}

function CurrentPlanBar({
  currentPlan,
  creditsBalance,
  allowance,
  creditsResetText,
  reserved,
}: CurrentPlanBarProps) {
  const planLabel = PLAN_LABELS[currentPlan];

  return (
    <AppCardRoot className="flex-row flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 rounded-xl border-border/60 bg-muted/20 text-base overflow-visible shadow-none">
      <StatItem
        icon={<CoinsIcon className="h-4 w-4" />}
        label="Credits available"
        value={creditsBalance}
        accent="bg-secondary/15 text-secondary-foreground"
      />

      <div className="h-6 w-px bg-border/60 hidden sm:block" />

      <StatItem
        icon={<FilmIcon className="h-4 w-4" />}
        label="Reserved credits"
        value={reserved}
        accent="bg-chart-1/15 text-chart-1"
      />

      <div className="h-6 w-px bg-border/60 hidden sm:block" />

      <StatItem
        icon={<CrownIcon className="h-4 w-4" />}
        label="Current plan"
        value={
          currentPlan === PLAN.FREE
            ? `${planLabel} · ${planAllowanceText(currentPlan, allowance)}`
            : `${planLabel} · ${allowance ?? "—"}/month`
        }
        accent="bg-primary/15 text-primary"
      />
      {currentPlan !== PLAN.FREE && (
        <StatItem
          icon={<CoinsIcon className="h-4 w-4" />}
          label="Next allocation"
          value={creditsResetText}
          accent="bg-secondary/15 text-secondary-foreground"
        />
      )}
    </AppCardRoot>
  );
}

/* -------------------------------------------------------------------------- */
/*                                Plan card                                   */
/* -------------------------------------------------------------------------- */

interface PlanCardProps {
  plan: PlanPresentation;
  catalog?: BillingPlan;
  currentPlan: UserPlan;
  isLoading: boolean;
  onUpgrade: (tier: BillingPlanTier) => void;
}

function PlanCard({
  plan,
  catalog,
  currentPlan,
  isLoading,
  onUpgrade,
}: PlanCardProps) {
  const change = getPlanChangeType(currentPlan, plan.id);
  const isCurrent = change === "current";
  const price = formatBillingPrice(catalog?.price);
  const actionDisabled = change !== "upgrade" || !catalog?.enabled || !price;
  const buttonLabel = planActionLabel(currentPlan, plan.id);
  const Icon = plan.Icon;

  return (
    <AppCardRoot
      className={cn(
        "relative flex flex-col gap-0 overflow-visible rounded-2xl border p-5 sm:p-6 text-base shadow-sm transition-all",
        plan.accent,
      )}
    >
      {/* Badge */}
      {plan.badge && (
        <AppBadge className="absolute -top-3 left-5 h-auto gap-0 border-0 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary text-primary-foreground shadow-xs">
          <ZapIcon className="h-3 w-3 mr-1" />
          {plan.badge}
        </AppBadge>
      )}

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg",
              plan.id === PLAN.PRO
                ? "bg-primary/15 text-primary"
                : "bg-muted text-muted-foreground",
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground leading-none">
              {PLAN_LABELS[plan.id]}
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {planAllowanceText(plan.id, catalog?.credits)}
            </p>
          </div>
        </div>
      </div>

      <div className="mb-5">
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-extrabold tracking-tight text-foreground">
            {price ?? "—"}
          </span>
          <span className="text-sm text-muted-foreground font-medium">
            /month
          </span>
        </div>
      </div>

      <ul className="space-y-2.5 mb-6 flex-1">
        {[
          planAllowanceText(plan.id, catalog?.credits, true),
          ...plan.features,
        ].map((feature) => (
          <li
            key={feature}
            className="flex items-start gap-2 text-xs text-foreground/80"
          >
            <span
              className={cn(
                "mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full",
                plan.id === PLAN.PRO
                  ? "bg-primary/20 text-primary"
                  : "bg-muted text-muted-foreground",
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
          variant={plan.id === PLAN.PRO ? "default" : "outline"}
          disabled={actionDisabled || isLoading}
          isLoading={isLoading && change === "upgrade"}
          onClick={() => {
            if (actionDisabled) return;
            if (plan.id !== PLAN.FREE) onUpgrade(plan.id as BillingPlanTier);
          }}
        >
          {buttonLabel}
        </AppButton>
      )}
    </AppCardRoot>
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
            <AppSkeleton className="h-7 w-7 rounded-lg bg-muted animate-pulse" />
            <div className="space-y-1">
              <AppSkeleton className="h-2.5 w-16 rounded bg-muted animate-pulse" />
              <AppSkeleton className="h-3.5 w-10 rounded bg-muted animate-pulse" />
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
          <AppSkeleton className="h-8 w-8 rounded-lg bg-muted animate-pulse" />
          <div className="space-y-1.5">
            <AppSkeleton className="h-3 w-14 rounded bg-muted animate-pulse" />
            <AppSkeleton className="h-2 w-20 rounded bg-muted animate-pulse" />
          </div>
        </div>
      </div>
      <div className="mb-5">
        <div className="flex items-baseline gap-1">
          <AppSkeleton className="h-7 w-16 rounded bg-muted animate-pulse" />
          <AppSkeleton className="h-3 w-12 rounded bg-muted animate-pulse" />
        </div>
      </div>
      <ul className="space-y-2.5 mb-6 flex-1">
        {[0, 1, 2, 3].map((i) => (
          <li key={i} className="flex items-start gap-2">
            <AppSkeleton className="mt-0.5 h-3.5 w-3.5 rounded-full bg-muted animate-pulse shrink-0" />
            <AppSkeleton className="h-3.5 w-full rounded bg-muted animate-pulse" />
          </li>
        ))}
      </ul>
      <AppSkeleton className="h-9 w-full rounded-lg bg-muted animate-pulse" />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                          BillingPage — main export                         */
/* -------------------------------------------------------------------------- */

export function BillingPage() {
  const credits = useCreditBalance();
  const [creditsHelpOpen, setCreditsHelpOpen] = React.useState(false);
  const catalog = useBillingPlans();
  const [accountTab, setAccountTab] = React.useState<CreditTab>(
    CREDIT_TAB.PURCHASES,
  );
  const router = useRouter();
  const checkout = usePaddle();
  const { data: profile, isLoading: profileLoading } = useCurrentUser();
  const currentPlan: UserPlan =
    credits.data?.plan ?? (profile?.plan as UserPlan) ?? PLAN.FREE;
  const createCheckout = useCreateCheckoutSession({
    onError: (err: Error, variables) =>
      toast.error(
        err.message || "Failed to initiate checkout. Please try again.",
        {
          id: BILLING_CHECKOUT_TOAST_ID,
          action: {
            label: "Retry",
            onClick: () => handleUpgrade(variables.plan),
          },
        },
      ),
  });
  const customerPortal = useCustomerPortal();
  const handleManageSubscription = () =>
    customerPortal.mutate(undefined, {
      onError: (err: Error) =>
        toast.error(err.message || "Failed to open customer portal."),
    });
  const creditsResetText = credits.data?.nextRenewal
    ? new Date(credits.data.nextRenewal).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      })
    : "Renewal date unavailable";
  const checkoutBusy =
    createCheckout.isPending ||
    customerPortal.isPending ||
    checkout.status === "opening" ||
    checkout.status === "confirming";
  const handleUpgrade = (tier: BillingPlanTier) => {
    if (isPaidPlan(currentPlan)) return handleManageSubscription();
    createCheckout.mutate({ plan: tier });
  };
  const selectCreditTab = (value: string) => {
    if (value !== CREDIT_TAB.PURCHASES && value !== CREDIT_TAB.HISTORY) return;
    setAccountTab(value);
    const url = new URL(window.location.href);
    url.hash = CREDIT_TAB_HASH[value];
    window.history.replaceState(null, "", url);
  };
  React.useEffect(() => {
    let frame: number | undefined;
    const syncHash = () => {
      const tab = creditTabFromHash(window.location.hash);
      if (tab) {
        setAccountTab(tab);
        if (frame !== undefined) cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() =>
          document
            .getElementById("credit-management")
            ?.scrollIntoView({ block: "start" }),
        );
      }
    };
    queueMicrotask(syncHash);
    window.addEventListener("hashchange", syncHash);
    return () => {
      window.removeEventListener("hashchange", syncHash);
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <PageContent>
      {/* ── Page heading ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1.5">
          {profileLoading ? (
            <div className="space-y-1.5">
              <AppSkeleton className="h-8 w-56 bg-muted rounded-lg animate-pulse" />
              <AppSkeleton className="h-4 w-72 bg-muted rounded-md animate-pulse" />
            </div>
          ) : (
            <>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                Billing &amp; Plan
              </h1>
              <p className="text-sm text-muted-foreground">
                Manage your subscription, view remaining credits, and upgrade
                anytime.
              </p>
            </>
          )}
        </div>

        {currentPlan !== PLAN.FREE && (
          <AppButton
            variant="outline"
            size="sm"
            onClick={handleManageSubscription}
            isLoading={customerPortal.isPending}
            className="self-start sm:self-auto"
          >
            Manage subscription
          </AppButton>
        )}
      </div>

      {/* ── Current plan / credits summary ── */}
      {profileLoading || credits.isPending ? (
        <CurrentPlanBarSkeleton />
      ) : (
        <CurrentPlanBar
          currentPlan={currentPlan}
          creditsBalance={credits.data?.available ?? "—"}
          creditsResetText={creditsResetText}
          reserved={credits.data?.reserved ?? "—"}
          allowance={credits.data?.planAllocations?.[currentPlan]}
        />
      )}

      {/* ── Plan cards grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {profileLoading || catalog.isPending
          ? [0, 1, 2].map((i) => <PlanCardSkeleton key={i} />)
          : PLAN_PRESENTATION.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                catalog={catalog.data?.find((item) => item.id === plan.id)}
                currentPlan={currentPlan}
                isLoading={checkoutBusy}
                onUpgrade={handleUpgrade}
              />
            ))}
      </div>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-tight">
              One balance across Blynta
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Create clips and finish your edits with the same credits.
            </p>
          </div>
          <AppButton
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => setCreditsHelpOpen(true)}
          >
            How credits work
          </AppButton>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {[
            {
              Icon: Scissors,
              title: "AI Clips",
              copy: "Turn long videos into highlights. Credits cover source processing and delivered clips.",
            },
            {
              Icon: WandSparkles,
              title: "Studio",
              copy: "Edit and preview for free. Use your shared credits when you export in the cloud.",
            },
            {
              Icon: Wallet,
              title: "Your credits, together",
              copy: "Subscription credits join your balance. Review the maximum cost before starting paid work.",
            },
          ].map(({ Icon, title, copy }) => (
            <AppCardRoot
              key={title}
              className="block gap-0 rounded-2xl border-border/60 bg-card p-5 text-base shadow-none"
            >
              <div className="mb-4 inline-flex rounded-xl bg-primary/10 p-2.5 text-primary">
                <Icon className="size-5" aria-hidden="true" />
              </div>
              <h3 className="text-sm font-semibold">{title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {copy}
              </p>
            </AppCardRoot>
          ))}
        </div>
      </section>
      <HowCreditsWork
        open={creditsHelpOpen}
        onOpenChange={setCreditsHelpOpen}
        balance={credits.data}
      />
      <section
        aria-labelledby="credit-management"
        className="space-y-4 min-w-0"
      >
        <h2 id="credit-management" className="text-lg font-bold tracking-tight">
          Credit Management
        </h2>
        <AppTabs
          value={accountTab}
          onValueChange={selectCreditTab}
          variant="default"
          size="default"
          className="w-full"
          tabs={[
            { value: CREDIT_TAB.PURCHASES, label: "Buy Credits" },
            { value: CREDIT_TAB.HISTORY, label: "Credit History" },
          ]}
        >
          <AppTabsContent value={CREDIT_TAB.PURCHASES} keepMounted>
            <CreditPacks />
          </AppTabsContent>
          <AppTabsContent value={CREDIT_TAB.HISTORY} keepMounted>
            <CreditHistory />
          </AppTabsContent>
        </AppTabs>
      </section>
      <div className="pt-2 text-xs text-muted-foreground flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <p>
          Payments are processed securely by Paddle. Monthly subscriptions renew
          automatically; cancel anytime from this page.
        </p>
        <p>
          Need a custom volume plan?{" "}
          <AppButton
            variant="link"
            onClick={() => router.push("/settings")}
            className="h-auto p-0 text-xs font-semibold text-foreground underline-offset-2 hover:underline"
          >
            Contact support
          </AppButton>
        </p>
      </div>
    </PageContent>
  );
}
