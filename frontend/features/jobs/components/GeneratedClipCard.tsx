"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Clip, Highlight, Job, useDeleteClip, useDownloadClip } from "@/features/jobs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  PlayIcon,
  SparklesIcon,
  ClockIcon,
  DownloadIcon,
  TrashIcon,
  MoreVerticalIcon,
  ArrowRightIcon,
  Share2Icon,
  FilmIcon,
} from "@/features/dashboard/icons";
import { AppButton } from "@/components/common/AppButton";
import { AppDropdown } from "@/components/common/AppDropdown";
import { AppDialog } from "@/components/common/AppDialog";
import { AppCard } from "@/components/common/AppCard";
import { Badge } from "@/components/ui/badge";

export interface GeneratedClipCardProps {
  job: Job;
  clip: Clip;
  highlight?: Highlight;
  clipIndex: number;
}

function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return "00:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function formatDuration(durationSec: number): string {
  if (!durationSec || isNaN(durationSec)) return "0:00";
  const m = Math.floor(durationSec / 60);
  const s = Math.floor(durationSec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function GeneratedClipCard({
  job,
  clip,
  highlight,
  clipIndex,
}: GeneratedClipCardProps) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const jobId = job._id || job.id;
  const clipId = clip._id || clip.id;

  const downloadMutation = useDownloadClip();
  const deleteMutation = useDeleteClip();

  const durationSec = Math.max(0, clip.endTime - clip.startTime);
  const scorePercent = highlight?.score ? Math.round(highlight.score * 100) : 85;
  const clipTitle =
    highlight?.clipTitle ||
    highlight?.hookText ||
    `Highlight #${clipIndex + 1}`;
  const hookStyle = highlight?.style || "Curiosity Hook";
  const reasonText = highlight?.reason || highlight?.clipDescription || "";

  const handleOpenClip = () => {
    router.push(`/my-clips/${jobId}/clips/${clipId}`);
  };

  const handleDownload = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      toast.info("Generating secure download link...");
      const res = await downloadMutation.mutateAsync({ jobId, clipId });
      if (res.signedUrl) {
        window.open(res.signedUrl, "_blank", "noopener,noreferrer");
        toast.success("Download started!");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to download clip";
      toast.error(msg);
    }
  };

  const handleShare = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const clipUrl = `${window.location.origin}/my-clips/${jobId}/clips/${clipId}`;
    try {
      await navigator.clipboard.writeText(clipUrl);
      toast.success("Clip link copied to clipboard!");
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      await deleteMutation.mutateAsync({ jobId, clipId });
      toast.success("Clip deleted successfully");
      setDeleteOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete clip";
      toast.error(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <AppCard
        onClick={handleOpenClip}
        className={cn(
          "group relative flex flex-col  overflow-hidden transition-all duration-200 text-left border border-border/80 bg-card",
          "hover:border-primary/40 hover:shadow-sm hover:-translate-y-0.5 cursor-pointer p-0!"
        )}
        useDefaultClasses={false}
        contentClassName="!p-0 py-0!"
      >
        {/* ── Thumbnail Area ── */}
        <div className="relative aspect-[16/10] w-full bg-muted/40 overflow-hidden select-none">
          {job.thumbnailUrl ? (
            <img
              src={job.thumbnailUrl}
              alt={clipTitle}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="h-full w-full flex flex-col items-center justify-center bg-gradient-to-br from-card via-muted/30 to-background text-muted-foreground">
              <FilmIcon className="h-6 w-6 text-primary/70 mb-1" />
              <span className="text-[11px] font-medium">Short clip #{clipIndex + 1}</span>
            </div>
          )}

          {/* Dark Overlay Gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent pointer-events-none" />

          {/* Viral Score Badge (Top Left) */}
          <div className="absolute top-2.5 left-2.5 flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-md border border-white/15 text-white shadow-xs">
            <SparklesIcon className="h-3 w-3 text-amber-400" />
            <span className="text-[11px] font-bold tracking-tight">
              {scorePercent}
            </span>
            <span className="text-[9px] text-white/70 font-medium uppercase tracking-wider">
              Viral Score
            </span>
          </div>

          {/* Hook Badge (Top Right) */}
          {hookStyle && (
            <div className="absolute top-2.5 right-2.5 max-w-[120px] truncate px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-medium text-white/90">
              {hookStyle}
            </div>
          )}

          {/* Duration Pill (Bottom Right) */}
          <div className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-md text-[11px] font-mono font-medium text-white border border-white/15">
            {formatDuration(durationSec)}
          </div>

          {/* Timestamp Range Pill (Bottom Left) */}
          <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-[10px] font-mono text-white/80 border border-white/10">
            <ClockIcon className="h-2.5 w-2.5 text-white/70" />
            <span>
              {formatTime(clip.startTime)} → {formatTime(clip.endTime)}
            </span>
          </div>

          {/* Play Icon Hover Overlay */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/30 backdrop-blur-[2px]">
            <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md transform scale-90 group-hover:scale-100 transition-transform">
              <PlayIcon className="h-4 w-4 ml-0.5" />
            </div>
          </div>
        </div>

        {/* ── Content Body ── */}
        <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 uppercase">
                Clip #{clipIndex + 1}
              </Badge>
            </div>

            <h4 className="text-sm font-bold text-foreground line-clamp-1 leading-snug group-hover:text-primary transition-colors">
              {clipTitle}
            </h4>

            {reasonText && (
              <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                {reasonText}
              </p>
            )}
          </div>

          {/* Bottom Controls Row */}
          <div className="pt-2 border-t border-border/60 flex items-center justify-between gap-2">
            <AppButton
              variant="outline"
              size="sm"
              onClick={handleOpenClip}
              icon={<ArrowRightIcon className="h-3.5 w-3.5" />}
              iconPosition="right"
              className="h-8 text-xs font-semibold hover:border-primary hover:text-primary shadow-2xs"
            >
              Open clip
            </AppButton>

            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <AppDropdown
                trigger={
                  <button
                    type="button"
                    className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors cursor-pointer"
                    aria-label="Clip options"
                  >
                    <MoreVerticalIcon className="h-4 w-4" />
                  </button>
                }
                items={[
                  {
                    label: "Open in Studio",
                    icon: <PlayIcon className="h-3.5 w-3.5 text-primary" />,
                    onClick: handleOpenClip,
                  },
                  {
                    label: "Download MP4",
                    icon: <DownloadIcon className="h-3.5 w-3.5" />,
                    onClick: () => { handleDownload(); },
                  },
                  {
                    label: "Copy Link",
                    icon: <Share2Icon className="h-3.5 w-3.5" />,
                    onClick: () => { handleShare(); },
                  },
                  {
                    label: "Delete Clip",
                    icon: <TrashIcon className="h-3.5 w-3.5" />,
                    onClick: () => setDeleteOpen(true),
                    destructive: true,
                    separatorBefore: true,
                  },
                ]}
              />
            </div>
          </div>
        </div>
      </AppCard>

      {/* Delete Confirmation Modal */}
      <AppDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Generated Clip"
        description={`Are you sure you want to delete "${clipTitle}"? This will permanently remove the generated video file from storage.`}
        footer={
          <>
            <AppButton
              variant="outline"
              size="sm"
              onClick={() => setDeleteOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </AppButton>
            <AppButton
              variant="destructive"
              size="sm"
              onClick={handleDeleteConfirm}
              isLoading={isDeleting}
              icon={<TrashIcon className="h-3.5 w-3.5" />}
            >
              Delete Clip
            </AppButton>
          </>
        }
      />
    </>
  );
}
