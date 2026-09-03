"use client";

import * as React from "react";
import Link from "next/link";
import { Job, Clip, Highlight } from "@/features/jobs/types";
import { useDownloadClip } from "@/features/jobs/queries";
import { useCurrentUser } from "@/features/auth/queries";
import { getClipId, getJobId } from "./helpers";
import { formatTimestamp } from "@/features/dashboard/utils";
import { AppButton } from "@/components/common/AppButton";
import {
  DownloadIcon,
  TrashIcon,
  LockIcon,
} from "@/features/dashboard/icons";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface StudioRightPanelProps {
  job: Job;
  clip: Clip;
  highlight?: Highlight;
  clipIndex: number;
  onDeleteClip: () => void;
}

function SoonBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-bold uppercase tracking-wider bg-muted text-muted-foreground border border-border/70 shrink-0",
        className
      )}
    >
      Soon
    </span>
  );
}

export function StudioRightPanel({
  job,
  clip,
  highlight,
  clipIndex,
  onDeleteClip,
}: StudioRightPanelProps) {
  const downloadClip = useDownloadClip();
  const [downloading, setDownloading] = React.useState(false);
  const { data: user } = useCurrentUser();

  const clipId = getClipId(clip);
  const jobId = getJobId(job);

  const duration = formatTimestamp(clip.endTime - clip.startTime);
  const resolutionText =
    job.resolutionUsed === "720p"
      ? "720p HD"
      : job.resolutionUsed === "1080p"
        ? "1080p FHD"
        : "1080p HD";

  async function handleDownload() {
    try {
      setDownloading(true);
      toast.info("Preparing clip download...");
      const { signedUrl } = await downloadClip.mutateAsync({ jobId, clipId });
      const a = document.createElement("a");
      a.href = signedUrl;
      a.download = `blynta-clip-${clipIndex + 1}.mp4`;
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success("Clip download started!");
    } catch (err: any) {
      toast.error(err?.message || "Failed to download clip.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 min-w-0 w-full">
      {/* Top Card: Clip Metadata, Specs, Aspect Ratio & Primary Actions */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Clip Details
          </span>
          {clip.hasCaptions && (
            <span className="inline-flex items-center rounded-md bg-primary/10 text-primary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide border border-primary/20">
              Captioned
            </span>
          )}
        </div>

        {/* Title */}
        <div>
          <h2 className="text-base sm:text-lg font-bold text-foreground leading-snug">
            {highlight?.clipTitle?.trim() || `Clip ${clipIndex + 1}`}
          </h2>
        </div>

        {/* Style Badge & Emojis if present */}
        {(highlight?.style || (highlight?.emojis && highlight.emojis.length > 0)) && (
          <div className="flex flex-wrap items-center gap-2">
            {highlight?.style && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Style:
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/25 text-[11px] font-mono font-semibold capitalize">
                  {highlight.style.replace(/-/g, " ")}
                </span>
              </div>
            )}
            {highlight?.emojis && highlight.emojis.length > 0 && (
              <div className="flex items-center gap-1">
                {highlight.emojis.map((emoji, idx) => (
                  <span key={idx} className="text-sm">
                    {emoji}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Hook Overlay / Banner text if present */}
        {highlight?.hookText && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-2.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[10px] uppercase font-bold text-primary shrink-0 tracking-wider">
                Hook Banner:
              </span>
              <span className="text-xs font-semibold text-foreground truncate">
                &ldquo;{highlight.hookText}&rdquo;
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(highlight.hookText!);
                toast.success("Copied hook text!");
              }}
              className="text-[10px] text-primary font-medium hover:underline shrink-0 cursor-pointer"
            >
              Copy
            </button>
          </div>
        )}

        {/* Description */}
        <div>
          {highlight?.clipDescription ? (
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              {highlight.clipDescription}
            </p>
          ) : user?.plan === "free" ? (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
              <LockIcon className="h-3.5 w-3.5 shrink-0" />
              <span>Clip descriptions available on </span>
              <Link href="/billing" className="text-primary font-medium hover:underline">
                Pro
              </Link>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">No description provided.</p>
          )}
        </div>

        {/* Tags */}
        {highlight?.tags && highlight.tags.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Tags &amp; Keywords ({highlight.tags.length})
              </span>
              <button
                type="button"
                onClick={() => {
                  const tagText = highlight.tags!
                    .map((t) => (t.startsWith("#") ? t : `#${t}`))
                    .join(" ");
                  navigator.clipboard.writeText(tagText);
                  toast.success("Copied clip tags to clipboard!");
                }}
                className="text-[10px] font-medium text-primary hover:text-primary/80 transition-colors cursor-pointer"
              >
                Copy All
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {highlight.tags.map((tag, idx) => {
                const formatted = tag.startsWith("#") ? tag : `#${tag}`;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(formatted);
                      toast.success(`Copied ${formatted}`);
                    }}
                    className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted hover:bg-muted/80 text-foreground/85 text-[11px] font-mono border border-border/70 transition-colors cursor-pointer"
                    title="Click to copy"
                  >
                    {formatted}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Specs Grid: Duration, Resolution & Format */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/70 text-xs">
          <div className="p-2 rounded-xl bg-muted/40 border border-border/50">
            <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-0.5">
              Duration
            </span>
            <span className="font-mono font-semibold text-foreground tabular-nums text-xs">
              {duration}
            </span>
          </div>

          <div className="p-2 rounded-xl bg-muted/40 border border-border/50">
            <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-0.5">
              Resolution
            </span>
            <span className="font-mono font-semibold text-foreground truncate block text-xs">
              {resolutionText}
            </span>
          </div>

          <div className="p-2 rounded-xl bg-muted/40 border border-border/50">
            <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-0.5">
              Aspect Ratio
            </span>
            <span className="font-mono font-semibold text-primary truncate block text-xs">
              9:16 Shorts
            </span>
          </div>
        </div>

        {/* Compact Aspect Ratio Format Switcher */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Video Aspect Ratio
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">9:16 Vertical</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-muted/40 rounded-xl border border-border/60">
            <button
              type="button"
              className="py-1 rounded-lg bg-primary text-primary-foreground font-semibold text-xs shadow-xs text-center cursor-default"
            >
              9:16
            </button>
            <button
              type="button"
              disabled
              className="py-1 rounded-lg text-muted-foreground/60 opacity-50 flex items-center justify-center gap-1 text-xs cursor-not-allowed"
              title="1:1 Square — Coming Soon"
            >
              <span>1:1</span>
              <SoonBadge />
            </button>
            <button
              type="button"
              disabled
              className="py-1 rounded-lg text-muted-foreground/60 opacity-50 flex items-center justify-center gap-1 text-xs cursor-not-allowed"
              title="16:9 Wide — Coming Soon"
            >
              <span>16:9</span>
              <SoonBadge />
            </button>
          </div>
        </div>

        {/* Primary CTA & Secondary Delete Action */}
        <div className="pt-2 flex flex-col gap-2">
          <AppButton
            onClick={handleDownload}
            isLoading={downloading}
            icon={downloading ? undefined : <DownloadIcon className="h-4 w-4" />}
            className="w-full h-10 text-xs font-semibold shadow-xs"
          >
            Download MP4
          </AppButton>

          <div className="flex justify-center pt-0.5">
            <button
              type="button"
              onClick={onDeleteClip}
              className="text-[11px] font-medium text-muted-foreground/60 hover:text-destructive transition-colors inline-flex items-center gap-1.5 cursor-pointer py-1"
            >
              <TrashIcon className="h-3.5 w-3.5" />
              <span>Delete this clip</span>
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
