import type { Asset, Clip, Track } from "../types";
export const defaultTracks: Track[] = [
  {
    id: "overlay",
    name: "Video 2",
    kind: "video",
    muted: false,
    hidden: false,
  },
  { id: "video", name: "Video 1", kind: "video", muted: false, hidden: false },
  { id: "text", name: "Text", kind: "text", muted: false, hidden: false },
  { id: "audio", name: "Audio", kind: "audio", muted: false, hidden: false },
];
export function makeClip(asset: Asset, start = 0, trackId?: string): Clip {
  return {
    id: crypto.randomUUID(),
    assetId: asset.id,
    name: asset.name,
    kind: asset.kind,
    start,
    duration: Math.min(asset.duration || 5, Math.max(0.01, 3600 - start)),
    offset: 0,
    trackId:
      trackId ||
      (asset.kind === "audio"
        ? "audio"
        : asset.kind === "text"
          ? "text"
          : "video"),
    opacity: 100,
    scale: 100,
    rotation: 0,
    volume: 80,
    speed: 1,
    x: 0,
    y: 0,
    fontFamily: "Arial",
    fontWeight: 700,
    fontSize: 34,
    color: "#ffffff",
    fadeIn: 0,
    fadeOut: 0,
    fit: "contain",
  };
}
