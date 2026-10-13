import { Badge } from "@/components/ui/badge";
export function AppStatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="secondary"
      className={`rounded-full border-0 px-2.5 py-1 text-xs capitalize ${
        ["failed", "suspended", "past_due", "unavailable", "invalid"].includes(
          status,
        )
          ? "bg-destructive/10 text-destructive"
          : [
                "active",
                "completed",
                "paid",
                "enabled",
                "valid",
                "configured",
              ].includes(status)
            ? "bg-primary/10 text-primary"
            : "bg-muted text-muted-foreground"
      }`}
    >
      {status.replaceAll("_", " ")}
    </Badge>
  );
}
