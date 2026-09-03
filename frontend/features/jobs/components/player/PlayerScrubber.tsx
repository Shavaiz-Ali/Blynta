"use client";

import * as React from "react";
import { formatTimestamp } from "@/features/dashboard/utils";

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
    [duration]
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
      className="group/progress relative h-2.5 flex items-center cursor-pointer touch-none"
    >
      {/* Hover Time Tooltip */}
      {hoverTime !== null && (
        <div
          className="absolute -top-7 -translate-x-1/2 bg-black/85 backdrop-blur-sm border border-white/20 text-white text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded shadow pointer-events-none"
          style={{ left: `${hoverPosition}%` }}
        >
          {formatTimestamp(hoverTime)}
        </div>
      )}

      {/* Rail Background */}
      <div className="w-full h-1 group-hover/progress:h-1.5 rounded-full bg-white/20 transition-all overflow-hidden relative">
        {/* Buffered progress */}
        <div
          className="absolute h-full bg-white/30 transition-all"
          style={{ width: `${bufferedPercent}%` }}
        />
        {/* Played progress */}
        <div
          className="absolute h-full bg-primary transition-all"
          style={{ width: `${playedPercent}%` }}
        />
      </div>

      {/* Scrubbing Handle Knob */}
      <div
        className="absolute h-3 w-3 rounded-full bg-primary border-2 border-white shadow-md -translate-x-1/2 scale-0 group-hover/progress:scale-100 transition-transform pointer-events-none"
        style={{ left: `${playedPercent}%` }}
      />
    </div>
  );
}
