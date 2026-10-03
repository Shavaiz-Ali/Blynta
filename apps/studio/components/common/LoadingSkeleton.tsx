import { AppSkeleton } from "./AppSkeleton";
export function LoadingSkeleton() {
  return (
    <div className="p-8" aria-label="Loading workspace" role="status">
      <span className="sr-only">Loading workspace</span>
      <AppSkeleton className="h-10 w-56 mb-10" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {[1, 2, 3].map((i) => (
          <div key={i}>
            <AppSkeleton className="aspect-video" />
            <AppSkeleton className="mt-4 h-5 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
