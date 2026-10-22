"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  AppBadge,
  AppButton,
  AppCardRoot,
  AppCardHeader,
  AppCardTitle,
  AppCardDescription,
  AppCardContent,
  AppCardFooter,
  AppSkeleton,
} from "@blynta/ui";
import { Check, CreditCard, HelpCircle } from "lucide-react";
import { PageContent } from "@/components/layout/PageContent";
import { useCurrentUser } from "@/features/auth/queries";
import {
  useCreditBalance,
  useCreateCheckoutSession,
  useCustomerPortal,
} from "../queries";
import { usePaddle } from "../paddle-context";
import { CreditHistory } from "./CreditHistory";
import { CreditPacks } from "./CreditPacks";
import { HowCreditsWork } from "./HowCreditsWork";

const plans = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    credits: 30,
    features: [
      "AI Clips and Studio",
      "Shared credits for cloud exports",
      "Free credits do not renew",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$12",
    credits: 50,
    features: [
      "AI Clips and Studio",
      "Advanced prompts and clip styles",
      "Monthly subscription credits",
    ],
  },
  {
    id: "business",
    name: "Business",
    price: "$39",
    credits: 200,
    features: [
      "Everything in Pro",
      "More credits for your workflow",
      "Monthly subscription credits",
    ],
  },
] as const;

