"use client";

import * as React from "react";

/** Refs owned by the component so no ref is ever exposed from this hook. */
export interface VideoPlaybackRefs {
  containerRef: React.RefObject<HTMLDivElement | null>;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

export interface UseVideoPlaybackOptions {
  /**
   * Keeps the overlay controls visible while playing instead of auto-hiding
   * them after a short idle period. Used by docked/desktop media stages.
   */
  pinnedControls?: boolean;
  /**
   * Starts playback as soon as the element is ready. If the browser blocks
   * unmuted autoplay the clip falls back to a muted start instead of staying
   * frozen on its poster.
   */
  autoPlay?: boolean;
  /** Registers the player keyboard shortcuts (Space, arrows, M, F, L). */
  keyboardShortcuts?: boolean;
  /** Seconds skipped by the arrow-key seek shortcuts. */
  seekStep?: number;
}

export interface VideoPlayback {
  /** Event handlers bound to the <video> element. */
  videoProps: {
    onPlay: () => void;
    onPause: () => void;
    onTimeUpdate: () => void;
    onLoadedMetadata: () => void;
    onWaiting: () => void;
    onPlaying: () => void;
  };
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  bufferedEnd: number;
  volume: number;
  isMuted: boolean;
  playbackRate: number;
  isLooping: boolean;
  isFullscreen: boolean;
  isBuffering: boolean;
  showControls: boolean;
  isScrubbing: boolean;
  centerAnimation: "play" | "pause" | null;
  togglePlay: () => void;
  toggleMute: () => void;
  handleVolumeChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  cyclePlaybackRate: () => void;
  toggleLoop: () => void;
  toggleFullscreen: () => void;
  seekTo: (time: number) => void;
  setIsScrubbing: React.Dispatch<React.SetStateAction<boolean>>;
  handleStageMouseMove: () => void;
  handleStageMouseEnter: () => void;
  handleStageMouseLeave: () => void;
}

const PLAYBACK_RATES = [1, 1.25, 1.5, 2];

/**
 * Single source of truth for clip playback.
 *
 * Shared by the studio player (floating overlay controls) and the media
 * workspace stage (docked controls) so both stay behaviourally identical while
 * their chrome differs. The component owns the element refs and passes them in.
 */
export function useVideoPlayback(
  { containerRef, videoRef }: VideoPlaybackRefs,
  {
    pinnedControls = false,
    autoPlay = false,
    keyboardShortcuts = true,
    seekStep = 5,
  }: UseVideoPlaybackOptions = {}
): VideoPlayback {
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

  const controlsTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearControlsTimeout = React.useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = null;
    }
  }, []);

  React.useEffect(() => clearControlsTimeout, [clearControlsTimeout]);

  // Auto-hide controls timer
  const resetControlsTimeout = React.useCallback(() => {
    setShowControls(true);
    clearControlsTimeout();
    if (isPlaying && !pinnedControls) {
      controlsTimeoutRef.current = setTimeout(() => {
        if (!isScrubbing) setShowControls(false);
      }, 2500);
    }
  }, [isPlaying, isScrubbing, pinnedControls, clearControlsTimeout]);

  const handleStageMouseMove = React.useCallback(() => {
    resetControlsTimeout();
  }, [resetControlsTimeout]);

  const handleStageMouseEnter = React.useCallback(() => {
    setShowControls(true);
  }, []);

  const handleStageMouseLeave = React.useCallback(() => {
    if (isPlaying && !isScrubbing && !pinnedControls) setShowControls(false);
  }, [isPlaying, isScrubbing, pinnedControls]);

  // Video event handlers
  const handlePlay = React.useCallback(() => setIsPlaying(true), []);

  const handlePause = React.useCallback(() => {
    setIsPlaying(false);
    setShowControls(true);
  }, []);

  const handleTimeUpdate = React.useCallback(() => {
    const video = videoRef.current;
    if (!video || isScrubbing) return;
    setCurrentTime(video.currentTime);

    if (video.buffered.length > 0) {
      setBufferedEnd(video.buffered.end(video.buffered.length - 1));
    }
  }, [isScrubbing, videoRef]);

  const handleLoadedMetadata = React.useCallback(() => {
    setDuration(videoRef.current?.duration || 0);
  }, [videoRef]);

  const handleWaiting = React.useCallback(() => setIsBuffering(true), []);

  const handlePlaying = React.useCallback(() => {
    setIsBuffering(false);
    setIsPlaying(true);
  }, []);

  // Play / Pause toggle
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
  }, [videoRef]);

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
  }, [isMuted, volume, videoRef]);

  const handleVolumeChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseFloat(event.target.value);
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
    },
    [isMuted, videoRef]
  );

  const cyclePlaybackRate = React.useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const currentIdx = PLAYBACK_RATES.indexOf(playbackRate);
    const nextRate = PLAYBACK_RATES[(currentIdx + 1) % PLAYBACK_RATES.length];
    video.playbackRate = nextRate;
    setPlaybackRate(nextRate);
  }, [playbackRate, videoRef]);

  const toggleLoop = React.useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const nextLooping = !isLooping;
    video.loop = nextLooping;
    setIsLooping(nextLooping);
  }, [isLooping, videoRef]);

  const toggleFullscreen = React.useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  }, [containerRef]);

  React.useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  // Start playback as soon as the element is ready, browser policies permitting
  React.useEffect(() => {
    if (!autoPlay) return;
    const video = videoRef.current;
    if (!video) return;

    video.play().catch(() => {
      // Unmuted autoplay was blocked: start muted so the clip still plays and
      // let the viewer unmute from the transport controls.
      video.muted = true;
      setIsMuted(true);
      video.play().catch(() => {});
    });
  }, [autoPlay, videoRef]);

  const seekTo = React.useCallback(
    (time: number) => {
      const video = videoRef.current;
      if (!video) return;
      const clamped = Math.max(0, Math.min(time, duration));
      video.currentTime = clamped;
      setCurrentTime(clamped);
    },
    [duration, videoRef]
  );

  // Keyboard navigation
  React.useEffect(() => {
    if (!keyboardShortcuts) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea") return;

      if (event.code === "Space") {
        event.preventDefault();
        togglePlay();
      } else if (event.code === "ArrowLeft") {
        event.preventDefault();
        seekTo(currentTime - seekStep);
      } else if (event.code === "ArrowRight") {
        event.preventDefault();
        seekTo(currentTime + seekStep);
      } else if (event.code === "KeyM") {
        event.preventDefault();
        toggleMute();
      } else if (event.code === "KeyF") {
        event.preventDefault();
        toggleFullscreen();
      } else if (event.code === "KeyL") {
        event.preventDefault();
        toggleLoop();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    keyboardShortcuts,
    seekStep,
    togglePlay,
    seekTo,
    currentTime,
    toggleMute,
    toggleFullscreen,
    toggleLoop,
  ]);

  return {
    videoProps: {
      onPlay: handlePlay,
      onPause: handlePause,
      onTimeUpdate: handleTimeUpdate,
      onLoadedMetadata: handleLoadedMetadata,
      onWaiting: handleWaiting,
      onPlaying: handlePlaying,
    },
    isPlaying,
    currentTime,
    duration,
    bufferedEnd,
    volume,
    isMuted,
    playbackRate,
    isLooping,
    isFullscreen,
    isBuffering,
    showControls,
    isScrubbing,
    centerAnimation,
    togglePlay,
    toggleMute,
    handleVolumeChange,
    cyclePlaybackRate,
    toggleLoop,
    toggleFullscreen,
    seekTo,
    setIsScrubbing,
    handleStageMouseMove,
    handleStageMouseEnter,
    handleStageMouseLeave,
  };
}
