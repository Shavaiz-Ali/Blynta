import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function AppFilterBar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-wrap items-center gap-3 rounded-xl border border-border/70 bg-card p-3.5 sm:p-4 shadow-xs transition-colors",
        className,
      )}
    >
      {children}
    </div>
  );
}
