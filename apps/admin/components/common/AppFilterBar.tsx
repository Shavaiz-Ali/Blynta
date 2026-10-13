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
        "flex min-w-0 flex-wrap items-center gap-3 rounded-lg border bg-card p-4",
        className,
      )}
    >
      {children}
    </div>
  );
}
