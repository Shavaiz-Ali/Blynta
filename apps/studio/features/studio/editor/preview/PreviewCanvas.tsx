"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Maximize,
  Film,
  Upload,
} from "lucide-react";
import { AppButton } from "@blynta/ui";
import { AppSelect } from "@blynta/ui";
import { AppPopover } from "@blynta/ui";
import { AppSlider } from "@/components/common/AppSlider";
import { AppTooltip } from "@/components/common/AppTooltip";
import { useEditor } from "../hooks/useEditor";
import { formatTime } from "../utils/time";
import { AppFileInput } from "@/components/common/AppFileInput";
import { useMediaUpload } from "../media/useMediaUpload";
import type { Clip, Asset } from "../../types";
function MediaLayer({
  clip,
  asset,
  muted,
  volume,
  factor,
}: {
  clip: Clip;
  asset?: Asset;
  muted: boolean;
  volume: number;
  factor: number;
}) {
  const e = useEditor();
  const ref = useRef<HTMLVideoElement & HTMLAudioElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const media = ref.current;
    if (!media || !asset?.src) return;
    const elapsed = Math.max(0, e.playhead - clip.start);
    const fadeIn =
      clip.fadeIn > 0
        ? Math.min(1, elapsed / Math.min(clip.fadeIn, clip.duration))
        : 1;
    const fadeOut =
      clip.fadeOut > 0
        ? Math.min(
            1,
            (clip.duration - elapsed) / Math.min(clip.fadeOut, clip.duration),
          )
        : 1;
    media.volume = muted
      ? 0
      : Math.max(
          0,
          (((volume / 100) * clip.volume) / 100) * (fadeIn * fadeOut),
        );
    media.playbackRate = clip.speed;
    const time = clip.offset + elapsed * clip.speed;
    if (!e.playing || Math.abs(media.currentTime - time) > 0.35)
      media.currentTime = time;
    if (e.playing) media.play().catch(() => setFailed(true));
    else media.pause();
  }, [e.playing, e.playhead, clip, asset?.src, muted, volume]);
  const style = {
    opacity:
      (clip.opacity / 100) *
      (clip.fadeIn
        ? Math.min(
            1,
            Math.max(0, e.playhead - clip.start) /
              Math.min(clip.fadeIn, clip.duration),
          )
        : 1) *
      (clip.fadeOut
        ? Math.min(
            1,
            Math.max(0, clip.start + clip.duration - e.playhead) /
              Math.min(clip.fadeOut, clip.duration),
          )
        : 1),
    transform: `translate(${clip.x * factor}px, ${clip.y * factor}px) scale(${clip.scale / 100}) rotate(${clip.rotation}deg)`,
    objectFit: clip.fit,
  };
  if (clip.kind === "audio")
    return asset?.src ? (
      <audio ref={ref} src={asset.src} onError={() => setFailed(true)} />
    ) : null;
  if (clip.kind === "text")
    return (
      <div className="preview-media" style={style}>
        <AppButton
          variant="ghost"
          className={`preview-text ${e.selectedId === clip.id ? "selected-text" : ""}`}
          onClick={() => e.select(clip.id)}
          style={{
            fontSize: clip.fontSize * factor,
            color: clip.color,
            fontFamily: clip.fontFamily ?? "Arial",
            fontWeight: clip.fontWeight ?? 700,
            textAlign: clip.textAlign ?? "center",
            letterSpacing: clip.letterSpacing ?? 0,
          }}
        >
          {clip.name}
        </AppButton>
      </div>
    );
  if (asset?.src && !failed)
    return clip.kind === "image" ? (
      <Image
        loading="eager"
        alt={asset.name}
        src={asset.src}
        fill
        unoptimized
        className="preview-media"
        style={style}
        onError={() => setFailed(true)}
      />
    ) : (
      <video
        ref={ref}
        src={asset.src}
        className="preview-media"
        style={style}
        playsInline
        onError={() => setFailed(true)}
      />
    );
  if (asset?.origin === "Upload" || failed)
    return (
      <div className="preview-missing">
        <Film size={28} />
        <p>{failed ? "Unable to play this file" : "Media unavailable"}</p>
        <span>Open Media to refresh access or replace the file.</span>
      </div>
    );
  return (
    <div className="demo-scene preview-media" style={style}>
      <span className="demo-label">BLYNTA SAMPLE · VISUAL PLACEHOLDER</span>
    </div>
  );
}
export function PreviewCanvas() {
  const e = useEditor();
  const uploadFile = useRef<HTMLInputElement>(null);
  const { upload, busy, error } = useMediaUpload();
  const stage = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const [factor, setFactor] = useState(1);
  useEffect(() => {
    if (!frame.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setFactor(entry.contentRect.height / 720),
    );
    observer.observe(frame.current);
    return () => observer.disconnect();
  }, []);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(100);
  const [zoom, setZoom] = useState("fit");
  const active = e.doc.clips.filter(
    (c) =>
      e.playhead >= c.start &&
      e.playhead < c.start + c.duration &&
      !e.doc.tracks.find((t) => t.id === c.trackId)?.hidden,
  );
  // Track order defines visual stacking; the top track is painted last.
  active.sort(
    (a, b) =>
      e.doc.tracks.findIndex((t) => t.id === b.trackId) -
      e.doc.tracks.findIndex((t) => t.id === a.trackId),
  );
  const [w, h] = e.doc.ratio.split(":").map(Number);
  return (
    <section className="preview-area" aria-label="Video preview">
      <div className="preview-heading">
        <div className="preview-title">
          <span>Project preview</span>
          <span className="preview-project-name">{e.doc.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <AppSelect
            aria-label="Canvas aspect ratio"
            size="sm"
            wrapperClassName="w-24!"
            value={e.doc.ratio}
            onValueChange={(v) =>
              e.edit((d) => ({ ...d, ratio: v as typeof d.ratio }))
            }
            options={["16:9", "9:16", "1:1", "4:5"].map((value) => ({
              value,
              label: value,
            }))}
          />
        </div>
      </div>
      <div
        className={`preview-stage ${zoom === "100" ? "actual-size" : ""} ${zoom === "fill" ? "fill-size" : ""}`}
        ref={stage}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const file = event.dataTransfer.files[0];
          if (file) {
            void upload(file, true);
            return;
          }
          const asset = e.doc.assets.find(
            (item) =>
              item.id ===
              event.dataTransfer.getData("application/blynta-asset"),
          );
          if (asset) e.add(asset);
        }}
      >
        <div
          ref={frame}
          className={`preview-frame ${active.length ? "" : "preview-frame-empty"}`}
          style={
            {
              aspectRatio: `${w}/${h}`,
              "--frame-ratio": w / h,

              width: zoom === "100" ? `${(720 * w) / h}px` : undefined,
            } as CSSProperties
          }
        >
          {active.length ? (
            active.map((c) => (
              <MediaLayer
                key={c.id}
                clip={c}
                asset={e.doc.assets.find((a) => a.id === c.assetId)}
                muted={
                  muted || !!e.doc.tracks.find((t) => t.id === c.trackId)?.muted
                }
                volume={volume}
                factor={factor}
              />
            ))
          ) : (
            <div className="preview-missing">
              {e.duration ? (
                <Film size={28} />
              ) : (
                <AppButton
                  size="lg"
                  aria-label="Upload media to canvas"
                  isLoading={busy}
                  onClick={() => uploadFile.current?.click()}
                >
                  <Upload />
                  Upload media
                </AppButton>
              )}
              <p>
                {e.duration
                  ? "No clip at the playhead"
                  : "Start with your footage"}
              </p>
              <span>
                {e.duration
                  ? "Seek to a clip to preview it."
                  : "Drop a file here or add media from your library."}
              </span>
            </div>
          )}
        </div>
      </div>
      <AppFileInput
        ref={uploadFile}
        label="Upload media to canvas"
        disabled={busy}
        onFile={(file) => upload(file, true)}
      />
      {error && (
        <p role="alert" className="canvas-upload-status text-destructive">
          {error}
        </p>
      )}
      <div className="preview-controls">
        <div className="playback-controls">
          <div className="flex items-center gap-1">
            <AppTooltip content="Previous frame">
              <AppButton
                size="icon-sm"
                variant="ghost"
                aria-label="Previous frame"
                onClick={() => {
                  e.seek(Math.max(0, e.playhead - 1 / 30));
                }}
              >
                <SkipBack />
              </AppButton>
            </AppTooltip>
            <AppTooltip content="Play / pause · Space">
              <AppButton
                size="icon"
                variant="secondary"
                disabled={!e.duration}
                aria-label={e.playing ? "Pause" : "Play"}
                onClick={e.togglePlay}
              >
                {e.playing ? <Pause /> : <Play />}
              </AppButton>
            </AppTooltip>
            <AppTooltip content="Next frame">
              <AppButton
                size="icon-sm"
                variant="ghost"
                aria-label="Next frame"
                onClick={() =>
                  e.seek(Math.min(e.duration, e.playhead + 1 / 30))
                }
              >
                <SkipForward />
              </AppButton>
            </AppTooltip>
          </div>
          <span className="time-display">
            {formatTime(e.playhead)}{" "}
            <span className="text-muted-foreground">
              / {formatTime(e.duration)}
            </span>
          </span>
          <div className="flex gap-2 items-center">
            <AppPopover
              title="Preview volume"
              trigger={
                <AppButton
                  variant="ghost"
                  size="icon-sm"
                  title="Preview volume"
                  aria-label="Preview volume"
                >
                  {muted ? <VolumeX /> : <Volume2 />}
                </AppButton>
              }
            >
              <div className="flex items-center gap-3 mt-4">
                <AppButton
                  variant="ghost"
                  size="icon-sm"
                  aria-label={muted ? "Unmute preview" : "Mute preview"}
                  onClick={() => setMuted(!muted)}
                >
                  {muted ? <VolumeX /> : <Volume2 />}
                </AppButton>
                <AppSlider
                  label="Preview volume level"
                  value={volume}
                  onValueChange={setVolume}
                />
                <span className="text-xs">{volume}%</span>
              </div>
            </AppPopover>
            <AppSelect
              aria-label="Preview zoom"
              size="sm"
              wrapperClassName="w-20!"
              value={zoom}
              onValueChange={setZoom}
              options={[
                { value: "fit", label: "Fit" },
                { value: "100", label: "100%" },
                { value: "fill", label: "Fill" },
              ]}
            />
            <AppTooltip content="Fullscreen preview">
              <AppButton
                variant="ghost"
                size="icon-sm"
                aria-label="Fullscreen preview"
                onClick={() => {
                  if (document.fullscreenElement) document.exitFullscreen();
                  else stage.current?.requestFullscreen().catch(() => {});
                }}
              >
                <Maximize />
              </AppButton>
            </AppTooltip>
          </div>
        </div>
        <AppSlider
          label="Seek preview"
          className="preview-seek"
          value={e.playhead}
          min={0}
          max={e.duration || 1}
          step={1 / 30}
          disabled={!e.duration}
          onValueChange={e.seek}
        />
      </div>
    </section>
  );
}
