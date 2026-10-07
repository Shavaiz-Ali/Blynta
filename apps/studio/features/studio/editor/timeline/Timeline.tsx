"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  Undo2,
  Redo2,
} from "lucide-react";
import { AppButton, AppTooltip } from "@blynta/ui";
import { AppSlider } from "@blynta/ui";
import { AppScrollArea } from "@blynta/ui";
import { useEditorPlayback } from "../hooks/useEditor";
import { TimelineClip } from "./TimelineClip";
import { formatTime } from "../utils/time";
import { assetDragType, assetPlacement, timelineTime } from "../utils/timeline";
export function Timeline() {
  const e = useEditorPlayback();
  const timeline = useRef<HTMLElement>(null);
  const locked = !!e.doc.tracks.find((t) => t.id === e.selected?.trackId)
    ?.locked;
  const [available, setAvailable] = useState(1000);
  const [drop, setDrop] = useState<{
    lane: string;
    start: number;
    hint: number;
    label: string;
  } | null>(null);
  const content = useRef<HTMLDivElement>(null);
  const lastView = useRef({ time: e.playhead, zoom: e.zoom });
  const lastSelection = useRef(e.selectedId);
  const viewport = () =>
    timeline.current?.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]',
    );
  const revealTime = useCallback(
    (time: number) => {
      const scroll = viewport();
      if (!scroll || !timeline.current) return;
      const header =
        parseFloat(
          getComputedStyle(timeline.current).getPropertyValue(
            "--track-header-width",
          ),
        ) || 192;
      const position = time * e.zoom;
      if (
        position < scroll.scrollLeft ||
        position > scroll.scrollLeft + scroll.clientWidth - header - 24
      )
        scroll.scrollLeft = Math.max(
          0,
          position - (scroll.clientWidth - header) / 3,
        );
    },
    [e.zoom],
  );
  useEffect(() => {
    const clear = () => setDrop(null);
    document.addEventListener("dragend", clear);
    return () => document.removeEventListener("dragend", clear);
  }, []);
  useEffect(() => {
    const scroll = viewport();
    if (scroll) scroll.scrollLeft = 0;
  }, [e.projectId]);
  useEffect(() => {
    const changed =
      Math.abs(e.playhead - lastView.current.time) > 1 ||
      e.zoom !== lastView.current.zoom;
    lastView.current = { time: e.playhead, zoom: e.zoom };
    if (!e.playing && !changed) return;
    revealTime(e.playhead);
  }, [e.playhead, e.playing, e.zoom, revealTime]);
  useEffect(() => {
    if (lastSelection.current === e.selectedId) return;
    lastSelection.current = e.selectedId;
    if (!e.selected || e.playing) return;
    revealTime(e.selected.start);
  }, [e.selected, e.selectedId, e.playing, revealTime]);
  function placement(event: React.DragEvent, trackId: string) {
    const asset = e.doc.assets.find(
      (item) =>
        item.id ===
        (e.draggedAssetId || event.dataTransfer.getData(assetDragType)),
    );
    if (!asset || !content.current) return;
    const time = timelineTime(
      event.clientX,
      content.current.getBoundingClientRect().left,
      e.zoom,
    );
    const next = assetPlacement(
      e.doc,
      asset,
      e.snapping ? Math.round(time * 2) / 2 : time,
      trackId,
    );
    return next && { asset, hint: time, ...next };
  }
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
    const t = timelineTime(event.clientX, rect.left, e.zoom);
    e.seek(Math.min(e.duration, Math.max(0, t)));
  }
  return (
    <section
      ref={timeline}
      className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl bg-card ring-1 ring-border/60 [--track-header-width:192px] max-md:[--track-header-width:144px]"
      data-timeline-workspace
      aria-label="Project timeline"
    >
      <div
        className="flex h-12 shrink-0 items-center gap-1 overflow-x-auto border-b border-border/60 px-3"
        data-timeline-toolbar
      >
        <span className="mr-3 text-sm font-semibold max-[980px]:hidden">
          Timeline
        </span>
        <AppTooltip content="Undo · Ctrl/⌘ Z">
          <AppButton
            variant="ghost"
            size="icon"
            aria-label="Undo"
            disabled={!e.history.past.length}
            onClick={e.undo}
          >
            <Undo2 />
          </AppButton>
        </AppTooltip>
        <AppTooltip content="Redo · Ctrl/⌘ Shift Z">
          <AppButton
            variant="ghost"
            size="icon-sm"
            aria-label="Redo"
            disabled={!e.history.future.length}
            onClick={e.redo}
          >
            <Redo2 />
          </AppButton>
        </AppTooltip>
        <AppTooltip content="Split at playhead · S">
          <AppButton
            variant="ghost"
            size="icon-sm"
            aria-label="Split clip at playhead"
            disabled={!canSplit}
            onClick={e.split}
          >
            <Scissors />
          </AppButton>
        </AppTooltip>
        <AppTooltip content="Duplicate selected clip">
          <AppButton
            variant="ghost"
            size="icon-sm"
            aria-label="Duplicate selected clip"
            disabled={!selected || locked}
            onClick={e.duplicate}
          >
            <Copy />
          </AppButton>
        </AppTooltip>
        <AppTooltip content="Delete selected clip · Delete">
          <AppButton
            variant="ghost"
            size="icon-sm"
            aria-label="Delete selected clip"
            disabled={!selected || locked}
            onClick={e.remove}
          >
            <Trash2 />
          </AppButton>
        </AppTooltip>
        <div className="flex-1" />
        <AppTooltip content="Show all tracks">
          <AppButton
            variant={e.showAllTracks ? "secondary" : "ghost"}
            size="icon-sm"
            aria-label="Show all tracks"
            aria-pressed={e.showAllTracks}
            onClick={() => e.setShowAllTracks(!e.showAllTracks)}
          >
            <Layers />
          </AppButton>
        </AppTooltip>
        <AppTooltip content="Toggle snapping">
          <AppButton
            variant={e.snapping ? "secondary" : "ghost"}
            size="icon-sm"
            aria-label="Toggle snapping"
            aria-pressed={e.snapping}
            onClick={() => e.setSnapping(!e.snapping)}
          >
            <Magnet />
          </AppButton>
        </AppTooltip>

        <div className="ml-2 flex items-center gap-1 border-l border-border/60 pl-3">
          <span className="mr-3 whitespace-nowrap font-mono text-xs tabular-nums">
            {formatTime(e.playhead)}
          </span>
          <AppTooltip content="Zoom out">
            <AppButton
              variant="ghost"
              size="icon-sm"
              aria-label="Zoom out timeline"
              onClick={() => e.setZoom(Math.max(8, e.zoom - 4))}
            >
              <Minus />
            </AppButton>
          </AppTooltip>
          <AppSlider
            label="Timeline zoom"
            min={8}
            max={120}
            value={e.zoom}
            onValueChange={e.setZoom}
            className="mx-1 w-24 max-md:hidden"
          />
          <AppTooltip content="Zoom in">
            <AppButton
              variant="ghost"
              size="icon-sm"
              aria-label="Zoom in timeline"
              onClick={() => e.setZoom(Math.min(120, e.zoom + 4))}
            >
              <Plus />
            </AppButton>
          </AppTooltip>
          <AppTooltip content="Fit timeline">
            <AppButton
              size="icon-sm"
              variant="ghost"
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
          </AppTooltip>
        </div>
      </div>
      <AppScrollArea horizontal className="min-h-0 flex-1">
        <div
          className="flex min-h-full min-w-full"
          style={{
            minHeight: `max(100%, ${36 + e.visibleTracks.length * 64}px)`,
            width: `calc(var(--track-header-width, 154px) + ${width}px)`,
          }}
        >
          <div className="sticky left-0 z-10 shrink-0 basis-(--track-header-width) border-r border-border bg-card">
            <div className="sticky top-0 z-10 flex h-9 items-center border-b border-border/60 bg-card px-3 text-[11px] text-muted-foreground">
              TRACKS
            </div>
            {e.visibleTracks.map((t) => (
              <div
                className={`group/track flex h-16 items-center justify-between gap-2 border-b border-border/50 px-3 text-xs max-md:flex-col max-md:items-start max-md:justify-center max-md:gap-1 ${t.locked ? "opacity-60" : ""}`}
                key={t.id}
                data-track-header
              >
                <span className="flex min-w-0 items-center gap-2 truncate font-medium [&>svg]:shrink-0">
                  {t.kind === "audio" ? (
                    <AudioLines size={16} />
                  ) : t.kind === "text" ? (
                    <Type size={16} />
                  ) : (
                    <Film size={16} />
                  )}{" "}
                  {t.name}
                </span>
                <div className="flex shrink-0 text-muted-foreground opacity-70 transition-opacity group-hover/track:opacity-100 group-focus-within/track:opacity-100">
                  <AppTooltip content={`${t.locked ? "Unlock" : "Lock"} track`}>
                    <AppButton
                      variant="ghost"
                      size="icon-sm"
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
                  </AppTooltip>
                  <AppTooltip content={`${t.hidden ? "Show" : "Hide"} track`}>
                    <AppButton
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`${t.hidden ? "Show" : "Hide"} ${t.name}`}
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
                  </AppTooltip>
                  {(t.kind === "video" || t.kind === "audio") && (
                    <AppTooltip
                      content={`${t.muted ? "Unmute" : "Mute"} track`}
                    >
                      <AppButton
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`${t.muted ? "Unmute" : "Mute"} ${t.name}`}
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
                    </AppTooltip>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="relative isolate min-w-0 flex-1">
            <div
              ref={content}
              data-timeline-content
              className="relative min-h-full bg-[linear-gradient(to_right,color-mix(in_oklch,var(--border)_30%,transparent)_1px,transparent_1px)]"
              style={{ width, backgroundSize: `${rulerStep * e.zoom}px 100%` }}
            >
              <div className="sticky top-0 z-10 h-9 border-b border-border/60 bg-card [&>span]:absolute [&>span]:top-2.5 [&>span]:border-l [&>span]:border-border [&>span]:pl-3 [&>span]:text-xs [&>span]:tabular-nums [&>span]:text-muted-foreground">
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
                  className={`relative h-16 border-b border-border/50 ${drop?.lane === t.id ? "bg-primary/5 ring-1 ring-inset ring-primary/40" : "bg-muted/10"} ${t.hidden ? "opacity-40" : ""}`}
                  style={{ backgroundSize: `${rulerStep * e.zoom}px 100%` }}
                  key={t.id}
                  data-track-lane
                  data-track-id={t.id}
                  data-drop-valid={drop?.lane === t.id ? "true" : undefined}
                  onPointerDown={(v) => {
                    if (v.target === v.currentTarget) {
                      e.select(null);
                      seek(v);
                    }
                  }}
                  onDragOver={(event) => {
                    const next = placement(event, t.id);
                    event.dataTransfer.dropEffect = next ? "copy" : "none";
                    if (!next) {
                      setDrop(null);
                      return;
                    }
                    event.preventDefault();
                    setDrop({
                      lane: t.id,
                      start: next.start,
                      hint: next.hint,
                      label: `${next.track.name} · ${formatTime(next.start).slice(0, 5)}`,
                    });
                  }}
                  onDragLeave={(event) => {
                    if (
                      !event.currentTarget.contains(
                        event.relatedTarget as Node | null,
                      )
                    )
                      setDrop(null);
                  }}
                  onDrop={(v) => {
                    v.preventDefault();
                    const next = placement(v, t.id);
                    if (next) e.add(next.asset, next.start, next.track.id);
                    setDrop(null);
                    e.setDraggedAssetId(null);
                  }}
                >
                  {e.doc.clips
                    .filter((c) => c.trackId === t.id)
                    .map((c) => (
                      <TimelineClip key={c.id} clip={c} />
                    ))}
                  {drop?.lane === t.id && (
                    <>
                      <div
                        data-drop-indicator
                        data-drop-time={drop.start}
                        className="pointer-events-none absolute inset-y-0 z-30 w-0.5 bg-primary"
                        style={{ left: drop.start * e.zoom }}
                      ></div>
                      <span
                        className="pointer-events-none absolute top-0 z-30 max-w-48 -translate-x-1/2 truncate rounded bg-primary px-2 py-1 text-[11px] text-primary-foreground"
                        style={{ left: drop.hint * e.zoom }}
                      >
                        {drop.label}
                      </span>
                    </>
                  )}
                </div>
              ))}
              <div
                className="timeline-playhead z-20! w-0.5! bg-primary shadow-[0_0_0_1px_var(--background)]"
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
