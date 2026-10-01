import { Badge } from "@/components/ui/badge";
export function AppStatusBadge({ status }: { status: string }) { return <Badge variant={["failed", "suspended", "past_due", "unavailable"].includes(status) ? "destructive" : ["active", "completed", "paid"].includes(status) ? "default" : "secondary"} className="capitalize">{status.replaceAll("_", " ")}</Badge>; }
