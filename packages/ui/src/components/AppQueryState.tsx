"use client";
import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { AppButton } from "./AppButton";
import { cn } from "../lib/utils";

export function AppQueryState({
  title,
  description,
  onRetry,
  retrying,
  children,
  className,
}: {
  title: string;
  description: string;
  onRetry?: () => void;
  retrying?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section
      role={onRetry ? "alert" : "status"}
      className={cn(
        "min-w-0 rounded-lg border border-border bg-card p-5 sm:p-6",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <AlertCircle
          aria-hidden="true"
          className="mt-0.5 size-5 shrink-0 text-muted-foreground"
        />
        <div className="min-w-0 space-y-2">
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            {description}
          </p>
          {(onRetry || children) && (
            <div className="flex flex-wrap items-center gap-2 pt-2">
              {onRetry && (
                <AppButton
                  variant="outline"
                  size="sm"
                  onClick={onRetry}
                  isLoading={retrying}
                >
                  Try again
                </AppButton>
              )}
              {children}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
