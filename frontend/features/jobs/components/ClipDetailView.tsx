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
import { AppDialog } from "@/components/common/AppDialog";
import { AlertTriangleIcon, TrashIcon } from "@/features/dashboard/icons";
import {
  TranscriptDialog,
  downloadTranscriptAsSrt,
  downloadTranscriptAsTxt,
} from "./TranscriptDialog";
import { ClipWorkspaceSkeleton } from "./JobDetailSkeleton";
import { getJobDisplayTitle } from "@/features/dashboard/utils";
import {
  AIInsights,
  ClipHeader,
  ClipInformation,
  ClipPreview,
  PublishingPackage,
  VideoWorkspaceDialog,
} from "./clip-detail";
import { ShareDialog } from "@/features/shares";
import { PublishToYouTubeDialog } from "@/features/youtube";
import { toast } from "sonner";

export interface ClipDetailViewProps {
  jobId: string;
  clipId: string;
}

/**
 * Clip review page.
 *
 * Four responsibilities only:
 *   1. what clip this is, 2. what it looks like,
 *   3. why it was generated, 4. what content can be published.
 *
 * Composed as a compact hero inside a deliberately narrow reading column,
 * followed by three tight sections. Editing lives inside the media workspace
 * (VideoWorkspaceDialog).
 */
