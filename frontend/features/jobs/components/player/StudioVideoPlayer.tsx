"use client";

import * as React from "react";
import { StudioVideoPlayerProps } from "./types";
import { PlayerTopBar } from "./PlayerTopBar";
import { PlayerOverlay } from "./PlayerOverlay";
import { PlayerScrubber } from "./PlayerScrubber";
import { PlayerControls } from "./PlayerControls";
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

  // Player state
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [bufferedEnd, setBufferedEnd] = React.useState(0);
  const [volume, setVolume] = React.useState(1);
  const [isMuted, setIsMuted] = React.useState(false);
  const [playbackRate, setPlaybackRate] = React.useState(1);
  const [isLooping, setIsLooping] = React.useState(true);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [isBuffering, setIsBuffering] = React.useState(false);
  const [showControls, setShowControls] = React.useState(true);
  const [isScrubbing, setIsScrubbing] = React.useState(false);
  const [centerAnimation, setCenterAnimation] = React.useState<"play" | "pause" | null>(null);

  const controlsTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Auto-hide controls timer
  const resetControlsTimeout = React.useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        if (!isScrubbing) setShowControls(false);
      }, 2500);
    }
  }, [isPlaying, isScrubbing]);

  const handleMouseMove = React.useCallback(() => {
    resetControlsTimeout();
  }, [resetControlsTimeout]);

  // Video event handlers
  const handlePlay = () => setIsPlaying(true);
  const handlePause = () => {
    setIsPlaying(false);
    setShowControls(true);
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current || isScrubbing) return;
    setCurrentTime(videoRef.current.currentTime);

    const video = videoRef.current;
    if (video.buffered.length > 0) {
      setBufferedEnd(video.buffered.end(video.buffered.length - 1));
    }
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration || 0);
  };

  const handleWaiting = () => setIsBuffering(true);
  const handlePlaying = () => {
    setIsBuffering(false);
    setIsPlaying(true);
  };

  // Play / Pause Toggle
  const togglePlay = React.useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused || video.ended) {
      video.play().catch(() => {});
      setCenterAnimation("play");
    } else {
      video.pause();
      setCenterAnimation("pause");
    }
    setTimeout(() => setCenterAnimation(null), 550);
  }, []);

  // Mute toggle
  const toggleMute = React.useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const nextMuted = !isMuted;
    video.muted = nextMuted;
    setIsMuted(nextMuted);
    if (!nextMuted && volume === 0) {
      video.volume = 0.8;
      setVolume(0.8);
    }
  }, [isMuted, volume]);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    const video = videoRef.current;
    if (!video) return;
    video.volume = val;
    setVolume(val);
    if (val === 0) {
      video.muted = true;
      setIsMuted(true);
    } else if (isMuted) {
      video.muted = false;
      setIsMuted(false);
    }
  };

  const rates = [1, 1.25, 1.5, 2];
  const cyclePlaybackRate = () => {
    const video = videoRef.current;
    if (!video) return;
    const curIdx = rates.indexOf(playbackRate);
    const nextRate = rates[(curIdx + 1) % rates.length];
    video.playbackRate = nextRate;
    setPlaybackRate(nextRate);
  };

  const toggleLoop = () => {
    const video = videoRef.current;
    if (!video) return;
    video.loop = !isLooping;
    setIsLooping(!isLooping);
  };

  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  React.useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const seekTo = React.useCallback(
    (time: number) => {
      const video = videoRef.current;
      if (!video) return;
      const clamped = Math.max(0, Math.min(time, duration));
      video.currentTime = clamped;
      setCurrentTime(clamped);
    },
    [duration]
  );

  // Keyboard navigation
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea") return;

      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        seekTo(currentTime - 5);
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        seekTo(currentTime + 5);
      } else if (e.code === "KeyM") {
        e.preventDefault();
        toggleMute();
      } else if (e.code === "KeyF") {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.code === "KeyL") {
        e.preventDefault();
        toggleLoop();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [togglePlay, seekTo, currentTime, toggleMute, isLooping]);

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => {
        if (isPlaying && !isScrubbing) setShowControls(false);
      }}
      className={cn(
        "relative select-none aspect-[9/16] w-full max-w-[340px] sm:max-w-[360px] rounded-2xl bg-black border border-border/80 shadow-lg overflow-hidden group flex items-center justify-center",
        isFullscreen && "max-w-none w-full h-full rounded-none border-none aspect-auto",
        className
      )}
    >
      {/* HTML5 Video Element */}
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        autoPlay={autoPlay}
        loop={isLooping}
        playsInline
        preload="metadata"
        onClick={togglePlay}
        onPlay={handlePlay}
        onPause={handlePause}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onWaiting={handleWaiting}
        onPlaying={handlePlaying}
        className={cn(
          "w-full h-full object-contain cursor-pointer transition-transform duration-300",
          isFullscreen ? "max-h-screen" : "h-full"
        )}
      />

      {/* Buffering & Center Ripple / Play Overlay */}
      <PlayerOverlay
        isBuffering={isBuffering}
        centerAnimation={centerAnimation}
        isPlaying={isPlaying}
        onTogglePlay={togglePlay}
      />

      {/* Top Bar with Badge, Loop indicator, and Top-Right Dropdown Menu */}
      <PlayerTopBar
        badgeText={badgeText}
        isLooping={isLooping}
        showControls={showControls}
        isPlaying={isPlaying}
        onDownloadTranscript={onDownloadTranscript}
        onDownloadSubtitles={onDownloadSubtitles}
        onDeleteClip={onDeleteClip}
        hasTranscript={hasTranscript}
      />

      {/* Bottom Floating Controls Bar */}
      <div
        className={cn(
          "absolute bottom-0 inset-x-0 pt-10 pb-3 px-3.5 bg-gradient-to-t from-black/95 via-black/70 to-transparent z-20 flex flex-col gap-2 transition-all duration-300 pointer-events-auto",
          showControls || !isPlaying ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"
        )}
      >
        <PlayerScrubber
          duration={duration}
          currentTime={currentTime}
          bufferedEnd={bufferedEnd}
          onSeek={seekTo}
          onScrubbingChange={setIsScrubbing}
        />

        <PlayerControls
          isPlaying={isPlaying}
          onTogglePlay={togglePlay}
          isMuted={isMuted}
          volume={volume}
          onToggleMute={toggleMute}
          onVolumeChange={handleVolumeChange}
          currentTime={currentTime}
          duration={duration}
          playbackRate={playbackRate}
          onCyclePlaybackRate={cyclePlaybackRate}
          isLooping={isLooping}
          onToggleLoop={toggleLoop}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
        />
      </div>
    </div>
  );
}
