"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { LayoutGridIcon, ListIcon } from "../icons";

export type ViewMode = "grid" | "list";

interface ViewModeToggleProps {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
  className?: string;
}

export function ViewModeToggle({ mode, onChange, className }: ViewModeToggleProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center p-1 rounded-lg bg-card/90 border border-border/80 shadow-2xs backdrop-blur-sm gap-1",
        className
      )}
      role="group"
      aria-label="View mode toggle"
    >
      <button
        type="button"
        onClick={() => onChange("grid")}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200 cursor-pointer",
          mode === "grid"
            ? "bg-background text-foreground font-semibold shadow-xs border border-border/80"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/40 border border-transparent"
        )}
        title="Grid View (Thumbnails)"
      >
        <LayoutGridIcon className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Grid</span>
      </button>

      <button
        type="button"
        onClick={() => onChange("list")}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200 cursor-pointer",
          mode === "list"
            ? "bg-background text-foreground font-semibold shadow-xs border border-border/80"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/40 border border-transparent"
        )}
        title="List View"
      >
        <ListIcon className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">List</span>
      </button>
    </div>
  );
}
