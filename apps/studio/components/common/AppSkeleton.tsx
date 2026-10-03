import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
export function AppSkeleton({ className }: { className?: string }) {
  return (
    <Skeleton aria-hidden="true" className={cn("rounded-md", className)} />
  );
}
