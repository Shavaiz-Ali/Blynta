"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Job, Clip, Highlight, useJob, useDeleteClip, useDownloadClip } from "@/features/jobs";
import { useCurrentUser } from "@/features/auth/queries";
import { DashboardLayout } from "@/features/dashboard/components/DashboardLayout";
import { DashboardHeaderRight } from "@/features/dashboard/components/DashboardHeaderRight";
import { AppButton } from "@/components/common/AppButton";
import { AppDropdown } from "@/components/common/AppDropdown";
import { AppDialog } from "@/components/common/AppDialog";
import { AppCard } from "@/components/common/AppCard";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { StudioVideoPlayer } from "./player/StudioVideoPlayer";
import { ClipAnalysis } from "./ClipAnalysis";
import { ClipEditorPanel, AspectRatioOption } from "./ClipEditorPanel";
import { SocialContentSection } from "./SocialContentSection";
import { ClipNavigationBar } from "./ClipNavigationBar";
import { TranscriptDialog } from "./TranscriptDialog";
import { JobDetailSkeleton } from "./JobDetailSkeleton";
import {
  getJobDisplayTitle,
  formatDate,
} from "@/features/dashboard/utils";
import {
  ChevronLeftIcon,
  DownloadIcon,
  Share2Icon,
  TrashIcon,
  ClockIcon,
  SparklesIcon,
  AlertTriangleIcon,
  CalendarIcon,
  FileTextIcon,
  MoreVerticalIcon,
  ExternalLinkIcon,
  LockIcon,
} from "@/features/dashboard/icons";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface ClipDetailViewProps {
  jobId: string;
  clipId: string;
}

