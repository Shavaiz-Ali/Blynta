export type Metric = "newUsers" | "completed" | "failed";
export interface AnalyticsQuery { metric: Metric; dimension: "date"; range: "14d"; aggregation: "sum"; comparison?: "previous-period"; filters?: Record<string, string> }
export interface AnalyticsPoint { date: string; value: number }
export interface AnalyticsResult { points: AnalyticsPoint[]; comparisonAvailable: boolean }
