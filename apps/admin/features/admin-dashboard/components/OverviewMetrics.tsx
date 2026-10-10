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
  const Icon = value < 0 ? TrendingDown : TrendingUp;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border bg-background/70 px-2 py-1 text-xs font-medium backdrop-blur-sm",
        value < 0 && "text-destructive",
      )}
    >
      <Icon className="size-3.5" />
      {value > 0 ? "+" : ""}
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
      gradient:
        "bg-gradient-to-br from-card via-card to-primary/15 dark:to-primary/20",
    },
    {
      label: "Processing jobs",
      value: data.jobs.total.toLocaleString(),
      change: data.comparisons.jobGrowthRate,
      detail: `${data.comparisons.jobsInPeriod.toLocaleString()} jobs submitted`,
      note: `${data.jobs.successRate}% success rate · ${period}`,
      icon: Activity,
      gradient:
        "bg-gradient-to-br from-card via-card to-chart-2/15 dark:to-chart-2/20",
    },
    {
      label: "Generated clips",
      value: data.clips.total.toLocaleString(),
      change: data.comparisons.clipGrowthRate,
      detail: `${data.clips.generatedInPeriod.toLocaleString()} clips generated`,
      note: `${data.clips.generatedToday.toLocaleString()} completed today · ${period}`,
      icon: Clapperboard,
      gradient:
        "bg-gradient-to-br from-card via-card to-chart-3/15 dark:to-chart-3/20",
    },
    {
      label: "Active subscriptions",
      value: data.billing.activeSubscriptions.toLocaleString(),
      detail: `${formatCurrency(data.billing.mrr)} estimated MRR`,
      note: `${data.billing.proUsers} Pro · ${data.billing.businessUsers} Business`,
      icon: CreditCard,
      gradient:
        "bg-gradient-to-br from-card via-card to-chart-4/20 dark:to-chart-4/15",
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
            className={cn("min-w-0", metric.gradient)}
          >
            <AppCardHeader>
              <AppCardTitle className="flex items-center justify-between gap-3 text-sm font-medium text-muted-foreground">
                <span>{metric.label}</span>
                <Icon aria-hidden="true" className="size-4 shrink-0" />
              </AppCardTitle>
            </AppCardHeader>
            <AppCardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <p className="min-w-0 break-all text-3xl font-semibold tracking-tight tabular-nums">
                  {metric.value}
                </p>
                {metric.change !== undefined && (
                  <TrendBadge value={metric.change} />
                )}
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">{metric.detail}</p>
                <AppCardDescription>{metric.note}</AppCardDescription>
              </div>
            </AppCardContent>
          </AppCardRoot>
        );
      })}
    </section>
  );
}
