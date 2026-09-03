"use client";

import * as React from "react";
import { PlayerMenuDropdown } from "./PlayerMenuDropdown";
import { PlayerMenuActions } from "./types";
import { cn } from "@/lib/utils";

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
        "absolute top-3 inset-x-3 flex items-center justify-between z-30 transition-opacity duration-300 pointer-events-none",
        showControls || !isPlaying ? "opacity-100" : "opacity-0"
      )}
    >
      {/* Left: Badge & Loop Status */}
      <div className="flex items-center gap-1.5 pointer-events-auto">
        <span className="inline-flex items-center rounded-lg bg-black/75 backdrop-blur-md text-white px-2.5 py-1 text-[10px] font-mono font-bold border border-white/15 shadow-sm">
          {badgeText}
        </span>

        {isLooping && (
          <span className="inline-flex items-center gap-1 rounded-lg bg-black/75 backdrop-blur-md text-primary px-2 py-0.5 text-[10px] font-mono font-semibold border border-primary/25 shadow-sm">
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
