import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
export function AppBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "primary" | "error";
}) {
  return (
    <Badge
      variant={
        tone === "error"
          ? "destructive"
          : tone === "primary"
            ? "default"
            : "secondary"
      }
      className="rounded-sm text-[10px] font-medium"
    >
      {children}
    </Badge>
  );
}
