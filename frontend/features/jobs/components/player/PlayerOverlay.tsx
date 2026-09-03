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
          <div className="h-10 w-10 rounded-full border-3 border-primary border-t-transparent animate-spin" />
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
          className="absolute inset-0 m-auto h-14 w-14 rounded-2xl bg-black/50 hover:bg-black/70 backdrop-blur-md border border-white/20 text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-xl z-10 cursor-pointer"
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
