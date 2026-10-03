import Link from "next/link";
import { ArrowUpRight, CalendarDays } from "lucide-react";
import type { DashboardRange, DashboardStats } from "../api";
import { AppButton } from "@blynta/ui";
import {
  AppCard,
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
    <AppCard>
      <AppCardHeader className="gap-4 border-b sm:grid-cols-[1fr_auto]">
        <div>
          <AppCardTitle className="text-lg">Platform activity</AppCardTitle>
          <AppCardDescription>
            Daily processing demand and generated clip output
          </AppCardDescription>
        </div>
        <AppCardAction className="static col-auto row-auto self-center justify-self-start sm:justify-self-end">
          <div
            className="flex flex-wrap items-center rounded-md border bg-background p-0.5"
            aria-label="Dashboard date range"
          >
            {rangeOptions.map((option) => (
              <AppButton
                key={option.value}
                type="button"
                size="sm"
                variant={range === option.value ? "secondary" : "ghost"}
                aria-pressed={range === option.value}
                onClick={() => onRangeChange(option.value)}
              >
                {option.label}
              </AppButton>
            ))}
          </div>
        </AppCardAction>
      </AppCardHeader>
      <AppCardContent className="pt-2">
        <div className="flex flex-wrap items-center gap-5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <i className="size-2 rounded-full bg-chart-1" />
            Jobs submitted
          </span>
          <span className="inline-flex items-center gap-2">
            <i className="size-2 rounded-full bg-chart-3" />
            Clips generated
          </span>
          <span className="ml-auto inline-flex items-center gap-1">
            <CalendarDays className="size-3.5" />
            {points.length} daily points
          </span>
        </div>
        <AppActivityAreaChart points={points} />
      </AppCardContent>
    </AppCard>
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
      <AppCard>
        <AppCardHeader>
          <AppCardTitle className="text-lg">Jobs by status</AppCardTitle>
          <AppCardDescription>
            Current all-time processing distribution
          </AppCardDescription>
          <AppCardAction>
            <Link
              href="/jobs"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              View jobs <ArrowUpRight className="size-3.5" />
            </Link>
          </AppCardAction>
        </AppCardHeader>
        <AppCardContent>
          <AppDonutChart data={statusData} />
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-t pt-4 text-xs sm:grid-cols-3">
            {statusData.map((item) => (
              <div
                key={item.name}
                className="flex items-center justify-between gap-2"
              >
                <span className="truncate text-muted-foreground">
                  {item.name}
                </span>
                <strong className="tabular-nums">
                  {item.value.toLocaleString()}
                </strong>
              </div>
            ))}
          </div>
        </AppCardContent>
      </AppCard>

      <AppCard>
        <AppCardHeader>
          <AppCardTitle className="text-lg">Customer plans</AppCardTitle>
          <AppCardDescription>
            Accounts grouped by their current plan
          </AppCardDescription>
          <AppCardAction>
            <Link
              href="/billing"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              View billing <ArrowUpRight className="size-3.5" />
            </Link>
          </AppCardAction>
        </AppCardHeader>
        <AppCardContent>
          <AppHorizontalBarChart data={planData} valueLabel="Accounts" />
          <p className="border-t pt-4 text-sm text-muted-foreground">
            {data.users.paidCount.toLocaleString()} paid accounts across Pro and
            Business plans.
          </p>
        </AppCardContent>
      </AppCard>
    </section>
  );
}
