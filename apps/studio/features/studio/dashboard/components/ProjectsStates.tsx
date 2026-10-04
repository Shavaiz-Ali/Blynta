import { AppButton, AppSkeleton } from "@blynta/ui";
import {
  FilePlus2,
  SearchX,
  RefreshCw,
  TriangleAlert,
  Upload,
  Clapperboard,
} from "lucide-react";
import type { CreationMode } from "./QuickStart";

export function ProjectsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="studio-project-grid" role="status">
      <span className="sr-only">Loading projects</span>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="studio-project-skeleton">
          <AppSkeleton className="aspect-video rounded-none" />
          <div className="p-4">
            <AppSkeleton className="h-4 w-3/4" />
            <AppSkeleton className="mt-3 h-3 w-1/2" />
            <AppSkeleton className="mt-3 h-3 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProjectsEmptyState({
  filtered,
  onClear,
  onNew,
  onBlynta,
}: {
  filtered: boolean;
  onClear: () => void;
  onNew: (mode: CreationMode) => void;
  onBlynta: () => void;
}) {
  return (
    <div className="studio-projects-empty">
      <span className="empty-workspace-icon">
        {filtered ? <SearchX size={28} /> : <FilePlus2 size={28} />}
      </span>
      <h3>
        {filtered
          ? "No matching projects"
          : "Start creating with Blynta Studio"}
      </h3>
      <p>
        {filtered
          ? "Try a different project name or clear your source filter."
          : "Build your first video, upload footage, or bring a clip over from Blynta."}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {filtered ? (
          <AppButton variant="outline" onClick={onClear}>
            Clear filters
          </AppButton>
        ) : (
          <>
            <AppButton icon={<FilePlus2 />} onClick={() => onNew("blank")}>
              New project
            </AppButton>
            <AppButton
              variant="outline"
              icon={<Upload />}
              onClick={() => onNew("upload")}
            >
              Upload video
            </AppButton>
            <AppButton
              variant="outline"
              icon={<Clapperboard />}
              onClick={onBlynta}
            >
              From Blynta
            </AppButton>
          </>
        )}
      </div>
    </div>
  );
}

export function ProjectsError({
  error,
  onRetry,
  retrying,
}: {
  error: string;
  onRetry: () => void;
  retrying?: boolean;
}) {
  return (
    <div className="studio-projects-error" role="alert">
      <TriangleAlert size={22} />
      <div>
        <h3>Couldn’t load your projects</h3>
        <p>{error}</p>
      </div>
      <AppButton
        variant="outline"
        icon={<RefreshCw />}
        isLoading={retrying}
        onClick={onRetry}
      >
        Retry
      </AppButton>
    </div>
  );
}
