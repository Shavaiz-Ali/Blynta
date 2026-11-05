import Link from "next/link";
import { ArrowUpRight, CalendarDays } from "lucide-react";
import type { DashboardRange, DashboardStats } from "../api";
import { AppButton } from "@blynta/ui";
import {
  AppCardRoot,
  AppCardAction,
  AppCardContent,
  AppCardDescription,
  AppCardHeader,
  AppCardTitle,
} from "@blynta/ui";
import {
  AppActivityAreaChart,
  AppDonutChart,
  AppHorizontalBarChart,
  type ActivityChartPoint,
} from "@/components/common/AppChart";
import { cn } from "@/lib/utils";

const rangeOptions: Array<{ value: DashboardRange; label: string }> = [
  { value: "90d", label: "Last 3 months" },
  { value: "30d", label: "Last 30 days" },
  { value: "7d", label: "Last 7 days" },
];

export function DashboardActivityChart({
  data,
  range,
  onRangeChange,
}: {
  data: DashboardStats;
  range: DashboardRange;
  onRangeChange: (range: DashboardRange) => void;
}) {
  const usersByDate = new Map(
    data.userGrowthSeries.map((point) => [point.date, point.newUsers]),
  );
  const clipsByDate = new Map(
    data.clipActivitySeries.map((point) => [point.date, point.generated]),
  );
  const points: ActivityChartPoint[] = data.jobActivitySeries.map((point) => ({
    ...point,
    newUsers: usersByDate.get(point.date) ?? 0,
    generatedClips: clipsByDate.get(point.date) ?? 0,
  }));

  return (
    <AppCardRoot className="rounded-xl border border-border/70 bg-card shadow-xs transition-colors">
      <AppCardHeader className="flex flex-col gap-4 border-b border-border/60 p-5 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <AppCardTitle className="text-base font-bold text-foreground">
            Platform activity
          </AppCardTitle>
          <AppCardDescription className="text-xs text-muted-foreground mt-0.5">
            Daily processing demand and generated clip output
          </AppCardDescription>
        </div>
        <AppCardAction className="min-w-0 self-start sm:self-auto">
          <div
            className="flex items-center rounded-lg border border-border/70 bg-muted/40 p-1 gap-1"
            aria-label="Dashboard date range"
          >
            {rangeOptions.map((option) => {
              const active = range === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onRangeChange(option.value)}
                  className={cn(
                    "px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer",
                    active
                      ? "bg-card text-foreground shadow-2xs font-bold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </AppCardAction>
      </AppCardHeader>
      <AppCardContent className="p-5 pt-4">
        <div className="flex flex-wrap items-center gap-5 text-xs text-muted-foreground mb-4">
          <span className="inline-flex items-center gap-2">
            <i className="size-2 rounded-full bg-chart-1" />
            <span className="font-medium text-foreground">Jobs submitted</span>
          </span>
          <span className="inline-flex items-center gap-2">
            <i className="size-2 rounded-full bg-chart-3" />
            <span className="font-medium text-foreground">Clips generated</span>
          </span>
          <span className="ml-auto inline-flex items-center gap-1.5 text-muted-foreground">
            <CalendarDays className="size-3.5" />
            <span>{points.length} daily points</span>
          </span>
        </div>
        <AppActivityAreaChart points={points} />
      </AppCardContent>
    </AppCardRoot>
  );
}

export function DashboardBreakdowns({ data }: { data: DashboardStats }) {
  const statusData = data.jobStatusDistribution.map((item) => ({
    name: item.label,
    value: item.count,
  }));
  const planData = [
    { name: "Free", value: data.billing.freeUsers },
    { name: "Pro", value: data.billing.proUsers },
    { name: "Business", value: data.billing.businessUsers },
  ];

  return (
    <section
      className="grid gap-4 xl:grid-cols-2"
      aria-label="Platform breakdowns"
    >
      <AppCardRoot className="rounded-xl border border-border/70 bg-card shadow-xs transition-colors">
        <AppCardHeader className="flex flex-col gap-3 border-b border-border/60 p-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-0.5">
            <AppCardTitle className="text-base font-bold text-foreground">
              Jobs by status
            </AppCardTitle>
            <AppCardDescription className="text-xs text-muted-foreground">
              Current all-time processing distribution
            </AppCardDescription>
          </div>
          <AppCardAction>
            <Link
              href="/jobs"
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              View jobs <ArrowUpRight className="size-3.5" />
            </Link>
          </AppCardAction>
        </AppCardHeader>
        <AppCardContent className="p-5">
          <AppDonutChart data={statusData} />
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border/50 pt-4 text-xs sm:grid-cols-3">
            {statusData.map((item) => (
              <div
                key={item.name}
                className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-muted/20"
              >
                <span className="truncate text-muted-foreground font-medium">
                  {item.name}
                </span>
                <strong className="tabular-nums font-bold text-foreground">
                  {item.value.toLocaleString()}
                </strong>
              </div>
            ))}
          </div>
        </AppCardContent>
      </AppCardRoot>

      <AppCardRoot className="rounded-xl border border-border/70 bg-card shadow-xs transition-colors">
        <AppCardHeader className="flex flex-col gap-3 border-b border-border/60 p-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-0.5">
            <AppCardTitle className="text-base font-bold text-foreground">
              Customer plans
            </AppCardTitle>
            <AppCardDescription className="text-xs text-muted-foreground">
              Accounts grouped by their current tier
            </AppCardDescription>
          </div>
          <AppCardAction>
            <Link
              href="/billing"
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              View billing <ArrowUpRight className="size-3.5" />
            </Link>
          </AppCardAction>
        </AppCardHeader>
        <AppCardContent className="p-5">
          <AppHorizontalBarChart data={planData} valueLabel="Accounts" />
          <p className="border-t border-border/50 pt-4 text-xs text-muted-foreground">
            <strong className="text-foreground font-semibold">
              {data.users.paidCount.toLocaleString()}
            </strong>{" "}
            paid accounts active across Pro and Business plans.
          </p>
        </AppCardContent>
      </AppCardRoot>
    </section>
  );
}
