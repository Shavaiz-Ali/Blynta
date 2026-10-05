"use client";
import { usePathname } from "next/navigation";
import { EditorSkeleton } from "@/features/studio/editor/components/EditorSkeleton";
import { DashboardWorkspace } from "@/features/studio/dashboard/components/StudioDashboard";
const noop = () => {};
export function LoadingSkeleton() {
  const pathname = usePathname();
  if (pathname.startsWith("/editor/")) return <EditorSkeleton />;
  return (
    <div aria-busy="true" inert>
      <DashboardWorkspace
        projects={[]}
        ready={false}
        update={async () => {}}
        retry={noop}
      />
    </div>
  );
}
