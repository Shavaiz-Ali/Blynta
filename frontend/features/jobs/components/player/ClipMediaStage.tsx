"use client";

import * as React from "react";
import { ClipMediaStageProps } from "./types";
import { PlayerTopBar } from "./PlayerTopBar";
import { PlayerOverlay } from "./PlayerOverlay";
import { PlayerScrubber } from "./PlayerScrubber";
import { PlayerControls } from "./PlayerControls";
import { useVideoPlayback } from "./useVideoPlayback";
import { Button } from "@/components/ui/button";
import {
  AlertTriangleIcon,
  DownloadIcon,
  RefreshCwIcon,
} from "@/features/dashboard/icons";
import { cn } from "@/lib/utils";

/**
 * Height of the media area, exposed as a CSS variable so the video box can be
 * sized with an explicit calc instead of fragile percentage chains: the stage
 * is never taller than 58% of the viewport and never taller than 30rem, which
 * keeps the whole dialog on screen without any internal scrolling.
 */
export const MEDIA_STAGE_STYLE = {
  "--media-stage-h": "min(58dvh, 30rem)",
  height: "var(--media-stage-h)",
} as React.CSSProperties;

/** Space reserved under the video for the docked playback bar + padding. */
const VIDEO_BOX_HEIGHT_CLASS = "h-[calc(var(--media-stage-h)-6.5rem)]";

/**
 * Desktop media stage used by the clip workspace dialog.
 *
 * The video keeps its 9:16 ratio, is letterboxed inside a black stage and is
 * capped by the stage height instead of being stretched. Playback controls are
 * docked under the media area so they span the full dialog width, which keeps
 * them readable even when the video itself is narrow.
 */
export function ClipMediaStage({
  src,
  poster,
  autoPlay = true,
  className,
  badgeText = "9:16",
  onDownloadTranscript,
  onDownloadSubtitles,
  onDeleteClip,
  hasTranscript,
  onRetry,
  onDownload,
  isDownloading,
}: ClipMediaStageProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const player = useVideoPlayback(
    { containerRef, videoRef },
    { pinnedControls: true, autoPlay }
  );
  const { isFullscreen } = player;

  // The <video> element fails silently (black stage) when the source returns
  // an error page or an expired link, so track it and offer a recovery path.
  // The dialog remounts this stage with a fresh key whenever the source
  // changes, which clears the failure state.
  const [sourceFailed, setSourceFailed] = React.useState(false);

  return (
    <div
      ref={containerRef}
      onMouseMove={player.handleStageMouseMove}
      onMouseEnter={player.handleStageMouseEnter}
      onMouseLeave={player.handleStageMouseLeave}
      style={
        isFullscreen
          ? ({
              "--media-stage-h": "100dvh",
              height: "var(--media-stage-h)",
            } as React.CSSProperties)
          : MEDIA_STAGE_STYLE
      }
      className={cn("relative w-full overflow-hidden bg-black", className)}
    >
      <div className="flex h-full w-full flex-col">
        {sourceFailed ? (
          /* Recovery state: the stream exists but the element could not load it */
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full text-white/70 ring-1 ring-white/15">
              <AlertTriangleIcon className="h-5 w-5" />
            </span>
            <div className="space-y-1">
              <p className="text-sm font-medium text-white">
                This short could not be played
              </p>
              <p className="text-xs leading-relaxed text-white/60">
                The video stream could not be loaded. Retry for a fresh link, or
                download the MP4 instead.
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
              {onDownload && (
                <Button
                  size="sm"
                  onClick={onDownload}
                  disabled={isDownloading}
                  className="cursor-pointer gap-1.5"
                >
                  <DownloadIcon className="h-3.5 w-3.5" />
                  Download MP4
                </Button>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Media area: the video is centred and height-constrained, never stretched */}
            <div className="flex min-h-0 flex-1 items-center justify-center p-3 sm:p-4">
              <div
                className={cn(
                  "relative aspect-[9/16] max-h-full overflow-hidden rounded-lg bg-black ring-1 ring-white/10",
                  VIDEO_BOX_HEIGHT_CLASS
                )}
              >
                <video
                  ref={videoRef}
                  src={src}
                  poster={poster}
                  autoPlay={autoPlay}
                  loop={player.isLooping}
                  playsInline
                  preload="auto"
                  onClick={player.togglePlay}
                  onError={() => setSourceFailed(true)}
                  {...player.videoProps}
                  className="h-full w-full cursor-pointer object-contain"
                />

                <PlayerOverlay
                  isBuffering={player.isBuffering}
                  centerAnimation={player.centerAnimation}
                  isPlaying={player.isPlaying}
                  onTogglePlay={player.togglePlay}
                />
              </div>
            </div>

            {/* Docked playback bar: full-width timeline and transport controls */}
            <div className="shrink-0 space-y-2 border-t border-white/10 bg-black px-4 pb-2.5 pt-2 sm:px-5">
              <PlayerScrubber
                duration={player.duration}
                currentTime={player.currentTime}
                bufferedEnd={player.bufferedEnd}
                onSeek={player.seekTo}
                onScrubbingChange={player.setIsScrubbing}
              />

              <PlayerControls
                isPlaying={player.isPlaying}
                onTogglePlay={player.togglePlay}
                isMuted={player.isMuted}
                volume={player.volume}
                onToggleMute={player.toggleMute}
                onVolumeChange={player.handleVolumeChange}
                currentTime={player.currentTime}
                duration={player.duration}
                playbackRate={player.playbackRate}
                onCyclePlaybackRate={player.cyclePlaybackRate}
                isLooping={player.isLooping}
                onToggleLoop={player.toggleLoop}
                isFullscreen={player.isFullscreen}
                onToggleFullscreen={player.toggleFullscreen}
              />
            </div>
          </>
        )}
      </div>

      {/* Stage badge + export menu, pinned inside the media area */}
      <PlayerTopBar
        badgeText={badgeText}
        isLooping={player.isLooping}
        showControls={player.showControls || !player.isPlaying}
        isPlaying={player.isPlaying}
        onDownloadTranscript={onDownloadTranscript}
        onDownloadSubtitles={onDownloadSubtitles}
        onDeleteClip={onDeleteClip}
        hasTranscript={hasTranscript}
      />
    </div>
  );
}