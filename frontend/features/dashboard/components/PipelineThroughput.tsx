"use client";

import { AppCard } from "@/components/common/AppCard";
import { UserProfile } from "@/features/auth/types";
import { GaugeIcon, ZapIcon, CommandIcon } from "../icons";

interface PipelineThroughputProps {
  profile?: UserProfile | null;
  totalClips?: number;
}

export function PipelineThroughput({ profile, totalClips = 0 }: PipelineThroughputProps) {
  const creditsBalance = profile?.creditsBalance ?? 0;
  const creditsTotal = profile?.plan === "pro" ? 100 : profile?.plan === "business" ? 500 : 5;
  const creditsUsed = Math.max(0, creditsTotal - creditsBalance);

  return (
    <div className="space-y-4 pt-2">
      {/* ── Metric Card ── */}
      <AppCard className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Left: Speed summary */}
        <div className="flex items-center gap-3.5">
          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shrink-0">
            <GaugeIcon className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground">Pipeline Throughput</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Average generation speed: <span className="text-foreground font-medium">1.8 minutes</span> per 1-hour source
            </p>
          </div>
        </div>

        {/* Right: Accuracy & Quota */}
        <div className="flex items-center gap-6 sm:gap-8 self-end sm:self-center">
          <div className="text-right">
            <p className="text-sm font-bold font-mono text-primary">99.4%</p>
            <p className="text-[11px] text-muted-foreground font-medium">Salience Accuracy</p>
          </div>
          <div className="h-7 w-px bg-border" />
          <div className="text-right">
            <p className="text-sm font-bold font-mono text-foreground">
              {creditsUsed} <span className="text-muted-foreground font-normal text-xs">/ {creditsTotal}</span>
            </p>
            <p className="text-[11px] text-muted-foreground font-medium">Monthly Ingests</p>
          </div>
        </div>
      </AppCard>

      {/* ── Keyboard Shortcuts & System Status Footer ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground px-2 py-1">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border font-mono text-[10px] font-semibold text-foreground">
              ⌘ V
            </kbd>
            <span>Paste directly anywhere to ingest</span>
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border font-mono text-[10px] font-semibold text-foreground">
              ⌘ K
            </kbd>
            <span>Quick Search</span>
          </span>
        </div>

        <div className="flex items-center gap-4">
          <span className="hover:text-foreground cursor-pointer transition-colors">API Docs</span>
          <span>•</span>
          <span className="hover:text-foreground cursor-pointer transition-colors">Keyboard Shortcuts</span>
          <span>•</span>
          <span className="inline-flex items-center gap-1.5 text-primary font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            Engine Latency: 42ms
          </span>
        </div>
      </div>
    </div>
  );
}
