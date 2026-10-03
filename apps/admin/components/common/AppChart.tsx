"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AnalyticsPoint } from "@/features/analytics/types";

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  color: "var(--popover-foreground)",
};

function formatChartDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

export function AppChart({
  points,
  label,
}: {
  points: AnalyticsPoint[];
  label: string;
}) {
  return (
    <div
      className="h-72 min-w-0 w-full"
      role="img"
      aria-label={`${label} over time`}
    >
      <ResponsiveContainer
        width="100%"
        height="100%"
        minWidth={0}
        minHeight={0}
      >
        <LineChart
          data={points}
          margin={{ top: 8, right: 8, bottom: 0, left: -20 }}
        >
          <CartesianGrid
            stroke="var(--border)"
            vertical={false}
            strokeOpacity={0.65}
          />
          <XAxis
            dataKey="date"
            tickFormatter={formatChartDate}
            tickLine={false}
            axisLine={false}
            minTickGap={28}
          />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={tooltipStyle}
            labelFormatter={(value) => formatChartDate(String(value))}
          />
          <Line
            name={label}
            type="monotone"
            dataKey="value"
            stroke="var(--chart-1)"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface ActivityChartPoint {
  date: string;
  total: number;
  completed: number;
  failed: number;
  newUsers: number;
  generatedClips: number;
}

export function AppActivityAreaChart({
  points,
}: {
  points: ActivityChartPoint[];
}) {
  return (
    <div
      className="h-80 min-w-0 w-full"
      role="img"
      aria-label="Daily processing jobs and generated clips"
    >
      <ResponsiveContainer
        width="100%"
        height="100%"
        minWidth={0}
        minHeight={0}
      >
        <AreaChart
          data={points}
          margin={{ top: 12, right: 8, bottom: 0, left: -20 }}
        >
          <defs>
            <linearGradient id="dashboard-total" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.42} />
              <stop
                offset="95%"
                stopColor="var(--chart-1)"
                stopOpacity={0.04}
              />
            </linearGradient>
            <linearGradient id="dashboard-clips" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--chart-3)" stopOpacity={0.28} />
              <stop
                offset="95%"
                stopColor="var(--chart-3)"
                stopOpacity={0.02}
              />
            </linearGradient>
          </defs>
          <CartesianGrid
            stroke="var(--border)"
            vertical={false}
            strokeOpacity={0.65}
          />
          <XAxis
            dataKey="date"
            tickFormatter={formatChartDate}
            tickLine={false}
            axisLine={false}
            minTickGap={30}
          />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={tooltipStyle}
            labelFormatter={(value) => formatChartDate(String(value))}
          />
          <Area
            name="Jobs submitted"
            type="monotone"
            dataKey="total"
            stroke="var(--chart-1)"
            fill="url(#dashboard-total)"
            strokeWidth={2}
          />
          <Area
            name="Clips generated"
            type="monotone"
            dataKey="generatedClips"
            stroke="var(--chart-3)"
            fill="url(#dashboard-clips)"
            strokeWidth={1.5}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface DonutDatum {
  name: string;
  value: number;
}

export function AppDonutChart({
  data,
  totalLabel = "Jobs",
}: {
  data: DonutDatum[];
  totalLabel?: string;
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const colors = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
  ];

  return (
    <div
      className="relative h-72 min-w-0 w-full"
      role="img"
      aria-label={`${total.toLocaleString()} ${totalLabel.toLowerCase()} by status`}
    >
      <ResponsiveContainer
        width="100%"
        height="100%"
        minWidth={0}
        minHeight={0}
      >
        <PieChart>
          <Tooltip contentStyle={tooltipStyle} />
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={68}
            outerRadius={106}
            stroke="var(--card)"
            strokeWidth={2}
            paddingAngle={1}
          >
            {data.map((item, index) => (
              <Cell key={item.name} fill={colors[index % colors.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <strong className="text-3xl font-semibold tabular-nums">
          {total.toLocaleString()}
        </strong>
        <span className="text-xs text-muted-foreground">{totalLabel}</span>
      </div>
    </div>
  );
}

export interface BarDatum {
  name: string;
  value: number;
}

export function AppHorizontalBarChart({
  data,
  valueLabel,
}: {
  data: BarDatum[];
  valueLabel: string;
}) {
  return (
    <div
      className="h-72 min-w-0 w-full"
      role="img"
      aria-label={`${valueLabel} by category`}
    >
      <ResponsiveContainer
        width="100%"
        height="100%"
        minWidth={0}
        minHeight={0}
      >
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 12, bottom: 4, left: 12 }}
        >
          <CartesianGrid
            stroke="var(--border)"
            horizontal={false}
            strokeOpacity={0.55}
          />
          <XAxis type="number" allowDecimals={false} hide />
          <YAxis
            type="category"
            dataKey="name"
            width={78}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            cursor={{ fill: "var(--muted)", opacity: 0.5 }}
          />
          <Bar
            name={valueLabel}
            dataKey="value"
            fill="var(--chart-1)"
            radius={[4, 4, 4, 4]}
            barSize={34}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
