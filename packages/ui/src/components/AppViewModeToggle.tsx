"use client";
import { LayoutGrid, List } from "lucide-react";
import { AppTabs } from "./AppTabs";
export type ViewMode = "grid" | "list";
export function AppViewModeToggle({
  mode,
  onChange,
  className,
}: {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
  className?: string;
}) {
  return (
    <AppTabs
      value={mode}
      onValueChange={(value) => onChange(value as ViewMode)}
      size="default"
      className={className}
      tabs={[
        {
          value: "grid",
          label: (
            <span
              className="flex items-center gap-1.5"
              title="Grid View (Thumbnails)"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only">Grid</span>
            </span>
          ),
        },
        {
          value: "list",
          label: (
            <span className="flex items-center gap-1.5" title="List View">
              <List className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only">List</span>
            </span>
          ),
        },
      ]}
    />
  );
}
