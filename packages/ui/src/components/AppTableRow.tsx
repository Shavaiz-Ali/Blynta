"use client";

import type { ReactNode } from "react";
import { cn } from "../lib/utils";

/** Slots follow the existing Activity row; features retain their data and actions. */
export interface AppTableRowProps {
  icon: ReactNode;
  iconClassName?: string;
  title: ReactNode;
  badges?: ReactNode;
  description?: ReactNode;
  metadata?: ReactNode;
  timestamp?: ReactNode;
  timestampTitle?: string;
  action?: ReactNode;
}

export const appTableRowActionClassName =
  "h-7 sm:h-8 text-xs font-semibold px-2.5 sm:px-3 hover:border-primary/40 hover:bg-primary/5 cursor-pointer shadow-2xs whitespace-nowrap shrink-0";

export function AppTableRow({
  icon,
  iconClassName,
  title,
  badges,
  description,
  metadata,
  timestamp,
  timestampTitle,
  action,
}: AppTableRowProps) {
  return (
    <div className="group px-4 py-3.5 sm:px-5 sm:py-4 transition-all duration-150 hover:bg-muted/30">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-start gap-3.5 flex-1 min-w-0">
          <div
            className={cn(
              "h-9 w-9 sm:h-10 sm:w-10 rounded-xl flex items-center justify-center shrink-0 border transition-colors shadow-2xs mt-0.5 sm:mt-0",
              iconClassName,
            )}
          >
            {icon}
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs sm:text-sm font-semibold text-foreground truncate max-w-sm sm:max-w-md">
                {title}
              </span>
              {badges}
            </div>
            {description && (
              <p className="text-xs text-muted-foreground line-clamp-1 leading-relaxed">
                {description}
              </p>
            )}
            {metadata && (
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                {metadata}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0 self-end sm:self-center pl-12 sm:pl-0">
          {timestamp != null && (
            <span
              className="text-xs text-muted-foreground font-mono whitespace-nowrap min-w-[50px] text-right"
              title={timestampTitle}
            >
              {timestamp}
            </span>
          )}
          {action}
        </div>
      </div>
    </div>
  );
}
