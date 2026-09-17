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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertTriangleIcon,
  DownloadIcon,
  LockIcon,
  PaletteIcon,
  PlayIcon,
  RefreshCwIcon,
  ScissorsIcon,
  SlidersIcon,
  TypeIcon,
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
 * Editing tools that will live in this workspace. Declared once so the rail
 * already reflects the final architecture - playback today, editing next.
 * They stay disabled until the tools exist: nothing here pretends to work.
 */
const EDITOR_TOOLS = [
  { value: "trim", label: "Trim", icon: <ScissorsIcon className="h-3 w-3" /> },
  { value: "captions", label: "Captions", icon: <TypeIcon className="h-3 w-3" /> },
  { value: "framing", label: "Framing", icon: <SlidersIcon className="h-3 w-3" /> },
  { value: "branding", label: "Branding", icon: <PaletteIcon className="h-3 w-3" /> },
];

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
  const unavailable = videoError || !videoSrc;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "flex max-h-[calc(100dvh-1.5rem)] w-[calc(100vw-1.5rem)] flex-col gap-0 overflow-hidden rounded-xl border border-border/80 bg-popover p-0 text-sm ring-1 ring-foreground/10",
          "max-w-[calc(100vw-1.5rem)] sm:max-w-[min(56rem,calc(100vw-3rem))]"
        )}
      >
        {/* Header: clip identity, export, close */}
        <header className="flex items-start justify-between gap-3 border-b border-border/70 px-4 py-3 sm:px-5">
          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate text-sm font-semibold tracking-tight text-foreground">
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
            </DialogDescription>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={onDownload}
              disabled={isDownloading}
              className="cursor-pointer gap-1.5"
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
                  {videoError ? "This short could not be loaded" : "Preview is not ready yet"}
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

        {/* Editor rail: playback is live, editing tools plug in here later */}
        <div className="flex items-center justify-between gap-3 border-t border-border/70 px-4 py-2 sm:px-5">
          <Tabs value="preview" className="w-auto">
            <TabsList variant="line" size="xs" className="gap-3 border-b-0">
              <TabsTrigger value="preview" size="xs" className="cursor-default">
                <PlayIcon className="h-3 w-3 fill-current" />
                <span>Preview</span>
              </TabsTrigger>
              {EDITOR_TOOLS.map((tool) => (
                <TabsTrigger
                  key={tool.value}
                  value={tool.value}
                  size="xs"
                  disabled
                  aria-label={`${tool.label} - not available yet`}
                >
                  {tool.icon}
                  <span>{tool.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <p className="hidden items-center gap-1.5 text-[11px] text-muted-foreground sm:flex">
            <LockIcon className="h-3 w-3" />
            Editing tools are not available yet
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
