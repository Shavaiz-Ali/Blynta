"use client";

import * as React from "react";
import { StudioVideoPlayerProps } from "./types";
import { PlayerTopBar } from "./PlayerTopBar";
import { PlayerOverlay } from "./PlayerOverlay";
import { PlayerScrubber } from "./PlayerScrubber";
import { PlayerControls } from "./PlayerControls";
import { useVideoPlayback } from "./useVideoPlayback";
import { AppButton } from "../components/AppButton";
import { cn } from "../lib/utils";

export function StudioVideoPlayer({
  src,
  onError,
  ariaLabel = "Video preview",
  poster,
  autoPlay = false,
  className,
  badgeText = "9:16 Shorts",
  dockedControls = false,
  fillWorkspace = false,
  showTopBar = true,
  onDownloadTranscript,
  onDownloadSubtitles,
  onDeleteClip,
  hasTranscript = true,
}: StudioVideoPlayerProps) {
  const [loading, setLoading] = React.useState(true);
  const [failed, setFailed] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const controlsRef = React.useRef<HTMLDivElement>(null);
  const [ratio, setRatio] = React.useState(9 / 16);
  const [fittedWidth, setFittedWidth] = React.useState<number>();
  const player = useVideoPlayback({ containerRef, videoRef });
  React.useEffect(() => {
    if (!dockedControls || fillWorkspace || player.isFullscreen) return;
    const parent = containerRef.current?.parentElement;
    if (!parent) return;
    const fit = () => {
      const style = getComputedStyle(parent);
      const width =
        parent.clientWidth -
        parseFloat(style.paddingLeft) -
        parseFloat(style.paddingRight);
      const height =
        parent.clientHeight -
        parseFloat(style.paddingTop) -
        parseFloat(style.paddingBottom);
      const controls = controlsRef.current?.offsetHeight || 80;
      setFittedWidth(
        Math.max(0, Math.min(width, Math.max(0, height - controls) * ratio)),
      );
    };
    const observer = new ResizeObserver(fit);
    observer.observe(parent);
    if (controlsRef.current) observer.observe(controlsRef.current);
    fit();
    return () => observer.disconnect();
  }, [dockedControls, fillWorkspace, ratio, player.isFullscreen]);

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      role="region"
      aria-label={ariaLabel}
      data-controls-layout={dockedControls ? "docked" : "overlay"}
      style={
        dockedControls && !fillWorkspace && !player.isFullscreen
          ? { width: fittedWidth }
          : undefined
      }
      onMouseMove={player.handleStageMouseMove}
      onMouseEnter={player.handleStageMouseEnter}
      onMouseLeave={player.handleStageMouseLeave}
      className={cn(
        "relative select-none aspect-[9/16] w-full rounded-lg bg-black border border-border shadow-md overflow-hidden group flex items-center justify-center",
        player.isFullscreen &&
          "max-w-none w-full h-full rounded-none border-none aspect-auto",
        className,
        dockedControls &&
          "flex-col aspect-auto h-auto w-full bg-transparent border-border shadow-none",
        dockedControls && player.isFullscreen && "h-full w-full",
        dockedControls &&
          fillWorkspace &&
          "h-full w-full rounded-none border-0",
      )}
    >
      <div
        className={
          dockedControls ? "relative w-full min-h-0 bg-black" : "contents"
        }
        style={
          dockedControls
            ? {
                aspectRatio:
                  player.isFullscreen || fillWorkspace ? undefined : ratio,
                flex: player.isFullscreen || fillWorkspace ? 1 : undefined,
              }
            : undefined
        }
      >
        <video
          ref={videoRef}
          src={src}
          onLoadStart={() => {
            setLoading(true);
            setFailed(false);
          }}
          onLoadedData={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setFailed(true);
            onError?.();
          }}
          poster={poster}
          autoPlay={autoPlay}
          loop={player.isLooping}
          playsInline
          preload="metadata"
          onClick={player.togglePlay}
          {...player.videoProps}
          onLoadedMetadata={(event) => {
            player.videoProps.onLoadedMetadata();
            const video = event.currentTarget;
            if (video.videoWidth && video.videoHeight)
              setRatio(video.videoWidth / video.videoHeight);
          }}
          className={cn(
            "w-full h-full object-contain cursor-pointer transition-transform duration-300",
            player.isFullscreen ? "max-h-screen" : "h-full",
          )}
        />

        {/* Buffering & Center Ripple / Play Overlay */}
        {failed ? (
          <div
            role="alert"
            className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-black/80 p-4 text-center text-sm text-white"
          >
            <p>Video couldn’t be played.</p>
            <AppButton
              variant="secondary"
              size="sm"
              onClick={() => {
                setFailed(false);
                setLoading(true);
                videoRef.current?.load();
              }}
            >
              Retry playback
            </AppButton>
          </div>
        ) : (
          <PlayerOverlay
            isBuffering={player.isBuffering || loading}
            centerAnimation={player.centerAnimation}
            isPlaying={player.isPlaying}
            onTogglePlay={player.togglePlay}
          />
        )}

        {/* Top Bar with Badge, Loop indicator, and Top-Right Dropdown Menu */}
        {showTopBar && (
          <PlayerTopBar
            badgeText={badgeText}
            isLooping={player.isLooping}
            showControls={player.showControls}
            isPlaying={player.isPlaying}
            onDownloadTranscript={onDownloadTranscript}
            onDownloadSubtitles={onDownloadSubtitles}
            onDeleteClip={onDeleteClip}
            hasTranscript={hasTranscript}
          />
        )}
      </div>

      {/* Bottom Floating Controls Bar */}
      <div
        ref={controlsRef}
        className={cn(
          "absolute bottom-0 inset-x-0 pt-10 pb-3 px-3.5 bg-gradient-to-t from-black/95 via-black/70 to-transparent z-20 flex flex-col gap-2 transition-all duration-300 pointer-events-auto",
          player.showControls || !player.isPlaying
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-2 pointer-events-none",
          dockedControls &&
            "static shrink-0 w-full min-h-20 border-t border-border bg-card bg-none p-3 text-foreground opacity-100 translate-y-0 pointer-events-auto",
        )}
      >
        <PlayerScrubber
          appearance={dockedControls ? "surface" : "overlay"}
          duration={player.duration}
          currentTime={player.currentTime}
          bufferedEnd={player.bufferedEnd}
          onSeek={player.seekTo}
          onScrubbingChange={player.setIsScrubbing}
        />

        <PlayerControls
          appearance={dockedControls ? "surface" : "overlay"}
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
    </div>
  );
}
