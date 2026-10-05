"use client";

import * as React from "react";
import { formatTimestamp } from "./formatTimestamp";

interface PlayerScrubberProps {
  duration: number;
  currentTime: number;
  bufferedEnd: number;
  onSeek: (time: number) => void;
  onScrubbingChange: (scrubbing: boolean) => void;
}

export function PlayerScrubber({
  duration,
  currentTime,
  bufferedEnd,
  onSeek,
  onScrubbingChange,
}: PlayerScrubberProps) {
  const progressBarRef = React.useRef<HTMLDivElement>(null);
  const [hoverTime, setHoverTime] = React.useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = React.useState<number>(0);

  const calculateScrubTime = React.useCallback(
    (clientX: number) => {
      const bar = progressBarRef.current;
      if (!bar || duration === 0) return 0;
      const rect = bar.getBoundingClientRect();
      const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return pos * duration;
    },
    [duration],
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    onScrubbingChange(true);
    const time = calculateScrubTime(e.clientX);
    onSeek(time);

    const onMouseMove = (moveEvent: MouseEvent) => {
      const scrubTime = calculateScrubTime(moveEvent.clientX);
      onSeek(scrubTime);
    };

    const onMouseUp = () => {
      onScrubbingChange(false);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const bar = progressBarRef.current;
    if (!bar || duration === 0) return;
    const rect = bar.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverPosition(pos * 100);
    setHoverTime(pos * duration);
  };

  const handleMouseLeave = () => {
    setHoverTime(null);
  };

  const playedPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPercent = duration > 0 ? (bufferedEnd / duration) * 100 : 0;

  return (
    <div
      ref={progressBarRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="group/progress relative flex h-3 cursor-pointer touch-none items-center"
    >
      {/* Hover Time Tooltip */}
      {hoverTime !== null && (
        <div
          className="pointer-events-none absolute -top-8 -translate-x-1/2 rounded-md border border-white/15 bg-[#07101f]/95 px-2 py-1 font-mono text-[10px] font-semibold text-white shadow-lg backdrop-blur-sm"
          style={{ left: `${hoverPosition}%` }}
        >
          {formatTimestamp(hoverTime)}
        </div>
      )}

      {/* Rail Background */}
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/15 transition-all group-hover/progress:h-2">
        {/* Buffered progress */}
        <div
          className="absolute h-full bg-white/20 transition-all"
          style={{ width: `${bufferedPercent}%` }}
        />
        {/* Played progress */}
        <div
          className="absolute h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all"
          style={{ width: `${playedPercent}%` }}
        />
      </div>

      {/* Scrubbing Handle Knob */}
      <div
        className="pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 scale-0 rounded-full border-2 border-white bg-primary shadow-lg transition-transform group-hover/progress:scale-100"
        style={{ left: `${playedPercent}%` }}
      />
    </div>
  );
}