function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return "00:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function ClipDetailView({ jobId, clipId }: ClipDetailViewProps) {
  const router = useRouter();
  const { data: profile } = useCurrentUser();
  const { data: job, isLoading, error } = useJob(jobId);

  const [aspectRatio, setAspectRatio] = React.useState<AspectRatioOption>("9:16");
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [transcriptOpen, setTranscriptOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isDownloading, setIsDownloading] = React.useState(false);

  const downloadMutation = useDownloadClip();
  const deleteMutation = useDeleteClip();

  // Find active clip & highlight
  const { activeClip, activeHighlight, clipIndex } = React.useMemo(() => {
    if (!job?.clips) return { activeClip: undefined, activeHighlight: undefined, clipIndex: -1 };
    const index = job.clips.findIndex(
      (c) => (c._id && c._id.toString() === clipId) || (c.id && c.id.toString() === clipId)
    );
    if (index === -1) return { activeClip: undefined, activeHighlight: undefined, clipIndex: -1 };

    const clip = job.clips[index];
    const highlight =
      job.highlights?.[index] ||
      job.highlights?.find(
        (h) =>
          Math.abs(h.startTime - clip.startTime) < 2 ||
          Math.abs(h.endTime - clip.endTime) < 2
      );

    return { activeClip: clip, activeHighlight: highlight, clipIndex: index };
  }, [job, clipId]);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      toast.info("Generating secure download URL...");
      const res = await downloadMutation.mutateAsync({ jobId, clipId });
      if (res.signedUrl) {
        window.open(res.signedUrl, "_blank", "noopener,noreferrer");
        toast.success("Download started!");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to download clip";
      toast.error(msg);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
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
      router.push(`/my-clips/${jobId}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete clip";
      toast.error(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  const headerContent = (
    <div className="flex-1 min-w-0 flex items-center justify-between">
      {/* Compact Breadcrumbs Navigation */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
        <Link
          href="/my-clips"
          className="hover:text-foreground transition-colors shrink-0"
        >
          Clips
        </Link>
        <span>/</span>
        <Link
          href={`/my-clips/${jobId}`}
          className="hover:text-foreground transition-colors truncate max-w-[140px] sm:max-w-[200px]"
        >
          {job ? getJobDisplayTitle(job, 30) : "Source Video"}
        </Link>
        <span>/</span>
        <span className="truncate max-w-[140px] sm:max-w-[200px] font-semibold text-foreground">
          {activeHighlight?.clipTitle || `Short #${clipIndex + 1}`}
        </span>
      </div>

      {profile ? (
        <DashboardHeaderRight profile={profile} />
      ) : (
        <div className="ml-auto flex items-center gap-3">
          <div className="h-9 w-9 rounded-md bg-muted animate-pulse" />
        </div>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <DashboardLayout headerContent={headerContent}>
        <JobDetailSkeleton />
      </DashboardLayout>
    );
  }

  if (error || !job || !activeClip) {
    return (
      <DashboardLayout headerContent={headerContent}>
        <AppCard className="p-10 text-center max-w-lg mx-auto my-12 border-destructive/30" useDefaultClasses={false}>
          <AlertTriangleIcon className="h-10 w-10 text-destructive mx-auto mb-3" />
          <h3 className="text-base font-bold text-foreground">
            This clip is no longer available
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            {error?.message || "The clip you requested could not be found."}
          </p>
          <AppButton
            variant="outline"
            size="sm"
            onClick={() => router.push(`/my-clips/${jobId}`)}
            className="mt-4"
          >
            Back to Generated Shorts
          </AppButton>
        </AppCard>
      </DashboardLayout>
    );
  }

  const durationSec = Math.max(0, activeClip.endTime - activeClip.startTime);
  const clipTitle =
    activeHighlight?.clipTitle ||
    activeHighlight?.hookText ||
    `Generated Short #${clipIndex + 1}`;
  const videoSrc = activeClip.outputUrl || activeClip.downloadUrl || "";

  return (
    <DashboardLayout headerContent={headerContent}>
      {/* ── Top Workspace Bar & Primary Actions ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border/70">
        <Link
          href={`/my-clips/${jobId}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors group"
        >
          <ChevronLeftIcon className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          <span>Back to &ldquo;{getJobDisplayTitle(job, 35)}&rdquo;</span>
        </Link>

        {/* Primary Action Buttons Bar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Schedule Post (Disabled UI Control - Coming Soon) */}
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  disabled
                  className="h-9 px-3 text-xs font-medium rounded-md border border-border/50 bg-muted/30 text-muted-foreground/60 flex items-center gap-1.5 cursor-not-allowed opacity-60 select-none"
                >
                  <CalendarIcon className="h-3.5 w-3.5" />
                  <span>Schedule Post</span>
                  <Badge variant="outline" className="text-[9px] px-1 py-0 uppercase border-border/60">
                    Coming Soon
                  </Badge>
                </button>
              }
            />
            <TooltipContent side="bottom" className="text-xs max-w-xs">
              Social post scheduling directly from Blynta is coming soon.
            </TooltipContent>
          </Tooltip>

          <AppButton
            variant="outline"
            size="sm"
            onClick={handleShare}
            icon={<Share2Icon className="h-3.5 w-3.5" />}
            className="h-9 text-xs font-medium"
          >
            Share Link
          </AppButton>

          <AppButton
            variant="default"
            size="sm"
            onClick={handleDownload}
            isLoading={isDownloading}
            icon={<DownloadIcon className="h-3.5 w-3.5" />}
            className="h-9 text-xs font-semibold shadow-xs"
          >
            Download MP4
          </AppButton>

          {job.transcript && job.transcript.length > 0 && (
            <AppButton
              variant="outline"
              size="sm"
              onClick={() => setTranscriptOpen(true)}
              icon={<FileTextIcon className="h-3.5 w-3.5" />}
              className="h-9 text-xs font-medium"
            >
              Transcript
            </AppButton>
          )}

          {/* More Actions Dropdown */}
          <AppDropdown
            trigger={
              <button
                type="button"
                className="h-9 w-9 rounded-md flex items-center justify-center border border-border/80 bg-background/50 text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors cursor-pointer"
                aria-label="More actions"
              >
                <MoreVerticalIcon className="h-4 w-4" />
              </button>
            }
            items={[
              ...(job.sourceUrl
                ? [
                  {
                    label: "Open Source Video",
                    icon: <ExternalLinkIcon className="h-3.5 w-3.5" />,
                    onClick: () => window.open(job.sourceUrl, "_blank", "noopener,noreferrer"),
                  },
                ]
                : []),
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

      {/* ── Clip Navigation Strip (Prev / Clip X of Y / Next) ── */}
      {job.clips && job.clips.length > 1 && (
        <ClipNavigationBar
          jobId={jobId}
          clips={job.clips}
          activeClipIndex={clipIndex}
        />
      )}

      {/* ── Main Workspace Grid (Video on Left, Content Publishing & Insights on Right) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Prominent Video Player & Quick Metadata */}
        <div className="lg:col-span-6 xl:col-span-6 flex flex-col items-center gap-4 w-full min-w-0">
          {/* Hero 9:16 Video Player Container */}
          <AppCard
            className={cn(
              "w-full flex items-center justify-center  border-border/80 bg-card/60 backdrop-blur-md shadow-xs",
              aspectRatio === "9:16" && "max-w-[380px] sm:max-w-[400px]",
              aspectRatio === "1:1" && "max-w-[420px]",
              aspectRatio === "16:9" && "max-w-[560px]"
            )}
            useDefaultClasses={false}
          >
            <StudioVideoPlayer
              src={videoSrc}
              poster={job.thumbnailUrl}
              autoPlay={false}
              badgeText={`${aspectRatio} Short`}
              className={cn(
                aspectRatio === "1:1" && "aspect-square max-w-full",
                aspectRatio === "16:9" && "aspect-video max-w-full"
              )}
            />
          </AppCard>

          {/* Quick Player Footer Metadata Bar */}
          <div className="w-full max-w-[420px] flex items-center justify-between p-3 rounded-md bg-card border border-border/80 text-xs text-muted-foreground shadow-xs">
            <div className="flex items-center gap-1.5 font-mono">
              <ClockIcon className="h-3.5 w-3.5 text-muted-foreground" />
              <span>
                {formatTime(activeClip.startTime)} → {formatTime(activeClip.endTime)}
              </span>
              <span className="text-muted-foreground/60">({Math.round(durationSec)}s)</span>
            </div>

            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="text-[11px] font-mono">
                {aspectRatio}
              </Badge>
              <div className="flex items-center gap-1 text-primary font-semibold text-[11px]">
                <SparklesIcon className="h-3 w-3" />
                <span>AI Auto-Framed</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Title, AI Insights, Social Content & Studio Customization */}
        <div className="lg:col-span-6 xl:col-span-6 space-y-6 w-full min-w-0">
          {/* Clip Header Banner */}
          <AppCard className="space-y-2" useDefaultClasses={false}>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold uppercase tracking-wider">
                Short #{clipIndex + 1}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Extracted from {job.sourcePlatform} video
              </span>
            </div>

            <div className="my-2">
              <h1 className="text-xl sm:text-2xl font-extrabold text-foreground leading-snug">
                {clipTitle}
              </h1>
            </div>

            {activeHighlight?.clipDescription && (
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed pt-1">
                {activeHighlight.clipDescription}
              </p>
            )}
          </AppCard>

          {/* AI Insights Section */}
          <ClipAnalysis job={job} highlight={activeHighlight} />

          {/* Social Content / Ready to Publish Section */}
          <SocialContentSection
            job={job}
            highlight={activeHighlight}
            clipTitle={clipTitle}
          />

          {/* Studio Customization & Aspect Ratio Framing */}
          <ClipEditorPanel
            aspectRatio={aspectRatio}
            onAspectRatioChange={setAspectRatio}
          />
        </div>
      </div>

      {/* Transcript Dialog */}
      {job.transcript && (
        <TranscriptDialog
          open={transcriptOpen}
          onOpenChange={setTranscriptOpen}
          transcript={job.transcript}
          jobTitle={getJobDisplayTitle(job, 40)}
          jobId={jobId}
          activeRange={{
            startTime: activeClip.startTime,
            endTime: activeClip.endTime,
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      <AppDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Generated Short"
        description={`Are you sure you want to delete "${clipTitle}"? This will permanently remove the short video from your workspace.`}
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
              Delete Short
            </AppButton>
          </>
        }
      />
    </DashboardLayout>
  );
}
