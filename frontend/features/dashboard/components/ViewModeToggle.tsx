"use client";

import * as React from "react";
import { AppTabs } from "@/components/common/AppTabs";
import { LayoutGridIcon, ListIcon } from "../icons";

export type ViewMode = "grid" | "list";

interface ViewModeToggleProps {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
  className?: string;
}

export function ViewModeToggle({ mode, onChange, className }: ViewModeToggleProps) {
  return (
    <AppTabs
      value={mode}
      onValueChange={(val) => onChange(val as ViewMode)}
      size="default"
      className={className}
      tabs={[
        {
          value: "grid",
          label: (
            <span className="flex items-center gap-1.5" title="Grid View (Thumbnails)">
              <LayoutGridIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Grid</span>
            </span>
          ),
        },
        {
          value: "list",
          label: (
            <span className="flex items-center gap-1.5" title="List View">
              <ListIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">List</span>
            </span>
          ),
        },
      ]}
    />
  );
}

