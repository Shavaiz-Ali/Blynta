import { DashboardLayout } from "@/features/dashboard/components/DashboardLayout";
import { JobDetailSkeleton } from "@/features/jobs/components/JobDetailSkeleton";

export default function ClipStudioLoading() {
  return (
    <DashboardLayout
      headerContent={
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="h-4 w-12 bg-muted rounded animate-pulse" />
          <span>/</span>
          <div className="h-4 w-28 bg-muted rounded animate-pulse" />
          <span>/</span>
          <div className="h-4 w-20 bg-muted rounded animate-pulse" />
        </div>
      }
    >
      <JobDetailSkeleton />
    </DashboardLayout>
  );
}
