import { DashboardLayout } from "@/features/dashboard/components/DashboardLayout";
import { SourceVideoDetailsSkeleton } from "@/features/jobs/components/SourceVideoDetailsSkeleton";

export default function SourceVideoLoading() {
  return (
    <DashboardLayout
      headerContent={
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="h-4 w-12 bg-muted rounded animate-pulse" />
          <span>/</span>
          <div className="h-4 w-32 bg-muted rounded animate-pulse" />
        </div>
      }
    >
      <SourceVideoDetailsSkeleton />
    </DashboardLayout>
  );
}
