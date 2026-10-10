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
    <AppCardRoot>
      <AppCardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <AppCardTitle className="text-lg">Processing queues</AppCardTitle>
          <AppCardDescription>
            Live workload across Blynta workers
          </AppCardDescription>
        </div>
        <AppCardAction>
          <Link
            href="/queues"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Monitor queues <ArrowUpRight className="size-3.5" />
          </Link>
        </AppCardAction>
      </AppCardHeader>
      <AppCardContent>
        <div className="overflow-x-auto rounded-lg border">
          <Table className="w-full min-w-[620px] text-sm">
            <TableHeader className="bg-muted/40 text-left text-xs text-muted-foreground">
              <TableRow>
                <TableHead className="px-4 py-3 font-medium">Worker</TableHead>
                <TableHead className="px-4 py-3 font-medium">Status</TableHead>
                <TableHead className="px-4 py-3 text-right font-medium">
                  Active
                </TableHead>
                <TableHead className="px-4 py-3 text-right font-medium">
                  Waiting
                </TableHead>
                <TableHead className="px-4 py-3 text-right font-medium">
                  Delayed
                </TableHead>
                <TableHead className="px-4 py-3 text-right font-medium">
                  Failed
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y">
              {queues.map((queue) => (
                <TableRow key={queue.name} className="hover:bg-muted/25">
                  <TableCell className="px-4 py-3 font-medium">
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
                  <TableCell className="px-4 py-3 text-right tabular-nums">
                    {queue.active}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right tabular-nums">
                    {queue.waiting}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right tabular-nums">
                    {queue.delayed}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right tabular-nums">
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
    <AppCardRoot>
      <AppCardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <AppCardTitle className="text-lg">Recent activity</AppCardTitle>
          <AppCardDescription>
            Latest administrative and system events
          </AppCardDescription>
        </div>
        <AppCardAction>
          <Link
            href="/audit"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Audit log <ArrowUpRight className="size-3.5" />
          </Link>
        </AppCardAction>
      </AppCardHeader>
      <AppCardContent>
        {events.length ? (
          <ul className="divide-y">
            {events.slice(0, 6).map((event) => (
              <li
                key={event._id}
                className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
              >
                <div className="min-w-0">
                  <p className="break-words font-medium">
                    {event.title || event.action}
                  </p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {event.adminName ||
                      event.adminEmail ||
                      event.actorType ||
                      "System"}
                  </p>
                </div>
                <time
                  className="shrink-0 text-xs text-muted-foreground sm:max-w-28 sm:text-right"
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
          <p className="py-8 text-center text-sm text-muted-foreground">
            No recent activity has been recorded.
          </p>
        )}
      </AppCardContent>
    </AppCardRoot>
  );
}
