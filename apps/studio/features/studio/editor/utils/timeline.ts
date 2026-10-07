import type { Asset, EditorDocument, Track } from "../../types";

export const assetDragType = "application/blynta-asset";

export function mediaUnavailable(asset: Asset): string | undefined {
  if (asset.status && asset.status !== "ready")
    return asset.error || `Media ${asset.status}`;
  if (asset.kind !== "text" && asset.origin !== "Blynta demo" && !asset.src)
    return "Media unavailable. Refresh access or reattach the file.";
  if (
    ["video", "audio"].includes(asset.kind) &&
    (!Number.isFinite(asset.duration) || asset.duration <= 0)
  )
    return "Waiting for media duration";
}

export function timelineTime(
  clientX: number,
  contentLeft: number,
  pixelsPerSecond: number,
) {
  return Math.max(0, (clientX - contentLeft) / pixelsPerSecond);
}

export function compatibleTrack(asset: Asset, track: Track) {
  return (
    track.kind === asset.kind ||
    (asset.kind === "image" && track.kind === "video")
  );
}

/** Place additions after intersecting clips, preserving all existing content. */
export function assetPlacement(
  doc: EditorDocument,
  asset: Asset,
  requested: number,
  trackId?: string,
) {
  if (
    mediaUnavailable(asset) ||
    !Number.isFinite(requested) ||
    doc.clips.length >= 150
  )
    return;
  if (
    !doc.assets.some((saved) => saved.id === asset.id) &&
    doc.assets.length >= 200
  )
    return;
  const target = doc.tracks.find((track) => track.id === trackId);
  if (target?.locked) return;
  const kind = asset.kind === "image" ? "video" : asset.kind;
  const track =
    target && compatibleTrack(asset, target)
      ? target
      : (doc.tracks.find(
          (item) =>
            item.id === kind && !item.locked && compatibleTrack(asset, item),
        ) ??
        doc.tracks.find(
          (item) => !item.locked && compatibleTrack(asset, item),
        ));
  // A new track is needed only when the media kind has no existing track.
  if (!track && doc.tracks.some((item) => compatibleTrack(asset, item))) return;
  if (!track && doc.tracks.length >= 20) return;
  const resolved: Track = track ?? {
    id: doc.tracks.some((item) => item.id === kind)
      ? crypto.randomUUID()
      : kind,
    name: kind === "video" ? "Video 1" : kind === "audio" ? "Audio 1" : "Text",
    kind,
    muted: false,
    hidden: false,
  };
  const duration =
    asset.kind === "image" || asset.kind === "text"
      ? asset.duration || 5
      : asset.duration;
  if (!Number.isFinite(duration) || duration < 0.01) return;
  let start = Math.max(0, requested);
  for (const clip of doc.clips
    .filter((item) => asset.kind !== "text" && item.trackId === resolved.id)
    .sort((a, b) => a.start - b.start)) {
    if (
      start < clip.start + clip.duration - 0.0001 &&
      start + duration > clip.start + 0.0001
    )
      start = clip.start + clip.duration;
  }
  if (start + duration > 3600) return;
  return { track: resolved, start, duration };
}
