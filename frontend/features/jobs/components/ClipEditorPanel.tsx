"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  SlidersIcon,
  LockIcon,
} from "@/features/dashboard/icons";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

export type AspectRatioOption = "9:16" | "1:1" | "16:9";

export interface ClipEditorPanelProps {
  aspectRatio: AspectRatioOption;
  onAspectRatioChange: (ratio: AspectRatioOption) => void;
}

interface FutureFeatureProps {
  title: string;
  desc: string;
  badge?: string;
}

function FutureFeatureRow({ title, desc, badge = "Coming Soon" }: FutureFeatureProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <div className="flex items-center justify-between p-2 rounded-md border border-border/50 bg-muted/10 opacity-70 hover:opacity-90 transition-opacity cursor-not-allowed select-none">
            <div className="space-y-0.5 text-left">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-foreground">
                  {title}
                </span>
                <LockIcon className="h-3 w-3 text-muted-foreground/60" />
              </div>
              <p className="text-[11px] text-muted-foreground">{desc}</p>
            </div>
            <Badge variant="outline" className="text-[9px] font-medium uppercase tracking-wider px-1.5 py-0 border-border/70 text-muted-foreground/70 shrink-0">
              {badge}
            </Badge>
          </div>
        }
      />
      <TooltipContent side="left" className="text-xs max-w-xs">
        {title} editing is currently on the product roadmap and will be enabled in a future release.
      </TooltipContent>
    </Tooltip>
  );
}

export function ClipEditorPanel({
  aspectRatio,
  onAspectRatioChange,
}: ClipEditorPanelProps) {
  const aspectOptions: { label: string; value: AspectRatioOption; sub: string; disabled?: boolean }[] = [
    { label: "9:16", sub: "Vertical", value: "9:16", disabled: false },
    { label: "1:1", sub: "Square", value: "1:1", disabled: true },
    { label: "16:9", sub: "Landscape", value: "16:9", disabled: true },
  ];

  return (
    <div className="rounded-lg border border-border/80 bg-card/60 p-4 sm:p-5 space-y-4 h-full flex flex-col justify-between shadow-2xs">
      <div className="flex items-center justify-between pb-3 border-b border-border/60">
        <div className="flex items-center gap-2">
          <SlidersIcon className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
            Studio & Framing
          </h3>
        </div>
      </div>

      <div className="space-y-3.5 flex-1">
        {/* ── Segmented Aspect Ratio Control ── */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground block">
            Aspect Ratio Framing
          </label>
          <div className="grid grid-cols-3 gap-2">
            {aspectOptions.map((opt) => {
              const isSelected = aspectRatio === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  disabled={opt.disabled}
                  onClick={() => !opt.disabled && onAspectRatioChange(opt.value)}
                  className={cn(
                    "flex flex-col items-center justify-center py-2 px-2 rounded-md border text-xs font-semibold transition-all select-none",
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary shadow-xs ring-1 ring-primary/30 cursor-pointer"
                      : opt.disabled
                        ? "bg-muted/15 border-border/40 text-muted-foreground/45 cursor-not-allowed"
                        : "bg-muted/30 border-border text-muted-foreground hover:text-foreground hover:bg-muted/60 cursor-pointer"
                  )}
                >
                  <span className="font-mono text-xs">{opt.label}</span>
                  <span className="text-[10px] mt-0.5 font-normal">
                    {opt.disabled ? "Soon" : opt.sub}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Future Roadmap Capabilities ── */}
        <div className="space-y-1.5 pt-0.5">
          <label className="text-xs font-semibold text-foreground block">
            Advanced Studio Engine
          </label>
          <div className="space-y-1.5">
            <FutureFeatureRow
              title="Dynamic Subtitle Styles"
              desc="Animated highlights, custom fonts & emojis"
            />
            <FutureFeatureRow
              title="Visual B-Roll & Zooms"
              desc="Automatic AI sound effects and zoom cuts"
            />
            <FutureFeatureRow
              title="Branding & Watermark"
              desc="Creator handle overlay & intro hooks"
            />
          </div>
        </div>
      </div>
    </div>
  );
}


