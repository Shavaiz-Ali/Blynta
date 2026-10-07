"use client";
import { memo } from "react";
import { useRef, useState, useSyncExternalStore } from "react";
import { Film, Type, AudioLines, Image as ImageIcon } from "lucide-react";
import { AppContextMenu } from "@blynta/ui";
import { splitClip } from "../stores/editor-store";
import { useEditor } from "../hooks/useEditor";
import type { Clip } from "../../types";
const idleSubscription = () => () => {};
export const TimelineClip = memo(function TimelineClip({
  clip,
}: {
  clip: Clip;
}) {
  const e = useEditor();
  const [menuOpen, setMenuOpen] = useState(false);
  useSyncExternalStore(
    menuOpen ? e.playback.subscribe : idleSubscription,
    e.playback.getSnapshot,
    e.playback.getSnapshot,
  );
  const [draft, setDraft] = useState<Clip | null>(null);
  const gesture = useRef<{
    x: number;
    mode: "move" | "left" | "right";
    original: Clip;
    final: Clip;
  } | null>(null);
  const current = draft || clip;
  const locked = !!e.doc.tracks.find((t) => t.id === clip.trackId)?.locked;
  const asset = e.doc.assets.find((a) => a.id === clip.assetId);
  const [snapped, setSnapped] = useState(false);
  const Icon =
    clip.kind === "text"
      ? Type
      : clip.kind === "audio"
        ? AudioLines
        : clip.kind === "image"
          ? ImageIcon
          : Film;
  function start(event: React.PointerEvent, mode: "move" | "left" | "right") {
    if (event.button !== 0) return;
    if (locked) {
      e.select(clip.id);
      return;
    }
    event.stopPropagation();
    e.select(clip.id);
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = { x: event.clientX, mode, original: clip, final: clip };
  }
  function move(event: React.PointerEvent) {
    const g = gesture.current;
    if (!g) return;
    const c = g.original;
    let delta = (event.clientX - g.x) / e.zoom;
    if (e.snapping) delta = Math.round(delta * 2) / 2;
    const source = e.doc.assets.find((a) => a.id === c.assetId);
    const sourceRemaining =
      source && c.kind !== "text" && c.kind !== "image"
        ? (source.duration - c.offset) / c.speed
        : Infinity;
    let next = { ...c };
    if (g.mode === "move") {
      let at = Math.max(0, c.start + delta);
      if (e.snapping) {
        const points = [
          e.playhead,
          ...e.doc.clips
            .filter((other) => other.id !== c.id)
            .flatMap((other) => [other.start, other.start + other.duration]),
        ];
        const snap = points.find((p) => Math.abs(p - at) < 6 / e.zoom);
        if (snap !== undefined) {
          at = snap;
          setSnapped(true);
        }
      }
      next.start = at;
    } else if (g.mode === "left") {
      delta = Math.max(
        -c.start,
        -c.offset / c.speed,
        Math.min(c.duration - 0.2, delta),
      );
      next = {
        ...c,
        start: c.start + delta,
        duration: c.duration - delta,
        offset: c.offset + delta * c.speed,
      };
    } else
      next.duration = Math.max(
        0.2,
        Math.min(sourceRemaining, c.duration + delta),
      );
    g.final = next;
    setDraft(next);
  }
  function finish() {
    const g = gesture.current;
    if (!g) return;
    e.patch(clip.id, g.final);
    gesture.current = null;
    setDraft(null);
    setSnapped(false);
  }
  return (
    <AppContextMenu
      onOpenChange={setMenuOpen}
      items={[
        {
          label: "Split at playhead",
          disabled:
            locked ||
            e.playhead <= clip.start + 0.1 ||
            e.playhead >= clip.start + clip.duration - 0.1,
          onClick: () => e.edit((d) => splitClip(d, clip.id, e.playhead)),
        },
        {
          label: "Duplicate clip",
          disabled: locked,
          onClick: () =>
            e.edit((d) => ({
              ...d,
              clips: [
                ...d.clips,
                {
                  ...clip,
                  id: crypto.randomUUID(),
                  start: clip.start + clip.duration,
                },
              ],
            })),
        },
        {
          label: "Delete clip",
          disabled: locked,
          destructive: true,
          separatorBefore: true,
          onClick: () =>
            e.edit((d) => ({
              ...d,
              clips: d.clips.filter((c) => c.id !== clip.id),
            })),
        },
      ]}
    >
      <div
        role="button"
        tabIndex={0}
        aria-label={`${clip.name}, starts at ${clip.start.toFixed(1)} seconds, duration ${clip.duration.toFixed(1)} seconds`}
        aria-pressed={e.selectedId === clip.id}
        className={`timeline-clip group/clip top-1.5! h-[52px]! rounded-md! px-2! py-2! text-xs! [container-type:inline-size] focus-visible:ring-2 focus-visible:ring-ring clip-${clip.kind} ${e.selectedId === clip.id ? "selected" : ""} ${draft ? "dragging" : ""} ${snapped ? "snapped" : ""}`}
        style={{
          left: current.start * e.zoom,
          width: Math.max(12, current.duration * e.zoom),
        }}
        onClick={(v) => {
          v.stopPropagation();
          e.select(clip.id);
        }}
        onKeyDown={(v) => {
          if (v.key === "Enter" || v.key === " ") {
            v.preventDefault();
            e.select(clip.id);
            if (v.key === " ") e.togglePlay();
          }
        }}
        onPointerDown={(v) => start(v, "move")}
        onPointerMove={move}
        onPointerUp={finish}
        onPointerCancel={() => {
          gesture.current = null;
          setDraft(null);
          setSnapped(false);
        }}
      >
        <span
          className="trim-handle left w-2! bg-foreground/20! focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-ring"
          role="button"
          tabIndex={0}
          aria-label="Trim clip start"
          onPointerDown={(v) => start(v, "left")}
          onPointerMove={move}
          onPointerUp={finish}
          onKeyDown={(v) => {
            if (v.key === "ArrowRight" && clip.duration > 0.7) {
              v.preventDefault();
              v.stopPropagation();
              e.patch(clip.id, {
                start: clip.start + 0.5,
                duration: clip.duration - 0.5,
                offset: clip.offset + 0.5 * clip.speed,
              });
            }
          }}
        />
        {(clip.kind === "video" || clip.kind === "image") && (
          <span
            className={`clip-filmstrip opacity-70! ${asset?.origin === "Blynta demo" ? "demo-filmstrip" : ""}`}
            aria-hidden="true"
          >
            {asset?.thumbnail && clip.kind === "video" && (
              <span style={{ backgroundImage: `url("${asset.thumbnail}")` }} />
            )}
            {asset?.src && clip.kind === "image" && (
              <span style={{ backgroundImage: `url("${asset.src}")` }} />
            )}
          </span>
        )}
        <Icon className="clip-kind-icon size-3.5 shrink-0" />
        <span className="clip-caption min-w-0 truncate leading-4">
          {clip.name}
        </span>
        <span className="clip-duration text-[11px]! tabular-nums [@container(max-width:100px)]:hidden">
          {current.duration.toFixed(1)}s
        </span>
        <span
          className="trim-handle right w-2! bg-foreground/20! focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-ring"
          role="button"
          tabIndex={0}
          aria-label="Trim clip end"
          onPointerDown={(v) => start(v, "right")}
          onPointerMove={move}
          onPointerUp={finish}
          onKeyDown={(v) => {
            if (v.key === "ArrowLeft" && clip.duration > 0.7) {
              v.preventDefault();
              v.stopPropagation();
              e.patch(clip.id, { duration: clip.duration - 0.5 });
            }
          }}
        />
        {draft && (
          <span className="sr-only" role="status">
            {snapped ? "Snapped. " : ""}Position {current.start.toFixed(1)}{" "}
            seconds; duration {current.duration.toFixed(1)} seconds.
          </span>
        )}
      </div>
    </AppContextMenu>
  );
});
