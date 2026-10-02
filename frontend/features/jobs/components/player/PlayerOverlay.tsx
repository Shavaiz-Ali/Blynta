"use client";

import * as React from "react";

interface PlayerOverlayProps {
  isBuffering: boolean;
  centerAnimation: "play" | "pause" | null;
  isPlaying: boolean;
  onTogglePlay: () => void;
}

export function PlayerOverlay({
  isBuffering,
  centerAnimation,
  isPlaying,
  onTogglePlay,
}: PlayerOverlayProps) {
  return (
    <>
      {/* Buffering Spinner */}
      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20 bg-black/30 backdrop-blur-[1px]">
          <div className="h-10 w-10 animate-spin rounded-full border-3 border-white/25 border-t-primary" />
        </div>
      )}

      {/* Animated Center Ripple Action Icon */}
      {centerAnimation && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="h-16 w-16 rounded-full bg-black/60 backdrop-blur-sm border border-white/20 text-white flex items-center justify-center animate-out fade-out zoom-out duration-500">
            {centerAnimation === "play" ? (
              <svg className="h-7 w-7 fill-current translate-x-0.5" viewBox="0 0 24 24">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            ) : (
              <svg className="h-7 w-7 fill-current" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            )}
          </div>
        </div>
      )}

      {/* Center Play Button Overlay (when paused & not animating) */}
      {!isPlaying && !centerAnimation && !isBuffering && (
        <button
          type="button"
          onClick={onTogglePlay}
          className="absolute inset-0 z-10 m-auto flex h-16 w-16 cursor-pointer items-center justify-center rounded-full border border-white/25 bg-primary/90 text-primary-foreground shadow-2xl shadow-black/50 backdrop-blur-md transition-all hover:scale-105 hover:bg-primary active:scale-95"
          aria-label="Play video"
        >
          <svg className="h-6 w-6 fill-current translate-x-0.5 text-white" viewBox="0 0 24 24">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        </button>
      )}
    </>
  );
}
