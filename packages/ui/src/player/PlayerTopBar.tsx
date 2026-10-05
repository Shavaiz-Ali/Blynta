"use client";

import * as React from "react";
import { PlayerMenuDropdown } from "./PlayerMenuDropdown";
import { PlayerMenuActions } from "./types";
import { cn } from "../lib/utils";

interface PlayerTopBarProps extends PlayerMenuActions {
  badgeText?: string;
  isLooping: boolean;
  showControls: boolean;
  isPlaying: boolean;
}

export function PlayerTopBar({
  badgeText = "9:16 Shorts",
  isLooping,
  showControls,
  isPlaying,
  onDownloadTranscript,
  onDownloadSubtitles,
  onDeleteClip,
  hasTranscript,
}: PlayerTopBarProps) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-3 top-3 z-30 flex items-center justify-between transition-opacity duration-300",
        showControls || !isPlaying ? "opacity-100" : "opacity-0",
      )}
    >
      {/* Left: Badge & Loop Status */}
      <div className="pointer-events-auto flex items-center gap-1.5">
        <span className="inline-flex items-center rounded-full border border-white/15 bg-[#07101f]/85 px-2.5 py-1 text-[10px] font-semibold text-white shadow-lg backdrop-blur-md">
          {badgeText}
        </span>

        {isLooping && (
          <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/15 px-2 py-1 text-[10px] font-semibold text-blue-300 shadow-lg backdrop-blur-md">
            <svg
              className="h-3 w-3 animate-spin"
              style={{ animationDuration: "10s" }}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="m17 2 4 4-4 4" />
              <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
              <path d="m7 22-4-4 4-4" />
              <path d="M21 13v1a4 4 0 0 1-4 4H3" />
            </svg>
            <span>Loop</span>
          </span>
        )}
      </div>

      {/* Right: Dropdown Menu (Transcript, Subtitles, Delete) */}
      <div className="pointer-events-auto">
        <PlayerMenuDropdown
          onDownloadTranscript={onDownloadTranscript}
          onDownloadSubtitles={onDownloadSubtitles}
          onDeleteClip={onDeleteClip}
          hasTranscript={hasTranscript}
        />
      </div>
    </div>
  );
}
