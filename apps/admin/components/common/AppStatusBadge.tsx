import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const SUCCESS_STATUSES = [
  "active",
  "completed",
  "paid",
  "enabled",
  "valid",
  "configured",
  "success",
  "healthy",
  "connected",
];

const DESTRUCTIVE_STATUSES = [
  "failed",
  "suspended",
  "past_due",
  "unavailable",
  "invalid",
  "error",
  "cancelled",
  "canceled",
];

const WARNING_STATUSES = ["delayed", "waiting", "warning", "paused", "pending_review"];

export function AppStatusBadge({
  status,
  className,
}: {
  status?: string | null;
  className?: string;
}) {
  const safeStatus = typeof status === "string" && status.trim().length > 0 ? status.trim() : "unknown";
  const normalized = safeStatus.toLowerCase();
  const isSuccess = SUCCESS_STATUSES.includes(normalized);
  const isDestructive = DESTRUCTIVE_STATUSES.includes(normalized);
  const isWarning = WARNING_STATUSES.includes(normalized);

  return (
    <Badge
      variant="secondary"
      className={cn(
        "rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize tracking-wider inline-flex items-center gap-1.5 transition-colors",
        isDestructive &&
          "bg-destructive/10 text-destructive border border-destructive/25 dark:bg-destructive/20",
        isSuccess &&
          "bg-primary/10 text-primary border border-primary/25 dark:bg-primary/20",
        isWarning &&
          "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25",
        !isSuccess &&
          !isDestructive &&
          !isWarning &&
          "bg-muted/60 text-muted-foreground border border-border/50",
        className,
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full shrink-0",
          isSuccess && "bg-primary",
          isDestructive && "bg-destructive",
          isWarning && "bg-amber-500",
          !isSuccess && !isDestructive && !isWarning && "bg-muted-foreground/60",
        )}
      />
      {safeStatus.replaceAll("_", " ")}
    </Badge>
  );
}
