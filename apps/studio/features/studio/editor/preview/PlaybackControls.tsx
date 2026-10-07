"use client";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { AppButton, AppSlider, AppTooltip } from "@blynta/ui";
import { formatTime } from "../utils/time";
import { PreviewZoom, type PreviewZoomValue } from "./PreviewZoom";

/** Studio transport composition; the existing preview owns playback and volume. */
export function PlaybackControls({
  disabled,
  playing,
  onTogglePlay,
  muted,
  volume,
  onToggleMute,
  onVolumeChange,
  currentTime,
  duration,
  fullscreen,
  onToggleFullscreen,
  onPreviousFrame,
  onNextFrame,
  zoom,
  onZoomChange,
}: {
  disabled: boolean;
  playing: boolean;
  onTogglePlay: () => void;
  muted: boolean;
  volume: number;
  onToggleMute: () => void;
  onVolumeChange: (value: number) => void;
  currentTime: number;
  duration: number;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  onPreviousFrame: () => void;
  onNextFrame: () => void;
  zoom: PreviewZoomValue;
  onZoomChange: (value: PreviewZoomValue) => void;
}) {
  return (
    <div
      className="grid min-h-12 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 @max-[420px]/preview:grid-cols-2"
      data-preview-transport
    >
      <div className="flex min-w-0 items-center gap-2" data-transport-time>
        <span
          className="whitespace-nowrap font-mono text-xs tabular-nums"
          aria-label="Preview time"
        >
          {formatTime(currentTime).slice(0, 5)}{" "}
          <span className="text-muted-foreground">
            / {formatTime(duration).slice(0, 5)}
          </span>
        </span>
        <div className="group/volume relative">
          <AppTooltip content={muted ? "Unmute preview" : "Mute preview"}>
            <AppButton
              variant="ghost"
              size="icon"
              aria-label={muted ? "Unmute video" : "Mute video"}
              onClick={onToggleMute}
              className="text-muted-foreground"
            >
              {muted || volume === 0 ? (
                <VolumeX className="size-4" />
              ) : (
                <Volume2 className="size-4" />
              )}
            </AppButton>
          </AppTooltip>
          <div className="absolute bottom-full left-0 z-30 hidden w-32 rounded-lg border border-border bg-popover p-3 shadow-lg group-hover/volume:block group-focus-within/volume:block">
            <AppSlider
              label="Preview volume"
              value={muted ? 0 : volume}
              max={100}
              onValueChange={onVolumeChange}
            />
          </div>
        </div>
      </div>
      <div
        className="flex items-center justify-center gap-1 @max-[420px]/preview:order-3 @max-[420px]/preview:col-span-2"
        data-transport-playback
      >
        <AppTooltip content="Previous frame">
          <AppButton
            variant="ghost"
            size="icon"
            disabled={disabled}
            aria-label="Previous frame"
            onClick={onPreviousFrame}
            className="text-muted-foreground"
          >
            <SkipBack className="size-4" />
          </AppButton>
        </AppTooltip>
        <AppTooltip content={playing ? "Pause · Space" : "Play · Space"}>
          <AppButton
            size="icon-lg"
            className="rounded-full"
            disabled={disabled}
            aria-label={playing ? "Pause video" : "Play video"}
            onClick={onTogglePlay}
          >
            {playing ? (
              <Pause className="size-4 fill-current" />
            ) : (
              <Play className="size-4 translate-x-px fill-current" />
            )}
          </AppButton>
        </AppTooltip>
        <AppTooltip content="Next frame">
          <AppButton
            variant="ghost"
            size="icon"
            disabled={disabled}
            aria-label="Next frame"
            onClick={onNextFrame}
            className="text-muted-foreground"
          >
            <SkipForward className="size-4" />
          </AppButton>
        </AppTooltip>
      </div>
      <div
        className="flex items-center justify-end gap-1"
        data-transport-display
      >
        <PreviewZoom value={zoom} onChange={onZoomChange} />
        <AppTooltip
          content={fullscreen ? "Exit fullscreen" : "Fullscreen preview"}
        >
          <AppButton
            variant="ghost"
            size="icon"
            aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            onClick={onToggleFullscreen}
            className="text-muted-foreground"
          >
            {fullscreen ? (
              <Minimize2 className="size-4" />
            ) : (
              <Maximize2 className="size-4" />
            )}
          </AppButton>
        </AppTooltip>
      </div>
    </div>
  );
}
