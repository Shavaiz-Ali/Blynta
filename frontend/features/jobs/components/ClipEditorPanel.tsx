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
import { AppCard } from "@/components/common/AppCard";
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
          <div className="flex items-center justify-between p-2.5 rounded-md border border-border/60 bg-muted/20 opacity-70 hover:opacity-90 transition-opacity cursor-not-allowed select-none">
            <div className="space-y-0.5 text-left">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-foreground">
                  {title}
                </span>
                <LockIcon className="h-3 w-3 text-muted-foreground/60" />
              </div>
              <p className="text-[11px] text-muted-foreground">{desc}</p>
            </div>
            <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0">
              {badge}
            </Badge>
          </div>
        }
      />
      <TooltipContent side="left" className="text-xs max-w-xs">
        {title} editing is currently on our product roadmap and will be enabled in a future release.
      </TooltipContent>
    </Tooltip>
  );
}

export function ClipEditorPanel({
  aspectRatio,
  onAspectRatioChange,
}: ClipEditorPanelProps) {
  const aspectOptions: { label: string; value: AspectRatioOption; disabled?: boolean }[] = [
    { label: "9:16", value: "9:16", disabled: false },
    { label: "1:1", value: "1:1", disabled: true },
    { label: "16:9", value: "16:9", disabled: true },
  ];

  return (
    <AppCard className="space-y-5" useDefaultClasses={false}>
      <div className="flex items-center justify-between pb-2 border-b border-border/60">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center text-primary">
            <SlidersIcon className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-foreground">Studio & Framing Controls</h4>
            <p className="text-[11px] text-muted-foreground">
              Configure framing & future editing parameters
            </p>
          </div>
        </div>
      </div>

      {/* ── Aspect Ratio Selector ── */}
      <div className="space-y-2 my-5">
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
                    ? "bg-primary text-primary-foreground border-primary shadow-xs cursor-pointer"
                    : opt.disabled
                      ? "bg-muted/30 border-border/50 text-muted-foreground/60 cursor-not-allowed opacity-60"
                      : "bg-muted/40 border-border/70 text-muted-foreground hover:text-foreground hover:bg-muted/70 cursor-pointer"
                )}
              >
                <span className="font-mono text-xs">{opt.label}</span>
                <span className="text-[9px] mt-0.5 font-sans">
                  {opt.disabled ? "Coming Soon" : opt.value === "9:16" ? "Vertical" : "Square"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Future Roadmap Controls (Polished Disabled States) ── */}
      <div className="space-y-2.5 pt-1">
        <label className="text-xs font-semibold text-foreground block">
          Advanced Studio Engine
        </label>
        <div className="space-y-2">
          <FutureFeatureRow
            title="Dynamic Subtitle Styles"
            desc="Karaoke word-by-word animated highlights & emojis"
          />
          <FutureFeatureRow
            title="Custom Typography & Fonts"
            desc="Brand colors, outline shadows, and font pairings"
          />
          <FutureFeatureRow
            title="Visual B-Roll & Animations"
            desc="Automatic AI sound effects and zooms"
          />
          <FutureFeatureRow
            title="Branding & Outro Watermark"
            desc="Personal handle overlay and intro hooks"
          />
        </div>
      </div>
    </AppCard>
  );
}
