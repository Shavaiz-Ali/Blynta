"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: React.ReactNode;
  trend?: {
    value: string | number;
    positive?: boolean;
    label?: string;
  };
  className?: string;
  loading?: boolean;
}

export function StatCard({
  title,
  value,
  description,
  icon,
  trend,
  className,
  loading = false,
}: StatCardProps) {
  return (
    <Card className={cn("hover:border-border transition-colors", className)}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {title}
          </span>
          {icon && (
            <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              {icon}
            </div>
          )}
        </div>

        <div className="mt-3">
          {loading ? (
            <Skeleton className="h-7 w-20 mb-1" />
          ) : (
            <div className="text-2xl font-bold tracking-tight text-foreground">
              {value}
            </div>
          )}

          {(description || trend) && (
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              {trend && (
                <span
                  className={cn(
                    "font-semibold flex items-center",
                    trend.positive === true && "text-emerald-500",
                    trend.positive === false && "text-destructive",
                    trend.positive === undefined && "text-muted-foreground"
                  )}
                >
                  {trend.positive ? "+" : ""}
                  {trend.value}
                </span>
              )}
              {description && <span>{description}</span>}
              {trend?.label && <span>{trend.label}</span>}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