export function BillingPage() {
  const wallet = useCreditBalance();
  const profile = useCurrentUser();
  const checkout = usePaddle();
  const [helpOpen, setHelpOpen] = useState(false);
  const subscription = useCreateCheckoutSession({
    onError: (error) => toast.error(error.message),
  });
  const portal = useCustomerPortal();
  const plan = wallet.data?.plan ?? profile.data?.plan ?? "free";
  const paid = plan !== "free";
  const busy =
    subscription.isPending ||
    portal.isPending ||
    checkout.status === "opening" ||
    checkout.status === "confirming";
  const manage = () =>
    portal.mutate(undefined, {
      onError: (error) => toast.error(error.message),
    });
  const allowance = (id: "free" | "pro" | "business", fallback: number) =>
    wallet.data?.planAllocations?.[id] ?? fallback;

  return (
    <PageContent>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Billing &amp; Plan
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your credits, subscription and payment history.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <AppButton
            variant="outline"
            size="sm"
            onClick={() => setHelpOpen(true)}
            icon={<HelpCircle className="size-4" />}
          >
            How credits work
          </AppButton>
          {paid && (
            <AppButton
              size="sm"
              variant="outline"
              isLoading={portal.isPending}
              disabled={busy}
              onClick={manage}
            >
              Manage subscription
            </AppButton>
          )}
        </div>
      </div>

      {(checkout.status === "loading" ||
        checkout.status === "opening" ||
        checkout.status === "confirming") && (
        <p role="status" className="text-sm text-muted-foreground">
          {checkout.status === "confirming"
            ? "Confirming payment with the server. Your balance updates after verification."
            : checkout.status === "opening"
              ? "Opening secure Paddle checkout…"
              : "Preparing secure checkout…"}
        </p>
      )}
      {checkout.status === "verified" && (
        <p role="status" className="text-sm text-primary">
          Payment verified. Your balance has been refreshed.
        </p>
      )}
      {checkout.status === "closed" && (
        <p role="status" className="text-sm text-muted-foreground">
          Checkout closed. Your subscription changes only after a verified
          payment.
        </p>
      )}
      {checkout.error && (
        <AppCardRoot className="border-destructive">
          <AppCardContent className="flex flex-wrap items-center justify-between gap-3">
            <p role="alert" className="min-w-0 flex-1 text-sm text-destructive">
              {checkout.error}
            </p>
            <AppButton
              variant="outline"
              size="sm"
              onClick={() =>
                void checkout
                  .retry()
                  .catch((error: Error) => toast.error(error.message))
              }
            >
              Retry checkout
            </AppButton>
          </AppCardContent>
        </AppCardRoot>
      )}

      <section aria-labelledby="billing-overview" className="space-y-3">
        <h2 id="billing-overview" className="text-base font-semibold">
          Billing overview
        </h2>
        <AppCardRoot>
          <AppCardContent>
            {wallet.isPending ? (
              <div
                aria-label="Loading credit balance"
                role="status"
                className="grid gap-4 sm:grid-cols-3"
              >
                {[0, 1, 2].map((i) => (
                  <AppSkeleton key={i} className="h-14" />
                ))}
              </div>
            ) : wallet.isError ? (
              <div role="alert" className="flex flex-wrap items-center gap-3">
                <p className="text-sm text-destructive">
                  Your credit balance could not be loaded.
                </p>
                <AppButton
                  size="sm"
                  variant="outline"
                  onClick={() => wallet.refetch()}
                >
                  Retry balance
                </AppButton>
              </div>
            ) : (
              <dl
                className={`grid gap-5 sm:grid-cols-2 ${paid && wallet.data?.nextRenewal ? "xl:grid-cols-4" : "lg:grid-cols-3"}`}
              >
                <div>
                  <dt className="text-xs text-muted-foreground">
                    Available credits
                  </dt>
                  <dd className="mt-1 text-3xl font-semibold tabular-nums">
                    {wallet.data?.available ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">
                    Reserved credits
                  </dt>
                  <dd className="mt-1 text-3xl font-semibold tabular-nums">
                    {wallet.data?.reserved ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">
                    Current subscription
                  </dt>
                  <dd className="mt-1 text-lg font-semibold capitalize">
                    {plan}
                  </dd>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {paid
                      ? `${wallet.data?.monthlyCredits ?? allowance(plan, plan === "business" ? 200 : 50)} credits per month`
                      : `${allowance("free", 30)} one-time credits · no renewal`}
                  </p>
                </div>
                {paid && wallet.data?.nextRenewal && (
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      Next credit allocation
                    </dt>
                    <dd className="mt-1 text-lg font-semibold">
                      {new Date(wallet.data.nextRenewal).toLocaleDateString()}
                    </dd>
                    <p className="mt-1 text-xs text-muted-foreground">
                      After verified renewal payment
                    </p>
                  </div>
                )}
              </dl>
            )}
            {wallet.data && !wallet.isError && (
              <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-border pt-4 text-sm">
                <div>
                  <dt className="text-muted-foreground">
                    Total granted credits
                  </dt>
                  <dd className="mt-1 font-semibold tabular-nums">
                    {wallet.data.totalGranted ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">
                    Total consumed credits
                  </dt>
                  <dd className="mt-1 font-semibold tabular-nums">
                    {wallet.data.totalConsumed ?? "—"}
                  </dd>
                </div>
              </dl>
            )}
            {!!wallet.data?.paymentCreditsOwed && (
              <p role="alert" className="mt-4 text-sm text-destructive">
                {wallet.data.paymentCreditsOwed} refunded payment credits are
                owed. New credits repay this amount before processing is
                available.
              </p>
            )}
          </AppCardContent>
        </AppCardRoot>
      </section>

      <section aria-labelledby="subscription-plans" className="space-y-3">
        <h2 id="subscription-plans" className="text-base font-semibold">
          Subscription plans
        </h2>
        <div className="grid items-stretch gap-4 lg:grid-cols-3">
          {plans.map((item) => (
            <AppCardRoot
              key={item.id}
              className={item.id === "pro" ? "border-primary" : undefined}
            >
              <AppCardHeader>
                <div className="flex items-center justify-between gap-2">
                  <AppCardTitle>{item.name}</AppCardTitle>
                  {item.id === "pro" && (
                    <AppBadge variant="secondary">Popular</AppBadge>
                  )}
                </div>
                <AppCardDescription>
                  {item.id === "free"
                    ? "Start creating, with no subscription."
                    : "For a consistent creative workflow."}
                </AppCardDescription>
              </AppCardHeader>
              <AppCardContent className="space-y-4">
                <p className="text-3xl font-semibold tracking-tight">
                  {item.price}
                  {item.id !== "free" && (
                    <span className="text-sm font-normal text-muted-foreground">
                      {" "}
                      / month
                    </span>
                  )}
                </p>
                <p className="text-sm font-medium">
                  {allowance(item.id, item.credits)}{" "}
                  {item.id === "free" ? "one-time credits" : "credits / month"}
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {item.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check
                        className="mt-0.5 size-4 shrink-0 text-primary"
                        aria-hidden="true"
                      />
                      {feature}
                    </li>
                  ))}
                </ul>
              </AppCardContent>
              <AppCardFooter className="mt-auto">
                <AppButton
                  className="w-full"
                  variant={item.id === "pro" ? "default" : "outline"}
                  disabled={
                    busy ||
                    wallet.isPending ||
                    wallet.isError ||
                    item.id === plan ||
                    (item.id === "free" && !paid)
                  }
                  isLoading={
                    subscription.isPending &&
                    subscription.variables?.plan === item.id
                  }
                  onClick={() => {
                    if (paid) manage();
                    else if (item.id !== "free")
                      subscription.mutate({ plan: item.id });
                  }}
                  icon={
                    item.id === "free" ? undefined : (
                      <CreditCard className="size-4" />
                    )
                  }
                >
                  {item.id === plan
                    ? "Current plan"
                    : paid
                      ? "Manage plan"
                      : `Upgrade to ${item.name}`}
                </AppButton>
              </AppCardFooter>
            </AppCardRoot>
          ))}
        </div>
      </section>
      <CreditPacks />
      <CreditHistory />
      <AppCardRoot>
        <AppCardContent className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">How credits work</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Source processing and delivered clips use credits. Unused
              reservations return to your available balance. Subscription
              credits arrive after verified renewal payments; Free credits are
              granted once.
            </p>
          </div>
          <AppButton
            variant="outline"
            size="sm"
            onClick={() => setHelpOpen(true)}
          >
            View credit pricing
          </AppButton>
        </AppCardContent>
      </AppCardRoot>
      <HowCreditsWork
        open={helpOpen}
        onOpenChange={setHelpOpen}
        balance={wallet.data}
      />
    </PageContent>
  );
}
