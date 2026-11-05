import {
  Activity,
  Clapperboard,
  CreditCard,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import type { DashboardStats } from "../api";
import {
  AppCardRoot,
  AppCardContent,
  AppCardDescription,
  AppCardHeader,
  AppCardTitle,
} from "@blynta/ui";
import { cn } from "@/lib/utils";

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatRange(range: DashboardStats["range"]): string {
  if (range === "7d") return "last 7 days";
  if (range === "90d") return "last 3 months";
  return "last 30 days";
}

function TrendBadge({ value }: { value: number }) {
  const isPositive = value > 0;
  const isNegative = value < 0;
  const Icon = isNegative ? TrendingDown : TrendingUp;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold backdrop-blur-sm",
        isPositive && "border-primary/25 bg-primary/10 text-primary",
        isNegative && "border-destructive/25 bg-destructive/10 text-destructive",
        !isPositive && !isNegative && "border-border/60 bg-muted/60 text-muted-foreground",
      )}
    >
      <Icon className="size-3" />
      {isPositive ? "+" : ""}
      {value}%
    </span>
  );
}

export function OverviewMetrics({ data }: { data: DashboardStats }) {
  const period = formatRange(data.range);
  const metrics = [
    {
      label: "Total users",
      value: data.users.total.toLocaleString(),
      change: data.comparisons.userGrowthRate,
      detail: `${data.comparisons.newUsersInPeriod.toLocaleString()} new users`,
      note: `${data.users.active.toLocaleString()} active accounts · ${period}`,
      icon: Users,
      iconAccent: "bg-primary/15 text-primary",
      gradient: "bg-gradient-to-br from-card via-card to-primary/10",
    },
    {
      label: "Processing jobs",
      value: data.jobs.total.toLocaleString(),
      change: data.comparisons.jobGrowthRate,
      detail: `${data.comparisons.jobsInPeriod.toLocaleString()} jobs submitted`,
      note: `${data.jobs.successRate}% success rate · ${period}`,
      icon: Activity,
      iconAccent: "bg-chart-2/15 text-chart-2",
      gradient: "bg-gradient-to-br from-card via-card to-chart-2/10",
    },
    {
      label: "Generated clips",
      value: data.clips.total.toLocaleString(),
      change: data.comparisons.clipGrowthRate,
      detail: `${data.clips.generatedInPeriod.toLocaleString()} clips generated`,
      note: `${data.clips.generatedToday.toLocaleString()} completed today · ${period}`,
      icon: Clapperboard,
      iconAccent: "bg-chart-3/15 text-chart-3",
      gradient: "bg-gradient-to-br from-card via-card to-chart-3/10",
    },
    {
      label: "Active subscriptions",
      value: data.billing.activeSubscriptions.toLocaleString(),
      detail: `${formatCurrency(data.billing.mrr)} estimated MRR`,
      note: `${data.billing.proUsers} Pro · ${data.billing.businessUsers} Business`,
      icon: CreditCard,
      iconAccent: "bg-chart-4/20 text-chart-4",
      gradient: "bg-gradient-to-br from-card via-card to-chart-4/10",
    },
  ];

  return (
    <section
      aria-label="Platform analytics"
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      {metrics.map((metric) => {
        const Icon = metric.icon;
        return (
          <AppCardRoot
            key={metric.label}
            className={cn(
              "min-w-0 rounded-xl border border-border/70 shadow-xs transition-all hover:border-primary/40",
              metric.gradient,
            )}
          >
            <AppCardHeader className="p-5 pb-2">
              <AppCardTitle className="flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <span>{metric.label}</span>
                <div
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-lg",
                    metric.iconAccent,
                  )}
                >
                  <Icon aria-hidden="true" className="size-4" />
                </div>
              </AppCardTitle>
            </AppCardHeader>
            <AppCardContent className="p-5 pt-0 space-y-3">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <p className="min-w-0 break-all text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground tabular-nums">
                  {metric.value}
                </p>
                {metric.change !== undefined && (
                  <TrendBadge value={metric.change} />
                )}
              </div>
              <div className="space-y-0.5 border-t border-border/40 pt-2.5">
                <p className="text-xs font-semibold text-foreground">
                  {metric.detail}
                </p>
                <AppCardDescription className="text-[11px] text-muted-foreground">
                  {metric.note}
                </AppCardDescription>
              </div>
            </AppCardContent>
          </AppCardRoot>
        );
      })}
    </section>
  );
}
