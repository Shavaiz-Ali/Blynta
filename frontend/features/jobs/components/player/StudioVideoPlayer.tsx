"use client";

import * as React from "react";
import { StudioVideoPlayerProps } from "./types";
import { PlayerTopBar } from "./PlayerTopBar";
import { PlayerOverlay } from "./PlayerOverlay";
import { PlayerScrubber } from "./PlayerScrubber";
import { PlayerControls } from "./PlayerControls";
import { useVideoPlayback } from "./useVideoPlayback";
import { cn } from "@/lib/utils";

export function StudioVideoPlayer({
  src,
  poster,
  autoPlay = false,
  className,
  badgeText = "9:16 Shorts",
  onDownloadTranscript,
  onDownloadSubtitles,
  onDeleteClip,
  hasTranscript = true,
}: StudioVideoPlayerProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const player = useVideoPlayback({ containerRef, videoRef });

  return (
    <div
      ref={containerRef}
      onMouseMove={player.handleStageMouseMove}
      onMouseEnter={player.handleStageMouseEnter}
      onMouseLeave={player.handleStageMouseLeave}
      className={cn(
        "relative select-none aspect-[9/16] w-full rounded-lg bg-black border border-border shadow-md overflow-hidden group flex items-center justify-center",
        player.isFullscreen && "max-w-none w-full h-full rounded-none border-none aspect-auto",
        className
      )}
    >
      {/* HTML5 Video Element */}
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        autoPlay={autoPlay}
        loop={player.isLooping}
        playsInline
        preload="metadata"
        onClick={player.togglePlay}
        {...player.videoProps}
        className={cn(
          "w-full h-full object-contain cursor-pointer transition-transform duration-300",
          player.isFullscreen ? "max-h-screen" : "h-full"
        )}
      />

      {/* Buffering & Center Ripple / Play Overlay */}
      <PlayerOverlay
        isBuffering={player.isBuffering}
        centerAnimation={player.centerAnimation}
        isPlaying={player.isPlaying}
        onTogglePlay={player.togglePlay}
      />

      {/* Top Bar with Badge, Loop indicator, and Top-Right Dropdown Menu */}
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

      {/* Bottom Floating Controls Bar */}
      <div
        className={cn(
          "absolute bottom-0 inset-x-0 pt-10 pb-3 px-3.5 bg-gradient-to-t from-black/95 via-black/70 to-transparent z-20 flex flex-col gap-2 transition-all duration-300 pointer-events-auto",
          player.showControls || !player.isPlaying
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-2 pointer-events-none"
        )}
      >
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
    </div>
  );
}