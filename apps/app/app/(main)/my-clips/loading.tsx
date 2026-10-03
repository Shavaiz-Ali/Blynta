import { DashboardLayout } from "@/features/dashboard/components/DashboardLayout";
import { ClipsLibrarySkeleton } from "@/features/jobs/components/ClipsLibrarySkeleton";

export default function MyClipsLoading() {
  return (
    <DashboardLayout
      headerContent={
        <div className="flex items-center gap-2">
          <div className="h-4 w-16 bg-muted rounded animate-pulse" />
          <div className="h-4 w-20 bg-muted/60 rounded-md animate-pulse" />
        </div>
      }
    >
      <ClipsLibrarySkeleton />
    </DashboardLayout>
  );
}
