"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
import { Film, Upload } from "lucide-react";
import { AppButton } from "@blynta/ui";
import { AppSelect } from "@blynta/ui";
import { PlayerControls } from "@blynta/ui/player";
import { AppSlider } from "@blynta/ui";
import { useEditorPlayback } from "../hooks/useEditor";
import { AppFileInput } from "@blynta/ui";
import { supportedMedia } from "@/features/studio/editor/media/supported-media";
import { useMediaUpload } from "../media/useMediaUpload";
import type { Clip, Asset } from "../../types";
function MediaLayer({
  clip,
  asset,
  muted,
  volume,
  factor,
  playhead,
}: {
  clip: Clip;
  asset?: Asset;
  muted: boolean;
  volume: number;
  factor: number;
  playhead: number;
}) {
  const e = useEditorPlayback();
  const ref = useRef<HTMLVideoElement & HTMLAudioElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const media = ref.current;
    if (!media || !asset?.src) return;
    const elapsed = Math.max(0, playhead - clip.start);
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
  }, [e.playing, playhead, clip, asset?.src, muted, volume]);
  const style = {
    opacity:
      (clip.opacity / 100) *
      (clip.fadeIn
        ? Math.min(
            1,
            Math.max(0, playhead - clip.start) /
              Math.min(clip.fadeIn, clip.duration),
          )
        : 1) *
      (clip.fadeOut
        ? Math.min(
            1,
            Math.max(0, clip.start + clip.duration - playhead) /
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
  const e = useEditorPlayback();
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    const update = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);
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
  // Keep the final frame visible while the transport rests at the project end.
  const previewTime =
    !e.playing && e.duration > 0 && e.playhead >= e.duration
      ? Math.max(0, e.duration - 1 / 30)
      : e.playhead;
  const active = e.doc.clips.filter(
    (c) =>
      previewTime >= c.start &&
      previewTime < c.start + c.duration &&
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
      <div
        className={`preview-stage ${zoom === "100" ? "actual-size" : ""}`}
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
                playhead={previewTime}
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
        accept={supportedMedia}
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
        <PlayerControls
          appearance="surface"
          className="studio-player-controls"
          disabled={!e.duration}
          isPlaying={e.playing}
          onTogglePlay={e.togglePlay}
          isMuted={muted}
          volume={volume / 100}
          onToggleMute={() => setMuted(!muted)}
          onVolumeChange={(event) =>
            setVolume(Number(event.target.value) * 100)
          }
          currentTime={e.playhead}
          duration={e.duration}
          isFullscreen={fullscreen}
          onPreviousFrame={() => e.seek(Math.max(0, e.playhead - 1 / 30))}
          onNextFrame={() => e.seek(Math.min(e.duration, e.playhead + 1 / 30))}
          onToggleFullscreen={() => {
            if (document.fullscreenElement) void document.exitFullscreen();
            else stage.current?.requestFullscreen().catch(() => {});
          }}
          actions={
            <>
              <AppSelect
                aria-label="Canvas aspect ratio"
                size="sm"
                wrapperClassName="w-32!"
                value={e.doc.ratio}
                onValueChange={(value) =>
                  e.edit((doc) => ({
                    ...doc,
                    ratio: value as typeof doc.ratio,
                  }))
                }
                options={["16:9", "9:16", "1:1", "4:5"].map((value) => ({
                  value,
                  label: `Canvas ${value}`,
                }))}
              />
              <AppSelect
                aria-label="Preview zoom"
                size="sm"
                wrapperClassName="w-20!"
                value={zoom}
                onValueChange={setZoom}
                options={[
                  { value: "fit", label: "Fit" },
                  { value: "100", label: "100%" },
                ]}
              />
            </>
          }
        />
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
