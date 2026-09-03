"use client";

import * as React from "react";
import { TypeIcon } from "@/features/dashboard/icons";
import { cn } from "@/lib/utils";

function SoonBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-muted text-muted-foreground border border-border/70 shrink-0",
        className
      )}
    >
      Soon
    </span>
  );
}

export function CaptionStylingCard() {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-2xs space-y-3 opacity-65">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <TypeIcon className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Caption Styling
          </h3>
        </div>
        <SoonBadge />
      </div>

      <p className="text-[11px] text-muted-foreground">
        Create customized typography and keyword highlights.
      </p>

      <div className="space-y-2 pointer-events-none select-none text-xs">
        <div>
          <span className="text-[10px] text-muted-foreground block mb-1">
            Typography Preset
          </span>
          <div className="w-full h-8 rounded-lg bg-muted/50 border border-border/60 px-3 flex items-center text-xs text-muted-foreground">
            The Bold Font / Montserrat
          </div>
        </div>

        <div>
          <span className="text-[10px] text-muted-foreground block mb-1">
            Keyword Highlight Color
          </span>
          <div className="flex items-center gap-2">
            <span className="h-5 w-5 rounded-full bg-chart-4 border border-border/80" />
            <span className="h-5 w-5 rounded-full bg-chart-1 border border-border/80" />
            <span className="h-5 w-5 rounded-full bg-primary border border-border/80" />
            <span className="text-[11px] text-muted-foreground font-mono">#00E5FF</span>
          </div>
        </div>

        <div>
          <span className="text-[10px] text-muted-foreground block mb-1">
            Animation Style
          </span>
          <div className="grid grid-cols-2 gap-1.5">
            <div className="p-1.5 text-center rounded-md bg-muted/50 border border-border/60 text-[11px] text-muted-foreground">
              Karaoke Fade
            </div>
            <div className="p-1.5 text-center rounded-md bg-muted/50 border border-border/60 text-[11px] text-muted-foreground">
              Bouncing Word
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
