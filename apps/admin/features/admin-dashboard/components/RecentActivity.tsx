import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@blynta/ui";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { DashboardStats } from "../api";
import {
  AppCardRoot,
  AppCardAction,
  AppCardContent,
  AppCardDescription,
  AppCardHeader,
  AppCardTitle,
} from "@blynta/ui";
import { AppStatusBadge } from "@/components/common/AppStatusBadge";

export function QueueSnapshot({
  queues,
}: {
  queues: DashboardStats["queueHealth"];
}) {
  return (
    <AppCardRoot className="rounded-xl border border-border/70 bg-card shadow-xs transition-colors">
      <AppCardHeader className="flex flex-col gap-3 border-b border-border/60 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-0.5">
          <AppCardTitle className="text-base font-bold text-foreground">
            Processing queues
          </AppCardTitle>
          <AppCardDescription className="text-xs text-muted-foreground">
            Live workload across Blynta workers
          </AppCardDescription>
        </div>
        <AppCardAction>
          <Link
            href="/queues"
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            Monitor queues <ArrowUpRight className="size-3.5" />
          </Link>
        </AppCardAction>
      </AppCardHeader>
      <AppCardContent className="p-5">
        <div className="overflow-x-auto rounded-lg border border-border/60">
          <Table className="w-full min-w-[620px] text-xs">
            <TableHeader className="bg-muted/30 border-b border-border/60 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-4 py-3">Worker</TableHead>
                <TableHead className="px-4 py-3">Status</TableHead>
                <TableHead className="px-4 py-3 text-right">Active</TableHead>
                <TableHead className="px-4 py-3 text-right">Waiting</TableHead>
                <TableHead className="px-4 py-3 text-right">Delayed</TableHead>
                <TableHead className="px-4 py-3 text-right">Failed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border/40">
              {queues.map((queue) => (
                <TableRow key={queue.name} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="px-4 py-3 font-semibold text-foreground">
                    {queue.label}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <AppStatusBadge
                      status={
                        !queue.isHealthy
                          ? "unavailable"
                          : queue.paused
                            ? "paused"
                            : "active"
                      }
                    />
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right tabular-nums font-medium">
                    {queue.active}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {queue.waiting}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {queue.delayed}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right tabular-nums font-semibold text-destructive">
                    {queue.failed}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </AppCardContent>
    </AppCardRoot>
  );
}

export function RecentActivity({
  events,
}: {
  events: DashboardStats["recentAudit"];
}) {
  return (
    <AppCardRoot className="rounded-xl border border-border/70 bg-card shadow-xs transition-colors">
      <AppCardHeader className="flex flex-col gap-3 border-b border-border/60 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-0.5">
          <AppCardTitle className="text-base font-bold text-foreground">
            Recent activity
          </AppCardTitle>
          <AppCardDescription className="text-xs text-muted-foreground">
            Latest administrative and system events
          </AppCardDescription>
        </div>
        <AppCardAction>
          <Link
            href="/audit"
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            Audit log <ArrowUpRight className="size-3.5" />
          </Link>
        </AppCardAction>
      </AppCardHeader>
      <AppCardContent className="p-5">
        {events.length ? (
          <ul className="divide-y divide-border/40 text-xs">
            {events.slice(0, 6).map((event) => (
              <li
                key={event._id}
                className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4 hover:bg-muted/20 px-2 rounded-lg transition-colors"
              >
                <div className="min-w-0">
                  <p className="break-words font-semibold text-foreground">
                    {event.title || event.action}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    {event.adminName ||
                      event.adminEmail ||
                      event.actorType ||
                      "System"}
                  </p>
                </div>
                <time
                  className="shrink-0 text-[11px] text-muted-foreground sm:text-right"
                  dateTime={event.createdAt}
                >
                  {formatDistanceToNow(new Date(event.createdAt), {
                    addSuffix: true,
                  })}
                </time>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-8 text-center text-xs text-muted-foreground">
            No recent activity has been recorded.
          </p>
        )}
      </AppCardContent>
    </AppCardRoot>
  );
}