export function ClipDetailView({ jobId, clipId }: ClipDetailViewProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: profile } = useCurrentUser();
  const { data: job, isLoading, error } = useJob(jobId);

  const [shareOpen, setShareOpen] = React.useState(false);
  const [youtubePublishOpen, setYoutubePublishOpen] = React.useState(false);
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
    let index = job.clips.findIndex(
      (c) =>
        (c._id && String(c._id) === String(clipId)) ||
        (c.id && String(c.id) === String(clipId))
    );
    if (index === -1 && /^\d+$/.test(clipId)) {
      const numericIndex = parseInt(clipId, 10);
      if (numericIndex >= 0 && numericIndex < job.clips.length) {
        index = numericIndex;
      }
    }
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

  const totalClips = job?.clips?.length ?? 1;
  const clipTitle = React.useMemo(
    () =>
      activeHighlight?.clipTitle ||
      activeHighlight?.hookText ||
      `Generated Short #${clipIndex + 1}`,
    [activeHighlight, clipIndex]
  );

  const clipDescriptionText = React.useMemo(() => {
    return (
      activeHighlight?.clipDescription ||
      activeHighlight?.reason ||
      (job?.videoTitle ? `Watch this high-retention AI extracted short clip from ${job.videoTitle}.` : "")
    );
  }, [activeHighlight, job?.videoTitle]);

  const clipKeywords = React.useMemo(() => {
    const list = new Set<string>();
    if (job?.keywords) {
      job.keywords.split(",").forEach((k) => {
        const trimmed = k.trim().replace(/^#/, "");
        if (trimmed) list.add(trimmed);
      });
    }
    activeHighlight?.tags?.forEach((t) => list.add(t.replace(/^#/, "")));
    if (list.size === 0) {
      ["shorts", "viral", "video"].forEach((k) => list.add(k));
    }
    return Array.from(list).slice(0, 30);
  }, [job?.keywords, activeHighlight?.tags]);

  const clipHashtags = React.useMemo(() => {
    const list = new Set<string>();
    job?.hashtags?.forEach((h) => {
      list.add(h.startsWith("#") ? h : `#${h}`);
    });
    activeHighlight?.tags?.forEach((t) => {
      list.add(t.startsWith("#") ? t : `#${t}`);
    });
    if (list.size === 0) {
      clipKeywords.slice(0, 10).forEach((k) => list.add(`#${k}`));
    }
    return Array.from(list).slice(0, 10);
  }, [job?.hashtags, activeHighlight?.tags, clipKeywords]);

  // Cached signed URL for active clip
  const {
    data: videoSrc,
    isLoading: videoLoading,
    isFetching: videoFetching,
    isError: videoError,
    refetch: refetchVideoSrc,
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

  const getSafeFileBase = () =>
    (clipTitle || "short").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 30);

  const handleDownloadTranscript = () => {
    if (!job?.transcript?.length) {
      toast.error("No transcript available");
      return;
    }
    downloadTranscriptAsTxt(
      job.transcript,
      `${getSafeFileBase()}-${clipId}.txt`
    );
    toast.success("Downloaded transcript (.txt)");
  };

  const handleDownloadSubtitles = () => {
    if (!job?.transcript?.length) {
      toast.error("No transcript available");
      return;
    }
    downloadTranscriptAsSrt(
      job.transcript,
      `${getSafeFileBase()}-${clipId}.srt`
    );
    toast.success("Downloaded subtitles (.srt)");
  };

  const headerContent = (
    <div className="flex-1 min-w-0 flex items-center justify-between">
      {/* Compact breadcrumbs navigation */}
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
        <div className="mx-auto my-12 max-w-lg rounded-xl border border-destructive/30 bg-card p-6 text-center">
          <AlertTriangleIcon className="mx-auto mb-3 h-10 w-10 text-destructive" />
          <h3 className="text-base font-bold text-foreground">
            This clip is no longer available
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {error?.message || "The clip you requested could not be found."}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/my-clips/${jobId}`)}
            className="mt-4 cursor-pointer"
          >
            Back to generated shorts
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const durationSec = Math.max(0, Math.round(activeClip.endTime - activeClip.startTime));
  const contextLine = [
    `Short ${clipIndex + 1} of ${Math.max(totalClips, 1)}`,
    `${durationSec}s`,
    activeClip.hasCaptions ? "Captions burned in" : "No captions",
  ].join(" \u00b7 ");

  return (
    <DashboardLayout headerContent={headerContent}>
      {/* Content spans the same width as every other workspace page, so it lines
        up with the top bar. Sections are composed, not stretched: text keeps a
        reading width and the supporting content sits in cards. */}
      <div className="w-full space-y-5 pb-14">
        {/* Context + review utilities */}
        <ClipHeader
          backHref={`/my-clips/${jobId}`}
          clipIndex={clipIndex}
          totalClips={totalClips}
          onDownload={handleDownload}
          isDownloading={isDownloading}
          onShare={() => setShareOpen(true)}
          onPublishYouTube={() => setYoutubePublishOpen(true)}
          hasTranscript={Boolean(job.transcript?.length)}
          onOpenTranscript={() => setTranscriptOpen(true)}
          sourceUrl={job.sourceUrl}
          onDelete={() => setDeleteOpen(true)}
        />

        {/* Review stage: compact hero - the clip leads, its information follows */}
        <section
          aria-label="Clip review"
          className="grid items-start gap-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-6"
        >
          <ClipPreview
            posterUrl={job.thumbnailUrl}
            clipTitle={clipTitle}
            clipIndex={clipIndex}
            startTime={activeClip.startTime}
            endTime={activeClip.endTime}
            onOpenViewer={() => setVideoPlayerOpen(true)}
            className="w-[8.5rem] shrink-0 sm:w-[10rem]"
          />
          <ClipInformation
            job={job}
            clip={activeClip}
            highlight={activeHighlight}
            clipTitle={clipTitle}
            clipIndex={clipIndex}
            totalClips={totalClips}
            sourceHref={`/my-clips/${jobId}`}
            onWatch={() => setVideoPlayerOpen(true)}
            className="max-w-3xl sm:min-h-[17.75rem]"
          />
        </section>

        {/* Why this clip was generated */}
        <AIInsights highlight={activeHighlight} />

        {/* Read-only publishing content */}
        <PublishingPackage
          job={job}
          highlight={activeHighlight}
          clipTitle={clipTitle}
        />
      </div>

      {/* Media workspace: watch now, edit later */}
      <VideoWorkspaceDialog
        open={videoPlayerOpen}
        onOpenChange={setVideoPlayerOpen}
        title={clipTitle}
        context={contextLine}
        videoSrc={videoSrc}
        videoLoading={(videoLoading || videoFetching) && !videoSrc}
        videoError={videoError}
        poster={job.thumbnailUrl}
        aspectLabel="9:16 Short"
        isDownloading={isDownloading}
        onDownload={handleDownload}
        onRetry={() => {
          void refetchVideoSrc();
        }}
        hasTranscript={Boolean(job.transcript?.length)}
        onDownloadTranscript={handleDownloadTranscript}
        onDownloadSubtitles={handleDownloadSubtitles}
      />

      {/* Transcript Dialog */}
      {job.transcript?.length > 0 && (
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
              <TrashIcon className="mr-1.5 h-3.5 w-3.5" />
              <span>{isDeleting ? "Deleting..." : "Delete Short"}</span>
            </Button>
          </>
        }
      />

      {/* Share Dialog */}
      <ShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        jobId={jobId}
        clipId={clipId}
        clipTitle={clipTitle}
      />

      {/* Publish to YouTube Dialog */}
      <PublishToYouTubeDialog
        open={youtubePublishOpen}
        onOpenChange={setYoutubePublishOpen}
        jobId={jobId}
        clipId={clipId}
        clipTitle={clipTitle}
        defaultDescription={clipDescriptionText}
        defaultTags={clipKeywords}
        defaultHashtags={clipHashtags}
      />
    </DashboardLayout>
  );
}