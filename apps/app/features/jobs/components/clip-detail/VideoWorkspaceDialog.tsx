"use client";

import { XIcon } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangleIcon,
  DownloadIcon,
  RefreshCwIcon,
} from "@/features/dashboard/icons";
import { cn } from "@/lib/utils";
import { ClipMediaStage, MEDIA_STAGE_STYLE } from "../player";

export interface VideoWorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Clip title - the dominant label of the workspace. */
  title: string;
  /** Secondary context, e.g. "Short 1 of 6 / 50s". */
  context?: string;
  videoSrc?: string;
  videoLoading: boolean;
  videoError: boolean;
  poster?: string;
  /** Ratio badge shown in the header and on the media stage, e.g. "9:16 Short". */
  aspectLabel?: string;
  isDownloading: boolean;
  onDownload: () => void;
  /** Re-attempts loading the streamed source. */
  onRetry?: () => void;
  hasTranscript?: boolean;
  onDownloadTranscript?: () => void;
  onDownloadSubtitles?: () => void;
}

/**
 * Media workspace for a generated short.
 *
 * A desktop-sized viewer, not a mobile panel: wide header, a black media stage
 * whose height is capped by the viewport, docked playback controls and a
 * secondary rail reserved for future editing tools. The dialog never scrolls
 * during playback - the stage is sized to always fit.
 */
export function VideoWorkspaceDialog({
  open,
  onOpenChange,
  title,
  context,
  videoSrc,
  videoLoading,
  videoError,
  poster,
  aspectLabel = "9:16 Short",
  isDownloading,
  onDownload,
  onRetry,
  hasTranscript,
  onDownloadTranscript,
  onDownloadSubtitles,
}: VideoWorkspaceDialogProps) {
  const unavailable = !videoLoading && (videoError || !videoSrc);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "flex max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden rounded-2xl border border-primary/15 bg-popover p-0 text-sm shadow-2xl shadow-black/40 ring-1 ring-foreground/10",
          "max-w-[calc(100vw-1rem)] sm:max-w-[min(52rem,calc(100vw-3rem))]",
        )}
      >
        {/* Header: clip identity, export, close */}
        <header className="flex items-start justify-between gap-3 border-b border-border/70 bg-card/80 px-4 py-3.5 sm:px-5">
          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate text-base font-semibold tracking-tight text-foreground">
              {title}
            </DialogTitle>
            <DialogDescription className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <Badge
                variant="outline"
                className="h-4.5 px-1.5 text-[10px] font-medium tabular-nums"
              >
                {aspectLabel}
              </Badge>
              {context && <span className="truncate">{context}</span>}
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Ready to preview
              </span>
            </DialogDescription>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={onDownload}
              disabled={isDownloading}
              className="hidden cursor-pointer gap-1.5 sm:inline-flex"
            >
              <DownloadIcon className="h-3.5 w-3.5" />
              <span>{isDownloading ? "Preparing..." : "Download"}</span>
            </Button>

            <DialogClose
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Close media workspace"
                  className="cursor-pointer text-muted-foreground hover:text-foreground"
                />
              }
            >
              <XIcon className="h-4 w-4" />
            </DialogClose>
          </div>
        </header>

        {/* Media stage: fixed height so the dialog never needs a scrollbar */}
        <div className="bg-black">
          {videoLoading ? (
            <div
              role="status"
              aria-label="Preparing video"
              style={MEDIA_STAGE_STYLE}
              className="flex flex-col items-center justify-center gap-3"
            >
              <Skeleton className="h-10 w-10 rounded-full bg-white/10" />
              <p className="text-xs text-white/60">Preparing your short...</p>
            </div>
          ) : unavailable ? (
            <div
              role="alert"
              style={MEDIA_STAGE_STYLE}
              className="flex flex-col items-center justify-center gap-3 px-6 text-center"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full text-white/70 ring-1 ring-white/15">
                <AlertTriangleIcon className="h-5 w-5" />
              </span>
              <div className="space-y-1">
                <p className="text-sm font-medium text-white">
                  {videoError
                    ? "This short could not be loaded"
                    : "Preview is not ready yet"}
                </p>
                <p className="text-xs leading-relaxed text-white/60">
                  You can still download the MP4 and publish it.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {onRetry && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onRetry}
                    className="cursor-pointer gap-1.5"
                  >
                    <RefreshCwIcon className="h-3.5 w-3.5" />
                    Retry
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={onDownload}
                  disabled={isDownloading}
                  className="cursor-pointer gap-1.5"
                >
                  <DownloadIcon className="h-3.5 w-3.5" />
                  Download MP4
                </Button>
              </div>
            </div>
          ) : videoSrc ? (
            <ClipMediaStage
              key={videoSrc}
              src={videoSrc}
              poster={poster}
              autoPlay
              badgeText={aspectLabel}
              hasTranscript={hasTranscript}
              onDownloadTranscript={onDownloadTranscript}
              onDownloadSubtitles={onDownloadSubtitles}
              onRetry={onRetry}
              onDownload={onDownload}
              isDownloading={isDownloading}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
