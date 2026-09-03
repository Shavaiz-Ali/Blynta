"use client";

import * as React from "react";
import { Clip, Job } from "@/features/jobs/types";
import { useDownloadClip } from "@/features/jobs/queries";
import { getClipId } from "./helpers";
import { StudioVideoPlayer } from "./player";
import {
  downloadTranscriptAsTxt,
  downloadTranscriptAsSrt,
} from "./TranscriptDialog";
import { getJobDisplayTitle } from "@/features/dashboard/utils";
import { AlertTriangleIcon } from "@/features/dashboard/icons";
import { toast } from "sonner";

interface StudioCenterPanelProps {
  jobId: string;
  clip: Clip;
  job?: Job;
  onDeleteClip?: () => void;
}

export function StudioCenterPanel({
  jobId,
  clip,
  job,
  onDeleteClip,
}: StudioCenterPanelProps) {
  const downloadClip = useDownloadClip();
  const clipId = getClipId(clip);

  const [previewSrc, setPreviewSrc] = React.useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = React.useState(true);
  const [previewError, setPreviewError] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;

    async function loadPreview() {
      setPreviewLoading(true);
      setPreviewError(false);
      try {
        const { signedUrl } = await downloadClip.mutateAsync({ jobId, clipId });
        if (cancelled) return;
        setPreviewSrc(signedUrl);
      } catch {
        if (!cancelled) setPreviewError(true);
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    }

    loadPreview();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clipId, jobId]);

  function handleDownloadTranscript() {
    if (!job?.transcript || job.transcript.length === 0) return;
    const title = getJobDisplayTitle(job, 30).replace(/[^a-zA-Z0-9_-]/g, "_");
    downloadTranscriptAsTxt(job.transcript, `transcript-${title}.txt`);
    toast.success("Downloaded transcript (.txt)");
  }

  function handleDownloadSubtitles() {
    if (!job?.transcript || job.transcript.length === 0) return;
    const title = getJobDisplayTitle(job, 30).replace(/[^a-zA-Z0-9_-]/g, "_");
    downloadTranscriptAsSrt(job.transcript, `subtitles-${title}.srt`);
    toast.success("Downloaded subtitles (.srt)");
  }

  return (
    <div className="flex flex-col items-center justify-center w-full min-w-0">
      {previewSrc ? (
        <StudioVideoPlayer
          src={previewSrc}
          badgeText="9:16 Shorts"
          onDownloadTranscript={handleDownloadTranscript}
          onDownloadSubtitles={handleDownloadSubtitles}
          onDeleteClip={onDeleteClip}
          hasTranscript={Boolean(job?.transcript && job.transcript.length > 0)}
        />
      ) : previewLoading ? (
        <div className="w-full max-w-[340px] sm:max-w-[360px] aspect-[9/16] rounded-2xl bg-black border border-border/80 shadow-md relative overflow-hidden flex flex-col items-center justify-center gap-3 p-6 text-center">
          <div className="h-9 w-9 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span className="text-xs text-muted-foreground animate-pulse">
            Loading clip preview…
          </span>
        </div>
      ) : previewError ? (
        <div className="w-full max-w-[340px] sm:max-w-[360px] aspect-[9/16] rounded-2xl bg-black border border-border/80 shadow-md relative overflow-hidden flex flex-col items-center justify-center gap-2 p-6 text-center">
          <AlertTriangleIcon className="h-7 w-7 text-destructive" />
          <span className="text-xs font-medium text-destructive">
            Preview unavailable
          </span>
          <p className="text-[11px] text-muted-foreground max-w-[200px]">
            The signed video stream could not be loaded. You can still download the clip.
          </p>
        </div>
      ) : (
        <div className="w-full max-w-[340px] sm:max-w-[360px] aspect-[9/16] rounded-2xl bg-muted/20 animate-pulse border border-border/70 shadow-md" />
      )}
    </div>
  );
}
