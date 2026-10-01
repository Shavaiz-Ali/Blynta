import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { DashboardStats } from "../api";
import {
  AppCard,
  AppCardAction,
  AppCardContent,
  AppCardDescription,
  AppCardHeader,
  AppCardTitle,
} from "@/components/common/AppCard";
import { AppStatusBadge } from "@/components/common/AppStatusBadge";

export function QueueSnapshot({ queues }: { queues: DashboardStats["queueHealth"] }) {
  return (
    <AppCard>
      <AppCardHeader>
        <AppCardTitle className="text-lg">Processing queues</AppCardTitle>
        <AppCardDescription>Live workload across Blynta workers</AppCardDescription>
        <AppCardAction>
          <Link href="/queues" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            Monitor queues <ArrowUpRight className="size-3.5" />
          </Link>
        </AppCardAction>
      </AppCardHeader>
      <AppCardContent>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[620px] text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Worker</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Active</th>
                <th className="px-4 py-3 text-right font-medium">Waiting</th>
                <th className="px-4 py-3 text-right font-medium">Delayed</th>
                <th className="px-4 py-3 text-right font-medium">Failed</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {queues.map((queue) => (
                <tr key={queue.name} className="hover:bg-muted/25">
                  <td className="px-4 py-3 font-medium">{queue.label}</td>
                  <td className="px-4 py-3">
                    <AppStatusBadge status={!queue.isHealthy ? "unavailable" : queue.paused ? "paused" : "active"} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{queue.active}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{queue.waiting}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{queue.delayed}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{queue.failed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AppCardContent>
    </AppCard>
  );
}

export function RecentActivity({ events }: { events: DashboardStats["recentAudit"] }) {
  return (
    <AppCard>
      <AppCardHeader>
        <AppCardTitle className="text-lg">Recent activity</AppCardTitle>
        <AppCardDescription>Latest administrative and system events</AppCardDescription>
        <AppCardAction>
          <Link href="/audit" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            Audit log <ArrowUpRight className="size-3.5" />
          </Link>
        </AppCardAction>
      </AppCardHeader>
      <AppCardContent>
        {events.length ? (
          <ul className="divide-y">
            {events.slice(0, 6).map((event) => (
              <li key={event._id} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate font-medium">{event.title || event.action}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {event.adminName || event.adminEmail || event.actorType || "System"}
                  </p>
                </div>
                <time className="shrink-0 text-xs text-muted-foreground" dateTime={event.createdAt}>
                  {formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}
                </time>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">No recent activity has been recorded.</p>
        )}
      </AppCardContent>
    </AppCard>
  );
}
