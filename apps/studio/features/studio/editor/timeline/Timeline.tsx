"use client";

import { useEffect, useRef, useState } from "react";
import {
  LockKeyhole,
  UnlockKeyhole,
  Maximize2,
  Scissors,
  Copy,
  Trash2,
  Magnet,
  Minus,
  Plus,
  Eye,
  EyeOff,
  Volume2,
  VolumeX,
  Film,
  Type,
  AudioLines,
  Layers,
} from "lucide-react";
import { AppButton } from "@blynta/ui";
import { AppSlider } from "@blynta/ui";
import { AppScrollArea } from "@blynta/ui";
import { useEditorPlayback } from "../hooks/useEditor";
import { TimelineClip } from "./TimelineClip";
import { formatTime } from "../utils/time";
export function Timeline() {
  const e = useEditorPlayback();
  const timeline = useRef<HTMLElement>(null);
  const locked = !!e.doc.tracks.find((t) => t.id === e.selected?.trackId)
    ?.locked;
  const [available, setAvailable] = useState(1000);
  useEffect(() => {
    if (!timeline.current) return;
    const observer = new ResizeObserver((entries) => {
      const headerWidth =
        parseFloat(
          getComputedStyle(timeline.current!).getPropertyValue(
            "--track-header-width",
          ),
        ) || 154;
      setAvailable(Math.max(1, entries[0].contentRect.width - headerWidth));
    });
    observer.observe(timeline.current);
    return () => observer.disconnect();
  }, []);
  const extent = Math.max(20, e.duration + 5, available / e.zoom);
  const width = extent * e.zoom;
  const rulerStep =
    [0.5, 1, 2, 5, 10, 20, 30, 60, 120, 300].find(
      (step) => step * e.zoom >= 64,
    ) || 300;
  const selected = e.selected;
  const canSplit =
    selected &&
    !locked &&
    e.playhead > selected.start + 0.1 &&
    e.playhead < selected.start + selected.duration - 0.1;
  function seek(event: React.PointerEvent) {
    const rect = event.currentTarget.getBoundingClientRect();
    const t = (event.clientX - rect.left) / e.zoom;
    e.seek(Math.min(e.duration, Math.max(0, t)));
  }
  return (
    <section
      ref={timeline}
      className="timeline-area"
      aria-label="Project timeline"
    >
      <div className="timeline-toolbar">
        <span className="text-xs font-medium mr-2">Timeline</span>
        <AppButton
          variant="ghost"
          size="icon-sm"
          title="Split at playhead · S"
          aria-label="Split clip at playhead"
          disabled={!canSplit}
          onClick={e.split}
        >
          <Scissors />
        </AppButton>
        <AppButton
          variant="ghost"
          size="icon-sm"
          title="Duplicate selected clip"
          aria-label="Duplicate selected clip"
          disabled={!selected || locked}
          onClick={e.duplicate}
        >
          <Copy />
        </AppButton>
        <AppButton
          variant="ghost"
          size="icon-sm"
          title="Delete selected clip · Delete"
          aria-label="Delete selected clip"
          disabled={!selected || locked}
          onClick={e.remove}
        >
          <Trash2 />
        </AppButton>
        <div className="timeline-tools-spacer" />
        <AppButton
          variant={e.showAllTracks ? "secondary" : "ghost"}
          size="icon-sm"
          aria-label="Show all tracks"
          title="Show all tracks"
          aria-pressed={e.showAllTracks}
          onClick={() => e.setShowAllTracks(!e.showAllTracks)}
        >
          <Layers />
        </AppButton>
        <AppButton
          variant={e.snapping ? "secondary" : "ghost"}
          size="icon-sm"
          title="Toggle snapping"
          aria-label="Toggle snapping"
          aria-pressed={e.snapping}
          onClick={() => e.setSnapping(!e.snapping)}
        >
          <Magnet />
        </AppButton>

        <div className="ml-auto flex items-center gap-2">
          <span className="time-display text-xs mr-3">
            {formatTime(e.playhead)}
          </span>
          <AppButton
            variant="ghost"
            size="icon-sm"
            aria-label="Zoom out timeline"
            title="Zoom out"
            onClick={() => e.setZoom(Math.max(8, e.zoom - 4))}
          >
            <Minus />
          </AppButton>
          <AppSlider
            label="Timeline zoom"
            min={8}
            max={120}
            value={e.zoom}
            onValueChange={e.setZoom}
            className="timeline-zoom"
          />
          <AppButton
            variant="ghost"
            size="icon-sm"
            aria-label="Zoom in timeline"
            title="Zoom in"
            onClick={() => e.setZoom(Math.min(120, e.zoom + 4))}
          >
            <Plus />
          </AppButton>
          <AppButton
            size="icon-sm"
            variant="ghost"
            title="Fit timeline"
            aria-label="Fit timeline"
            onClick={() =>
              e.setZoom(
                Math.max(
                  8,
                  Math.min(
                    120,
                    (available - 16) / Math.max(20, e.duration + 5),
                  ),
                ),
              )
            }
          >
            <Maximize2 />
          </AppButton>
        </div>
      </div>
      <AppScrollArea horizontal className="timeline-vertical">
        <div
          className="timeline-content"
          style={{
            minHeight: 32 + e.visibleTracks.length * 58,
            width: `calc(var(--track-header-width, 154px) + ${width}px)`,
          }}
        >
          <div className="track-headers">
            <div className="ruler-header">TRACKS</div>
            {e.visibleTracks.map((t) => (
              <div
                className={`track-header ${t.locked ? "locked-track" : ""}`}
                key={t.id}
              >
                <span className="flex items-center gap-2">
                  {t.kind === "audio" ? (
                    <AudioLines size={13} />
                  ) : t.kind === "text" ? (
                    <Type size={13} />
                  ) : (
                    <Film size={13} />
                  )}{" "}
                  {t.name}
                </span>
                <div className="flex">
                  <AppButton
                    variant="ghost"
                    size="icon-xs"
                    title={`${t.locked ? "Unlock" : "Lock"} track`}
                    aria-label={`${t.locked ? "Unlock" : "Lock"} ${t.name}`}
                    aria-pressed={!!t.locked}
                    onClick={() =>
                      e.edit((d) => ({
                        ...d,
                        tracks: d.tracks.map((track) =>
                          track.id === t.id
                            ? { ...track, locked: !track.locked }
                            : track,
                        ),
                      }))
                    }
                  >
                    {t.locked ? <LockKeyhole /> : <UnlockKeyhole />}
                  </AppButton>
                  <AppButton
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`${t.hidden ? "Show" : "Hide"} ${t.name}`}
                    title={`${t.hidden ? "Show" : "Hide"} track`}
                    onClick={() =>
                      e.edit((d) => ({
                        ...d,
                        tracks: d.tracks.map((track) =>
                          track.id === t.id
                            ? { ...track, hidden: !track.hidden }
                            : track,
                        ),
                      }))
                    }
                  >
                    {t.hidden ? <EyeOff /> : <Eye />}
                  </AppButton>
                  {(t.kind === "video" || t.kind === "audio") && (
                    <AppButton
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`${t.muted ? "Unmute" : "Mute"} ${t.name}`}
                      title={`${t.muted ? "Unmute" : "Mute"} track`}
                      onClick={() =>
                        e.edit((d) => ({
                          ...d,
                          tracks: d.tracks.map((track) =>
                            track.id === t.id
                              ? { ...track, muted: !track.muted }
                              : track,
                          ),
                        }))
                      }
                    >
                      {t.muted ? <VolumeX /> : <Volume2 />}
                    </AppButton>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="timeline-scroll">
            <div className="timeline-inner" style={{ width }}>
              <div className="time-ruler">
                <AppSlider
                  label="Timeline playhead"
                  showTrack={false}
                  value={e.playhead}
                  max={extent}
                  step={1 / 30}
                  onValueChange={(v) => e.seek(Math.min(e.duration, v))}
                  disabled={!e.duration}
                  className="ruler-seek"
                />
                {Array.from(
                  { length: Math.floor(extent / rulerStep) + 1 },
                  (_, i) => (
                    <span key={i} style={{ left: i * rulerStep * e.zoom }}>
                      {rulerStep < 1
                        ? formatTime(i * rulerStep)
                        : formatTime(i * rulerStep).slice(0, 5)}
                    </span>
                  ),
                )}
              </div>
              {e.visibleTracks.map((t) => (
                <div
                  className={`track-lane ${t.hidden ? "opacity-40" : ""}`}
                  style={{ backgroundSize: `${rulerStep * e.zoom}px 100%` }}
                  key={t.id}
                  onPointerDown={(v) => {
                    if (v.target === v.currentTarget) {
                      e.select(null);
                      seek(v);
                    }
                  }}
                  onDragOver={(v) => v.preventDefault()}
                  onDrop={(v) => {
                    v.preventDefault();
                    const asset = e.doc.assets.find(
                      (a) =>
                        a.id ===
                        v.dataTransfer.getData("application/blynta-asset"),
                    );
                    if (!asset || t.locked) return;
                    const compatible =
                      asset.kind === t.kind ||
                      (asset.kind === "image" && t.kind === "video");
                    if (!compatible && e.showAllTracks) return;
                    const start = Math.max(
                      0,
                      (v.clientX -
                        v.currentTarget.getBoundingClientRect().left) /
                        e.zoom,
                    );
                    e.add(
                      asset,
                      e.snapping ? Math.round(start * 2) / 2 : start,
                      compatible ? t.id : undefined,
                    );
                  }}
                >
                  {e.doc.clips
                    .filter((c) => c.trackId === t.id)
                    .map((c) => (
                      <TimelineClip key={c.id} clip={c} />
                    ))}
                </div>
              ))}
              <div
                className="timeline-playhead"
                style={{ left: e.playhead * e.zoom }}
                aria-hidden="true"
              >
                <span />
              </div>
              {!e.doc.clips.length && (
                <div className="timeline-empty">
                  Drag media onto a track to begin.
                </div>
              )}
            </div>
          </div>
        </div>
      </AppScrollArea>
    </section>
  );
}
