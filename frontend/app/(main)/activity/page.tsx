import { DashboardLayout } from "@/features/dashboard/components/DashboardLayout";
import { ActivityFeed } from "@/features/activity/components/ActivityFeed";
import { ActivityIcon } from "@/features/dashboard/icons";

export const metadata = {
  title: "Activity Log — Blynta",
  description: "A full timeline of your account activity including jobs, billing, credits, and authentication events.",
};

export default function ActivityPage() {
  return (
    <DashboardLayout
      headerContent={
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
            <ActivityIcon className="h-3.5 w-3.5 text-primary" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-foreground leading-tight">
              Activity Log
            </h1>
            <p className="text-[11px] text-muted-foreground leading-tight hidden sm:block">
              Your full account timeline
            </p>
          </div>
        </div>
      }
    >
      <ActivityFeed />
    </DashboardLayout>
  );
}
