"use client";

import * as React from "react";
import { formatTimestamp } from "@/features/dashboard/utils";
import { cn } from "@/lib/utils";

interface PlayerControlsProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  isMuted: boolean;
  volume: number;
  onToggleMute: () => void;
  onVolumeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  currentTime: number;
  duration: number;
  playbackRate: number;
  onCyclePlaybackRate: () => void;
  isLooping: boolean;
  onToggleLoop: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

export function PlayerControls({
  isPlaying,
  onTogglePlay,
  isMuted,
  volume,
  onToggleMute,
  onVolumeChange,
  currentTime,
  duration,
  playbackRate,
  onCyclePlaybackRate,
  isLooping,
  onToggleLoop,
  isFullscreen,
  onToggleFullscreen,
}: PlayerControlsProps) {
  return (
    <div className="flex items-center justify-between gap-2 text-white">
      {/* Left: Play/Pause, Volume, Time */}
      <div className="flex items-center gap-2">
        {/* Play / Pause Toggle */}
        <button
          type="button"
          onClick={onTogglePlay}
          className="h-8 w-8 rounded-lg hover:bg-white/15 flex items-center justify-center text-white transition-colors cursor-pointer"
          title={isPlaying ? "Pause (Space)" : "Play (Space)"}
        >
          {isPlaying ? (
            <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg className="h-4 w-4 fill-current translate-x-0.5" viewBox="0 0 24 24">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          )}
        </button>

        {/* Volume / Mute with Slide Out */}
        <div className="flex items-center group/vol">
          <button
            type="button"
            onClick={onToggleMute}
            className="h-8 w-8 rounded-lg hover:bg-white/15 flex items-center justify-center text-white transition-colors cursor-pointer"
            title={isMuted ? "Unmute (M)" : "Mute (M)"}
          >
            {isMuted || volume === 0 ? (
              <svg className="h-4 w-4 stroke-current fill-none stroke-[2]" viewBox="0 0 24 24">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </svg>
            ) : (
              <svg className="h-4 w-4 stroke-current fill-none stroke-[2]" viewBox="0 0 24 24">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              </svg>
            )}
          </button>

          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={isMuted ? 0 : volume}
            onChange={onVolumeChange}
            className="w-0 group-hover/vol:w-14 transition-all duration-200 h-1 bg-white/30 accent-primary rounded-full cursor-pointer opacity-0 group-hover/vol:opacity-100"
            title="Volume"
          />
        </div>

        {/* Time Stamp Display */}
        <div className="text-[11px] font-mono text-white/90 tabular-nums">
          <span>{formatTimestamp(currentTime)}</span>
          <span className="text-white/40 mx-1">/</span>
          <span className="text-white/70">{formatTimestamp(duration)}</span>
        </div>
      </div>

      {/* Right: Playback Speed, Loop, Fullscreen */}
      <div className="flex items-center gap-1">
        {/* Speed toggle */}
        <button
          type="button"
          onClick={onCyclePlaybackRate}
          className="h-7 px-1.5 rounded-lg hover:bg-white/15 text-[10px] font-mono font-bold text-white/90 transition-colors"
          title="Change Speed"
        >
          {playbackRate}x
        </button>

        {/* Loop toggle */}
        <button
          type="button"
          onClick={onToggleLoop}
          className={cn(
            "h-7 w-7 rounded-lg hover:bg-white/15 flex items-center justify-center transition-colors cursor-pointer",
            isLooping ? "text-primary" : "text-white/70"
          )}
          title={isLooping ? "Disable Loop (L)" : "Enable Loop (L)"}
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="m17 2 4 4-4 4" />
            <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
            <path d="m7 22-4-4 4-4" />
            <path d="M21 13v1a4 4 0 0 1-4 4H3" />
          </svg>
        </button>

        {/* Fullscreen */}
        <button
          type="button"
          onClick={onToggleFullscreen}
          className="h-7 w-7 rounded-lg hover:bg-white/15 flex items-center justify-center text-white/90 transition-colors cursor-pointer"
          title={isFullscreen ? "Exit Fullscreen (F)" : "Fullscreen (F)"}
        >
          {isFullscreen ? (
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3v3a2 2 0 0 1-2 2H3" />
              <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
              <path d="M3 16h3a2 2 0 0 1 2 2v3" />
              <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
            </svg>
          ) : (
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3H5a2 2 0 0 0-2 2v3" />
              <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
              <path d="M3 16v3a2 2 0 0 0 2 2h3" />
              <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
