"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  useJob,
  useDeleteClip,
  useClipSignedUrl,
  useDownloadClip,
} from "@/features/jobs";
import { axiosClient } from "@/config/axiosClient";
import { useCurrentUser } from "@/features/auth/queries";
import { DashboardLayout } from "@/features/dashboard/components/DashboardLayout";
import { DashboardHeaderRight } from "@/features/dashboard/components/DashboardHeaderRight";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AppDropdown } from "@/components/common/AppDropdown";
import { AppDialog } from "@/components/common/AppDialog";
import { StudioVideoPlayer } from "./player/StudioVideoPlayer";
import { ClipAnalysis } from "./ClipAnalysis";
import { ClipEditorPanel, AspectRatioOption } from "./ClipEditorPanel";
import { SocialContentSection } from "./SocialContentSection";
import { ClipNavigationBar } from "./ClipNavigationBar";
import { TranscriptDialog } from "./TranscriptDialog";
import { ClipWorkspaceSkeleton } from "./JobDetailSkeleton";
import {
  getJobDisplayTitle,
} from "@/features/dashboard/utils";
import {
  ChevronLeftIcon,
  DownloadIcon,
  Share2Icon,
  TrashIcon,
  SparklesIcon,
  AlertTriangleIcon,
  CalendarIcon,
  FileTextIcon,
  MoreVerticalIcon,
  ExternalLinkIcon,
  PlayIcon,
} from "@/features/dashboard/icons";
import { toast } from "sonner";

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
  const queryClient = useQueryClient();
  const { data: profile } = useCurrentUser();
  const { data: job, isLoading, error } = useJob(jobId);

  const [aspectRatio, setAspectRatio] = React.useState<AspectRatioOption>("9:16");
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [transcriptOpen, setTranscriptOpen] = React.useState(false);
  const [videoPlayerOpen, setVideoPlayerOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isDownloading, setIsDownloading] = React.useState(false);

  const downloadMutation = useDownloadClip();
  const deleteMutation = useDeleteClip();

  // Find active clip & highlight
  const { activeClip, activeHighlight, clipIndex, prevClipId, nextClipId } = React.useMemo(() => {
    if (!job?.clips) {
      return {
        activeClip: undefined,
        activeHighlight: undefined,
        clipIndex: -1,
        prevClipId: null,
        nextClipId: null,
      };
    }
    const index = job.clips.findIndex(
      (c) => (c._id && c._id.toString() === clipId) || (c.id && c.id.toString() === clipId)
    );
    if (index === -1) {
      return {
        activeClip: undefined,
        activeHighlight: undefined,
        clipIndex: -1,
        prevClipId: null,
        nextClipId: null,
      };
    }

    const clip = job.clips[index];
    const highlight =
      job.highlights?.[index] ||
      job.highlights?.find(
        (h) =>
          Math.abs(h.startTime - clip.startTime) < 2 ||
          Math.abs(h.endTime - clip.endTime) < 2
      );

    const prevClip = index > 0 ? job.clips[index - 1] : null;
    const nextClip = index < job.clips.length - 1 ? job.clips[index + 1] : null;

    return {
      activeClip: clip,
      activeHighlight: highlight,
      clipIndex: index,
      prevClipId: prevClip ? prevClip._id || prevClip.id : null,
      nextClipId: nextClip ? nextClip._id || nextClip.id : null,
    };
  }, [job, clipId]);

  // Cached signed URL for active clip
  const {
    data: videoSrc,
    isLoading: videoLoading,
    isError: videoError,
  } = useClipSignedUrl(jobId, clipId, {
    enabled: Boolean(jobId && clipId && activeClip),
  });

  // Prefetch adjacent clips signed URLs in background
  React.useEffect(() => {
    if (!jobId) return;

    if (prevClipId) {
      queryClient.prefetchQuery({
        queryKey: ["clip-url", jobId, prevClipId],
        queryFn: async () => {
          const { data } = await axiosClient.get<{ signedUrl: string }>(
            `/jobs/${jobId}/clips/${prevClipId}/download`
          );
          return data.signedUrl;
        },
        staleTime: 1000 * 60 * 50,
      });
    }

    if (nextClipId) {
      queryClient.prefetchQuery({
        queryKey: ["clip-url", jobId, nextClipId],
        queryFn: async () => {
          const { data } = await axiosClient.get<{ signedUrl: string }>(
            `/jobs/${jobId}/clips/${nextClipId}/download`
          );
          return data.signedUrl;
        },
        staleTime: 1000 * 60 * 50,
      });
    }
  }, [jobId, prevClipId, nextClipId, queryClient]);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      if (videoSrc) {
        window.open(videoSrc, "_blank", "noopener,noreferrer");
        toast.success("Download started!");
        return;
      }
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
          className="hover:text-foreground transition-colors shrink-0 font-medium"
        >
          My Clips
        </Link>
        <span>/</span>
        <Link
          href={`/my-clips/${jobId}`}
          className="hover:text-foreground transition-colors truncate max-w-[140px] sm:max-w-[220px]"
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
          <div className="h-8 w-8 rounded-lg bg-muted animate-pulse" />
        </div>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <DashboardLayout headerContent={headerContent}>
        <ClipWorkspaceSkeleton />
      </DashboardLayout>
    );
  }

  if (error || !job || !activeClip) {
    return (
      <DashboardLayout headerContent={headerContent}>
        <div className="p-10 text-center max-w-lg mx-auto my-12 rounded-lg border border-destructive/30 bg-card">
          <AlertTriangleIcon className="h-10 w-10 text-destructive mx-auto mb-3" />
          <h3 className="text-base font-bold text-foreground">
            This clip is no longer available
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            {error?.message || "The clip you requested could not be found."}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/my-clips/${jobId}`)}
            className="mt-4"
          >
            Back to Generated Shorts
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const durationSec = Math.max(0, activeClip.endTime - activeClip.startTime);
  const clipTitle =
    activeHighlight?.clipTitle ||
    activeHighlight?.hookText ||
    `Generated Short #${clipIndex + 1}`;

  return (
    <DashboardLayout headerContent={headerContent}>
      <div className="space-y-3.5 sm:space-y-4 pb-10">
        {/* ── 1. CLIP HEADER & ACTIONS ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/80">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href={`/my-clips/${jobId}`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors group shrink-0"
            >
              <ChevronLeftIcon className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
              <span className="truncate max-w-[200px] sm:max-w-[320px]">
                {getJobDisplayTitle(job, 35)}
              </span>
            </Link>

            {job.clips && job.clips.length > 1 && (
              <>
                <Separator orientation="vertical" className="h-4 bg-border/80" />
                <Badge variant="secondary" className="text-xs font-medium px-2 py-0.5 rounded-md">
                  Short {clipIndex + 1} of {job.clips.length}
                </Badge>
              </>
            )}
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Schedule Post (Disabled / Coming Soon) */}
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="outline"
                    size="sm"
                    disabled
                    className="h-8 px-2.5 text-xs font-medium border-border/50 text-muted-foreground/50 hidden md:flex items-center gap-1.5 cursor-not-allowed opacity-60"
                  >
                    <CalendarIcon className="h-3.5 w-3.5" />
                    <span>Schedule</span>
                    <Badge variant="outline" className="text-[9px] px-1 py-0 uppercase border-border/60">
                      Soon
                    </Badge>
                  </Button>
                }
              />
              <TooltipContent side="bottom" className="text-xs max-w-xs">
                Social post scheduling is currently on the product roadmap and will be available in a future release.
              </TooltipContent>
            </Tooltip>

            <Button
              variant="outline"
              size="sm"
              onClick={handleShare}
              className="h-8 text-xs font-semibold cursor-pointer border-border hover:bg-muted"
            >
              <Share2Icon className="h-3.5 w-3.5 mr-1.5" />
              <span>Share Link</span>
            </Button>

            <Button
              variant="default"
              size="sm"
              onClick={handleDownload}
              disabled={isDownloading}
              className="h-8 text-xs font-semibold shadow-xs cursor-pointer"
            >
              <DownloadIcon className="h-3.5 w-3.5 mr-1.5" />
              <span>{isDownloading ? "Preparing..." : "Download MP4"}</span>
            </Button>

            {job.transcript && job.transcript.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTranscriptOpen(true)}
                className="h-8 text-xs font-semibold cursor-pointer border-border hover:bg-muted"
              >
                <FileTextIcon className="h-3.5 w-3.5 mr-1.5" />
                <span>Transcript</span>
              </Button>
            )}

            {/* More Actions Dropdown */}
            <AppDropdown
              trigger={
                <button
                  type="button"
                  className="h-8 w-8 rounded-md flex items-center justify-center border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
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

        {/* ── 2. CLIP OVERVIEW (COMPACT PREVIEW + CLIP IDENTITY) ── */}
        <div className="p-4 sm:p-5 rounded-lg bg-card/60 border border-border/80 shadow-2xs">
          <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
            {/* Compact Video Preview Entry Point */}
            <div
              onClick={() => setVideoPlayerOpen(true)}
              className="relative aspect-[9/16] w-24 sm:w-28 md:w-32 shrink-0 rounded-lg overflow-hidden bg-black border border-border/80 group cursor-pointer shadow-xs select-none transition-transform duration-200 hover:scale-[1.02]"
              title="Click to watch full short"
            >
              {/* Thumbnail / Poster */}
              {job.thumbnailUrl ? (
                <img
                  src={job.thumbnailUrl}
                  alt={clipTitle}
                  className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-muted/20 text-muted-foreground p-2 text-center">
                  <PlayIcon className="h-6 w-6 text-primary/70 mb-1" />
                  <span className="text-[9px]">Short #{clipIndex + 1}</span>
                </div>
              )}

              {/* Dark Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/35 group-hover:from-black/75 transition-colors" />

              {/* Top Aspect Ratio Tag */}
              <div className="absolute top-1.5 left-1.5 z-10">
                <Badge
                  variant="secondary"
                  className="bg-black/70 text-foreground border-white/10 text-[9px] font-mono px-1 py-0 backdrop-blur-xs leading-tight"
                >
                  9:16
                </Badge>
              </div>

              {/* Centered Play Button Overlay */}
              <div className="absolute inset-0 z-10 flex items-center justify-center">
                <div className="h-8 w-8 rounded-full bg-primary/95 text-primary-foreground flex items-center justify-center shadow-md transition-transform duration-300 group-hover:scale-110 group-hover:bg-primary pl-0.5">
                  <PlayIcon className="h-3.5 w-3.5 fill-current" />
                </div>
              </div>

              {/* Bottom Metadata & Prompt */}
              <div className="absolute bottom-0 inset-x-0 p-1.5 z-10 flex flex-col gap-0.5 text-[10px] text-white/90">
                <div className="flex items-center justify-between font-mono text-[9px]">
                  <span>{formatTime(activeClip.startTime)}</span>
                  <span className="font-semibold text-primary-foreground bg-black/50 px-1 rounded text-[8px]">
                    {Math.round(durationSec)}s
                  </span>
                </div>
              </div>
            </div>

            {/* Clip Information */}
            <div className="flex-1 min-w-0 space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
                    AI Generated Short
                  </span>
                  <span className="text-muted-foreground/40">•</span>
                  <span className="text-xs text-muted-foreground font-medium">
                    Short #{clipIndex + 1} of {job.clips.length}
                  </span>
                </div>

                <h1 className="text-xl sm:text-2xl font-bold text-foreground leading-snug tracking-tight">
                  {clipTitle}
                </h1>

                {activeHighlight?.clipDescription && (
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-prose">
                    {activeHighlight.clipDescription}
                  </p>
                )}
              </div>

              {/* Metadata Badges & Watch CTA */}
              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                <Badge variant="outline" className="text-xs font-normal rounded-md border-border/80">
                  Source: {job.sourcePlatform}
                </Badge>
                <Badge variant="outline" className="text-xs font-normal rounded-md border-border/80">
                  Duration: {Math.round(durationSec)}s
                </Badge>
                <Badge variant="outline" className="text-xs font-normal rounded-md border-border/80">
                  Status: Ready to publish
                </Badge>
                <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 text-xs font-semibold rounded-md">
                  <SparklesIcon className="h-3 w-3 mr-1" />
                  AI Framed
                </Badge>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setVideoPlayerOpen(true)}
                  className="h-7 text-xs font-semibold gap-1.5 cursor-pointer border-primary/40 text-primary hover:bg-primary/10 ml-auto hidden sm:flex"
                >
                  <PlayIcon className="h-3 w-3 fill-current" />
                  <span>Watch Short</span>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* ── 3. AI INSIGHTS & VIRALITY ANALYSIS ── */}
        <div className="p-4 sm:p-5 rounded-lg bg-card/60 border border-border/80 shadow-2xs">
          <ClipAnalysis job={job} highlight={activeHighlight} />
        </div>

        {/* ── 4. GENERATED SHORTS NAVIGATION ── */}
        {job.clips && job.clips.length > 1 && (
          <ClipNavigationBar
            jobId={jobId}
            clips={job.clips}
            activeClipIndex={clipIndex}
            variant="rail"
          />
        )}

        {/* ── 5. SECONDARY PRODUCTION WORKSPACE ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-4 items-stretch">
          {/* Left: Publishing Package */}
          <div className="lg:col-span-7 w-full min-w-0">
            <SocialContentSection
              job={job}
              highlight={activeHighlight}
              clipTitle={clipTitle}
            />
          </div>

          {/* Right: Studio & Framing Settings */}
          <div className="lg:col-span-5 w-full min-w-0">
            <ClipEditorPanel
              aspectRatio={aspectRatio}
              onAspectRatioChange={setAspectRatio}
            />
          </div>
        </div>
      </div>

      {/* ── FULL 9:16 VIDEO PLAYER DIALOG ── */}
      <Dialog open={videoPlayerOpen} onOpenChange={setVideoPlayerOpen}>
        <DialogContent
          className="sm:max-w-[440px] p-0 bg-black border-border/80 overflow-hidden text-foreground rounded-xl"
          showCloseButton={true}
        >
          <DialogHeader className="p-4 pb-2 bg-neutral-950 border-b border-border/50">
            <DialogTitle className="text-sm font-bold text-foreground truncate pr-6">
              {clipTitle}
            </DialogTitle>
          </DialogHeader>

          <div className="p-3 flex flex-col items-center justify-center bg-black">
            {videoLoading && (
              <div className="aspect-[9/16] w-full rounded-lg bg-black border border-border flex flex-col items-center justify-center gap-3 text-muted-foreground">
                <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                <p className="text-xs font-medium text-muted-foreground">Loading video...</p>
              </div>
            )}
            {videoError && !videoLoading && (
              <div className="aspect-[9/16] w-full rounded-lg bg-black border border-destructive/40 flex flex-col items-center justify-center gap-3 text-muted-foreground p-4 text-center">
                <AlertTriangleIcon className="h-8 w-8 text-destructive" />
                <p className="text-xs font-medium text-foreground">Could not load video stream</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownload}
                  className="h-7 text-xs mt-1"
                >
                  <DownloadIcon className="h-3 w-3 mr-1" />
                  <span>Download MP4</span>
                </Button>
              </div>
            )}
            {videoSrc && !videoLoading && (
              <StudioVideoPlayer
                src={videoSrc}
                poster={job.thumbnailUrl}
                autoPlay={true}
                badgeText={`${aspectRatio} Short`}
                className="rounded-lg shadow-lg w-full"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

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
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteOpen(false)}
              disabled={isDeleting}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="cursor-pointer"
            >
              <TrashIcon className="h-3.5 w-3.5 mr-1.5" />
              <span>{isDeleting ? "Deleting..." : "Delete Short"}</span>
            </Button>
          </>
        }
      />
    </DashboardLayout>
  );
}

