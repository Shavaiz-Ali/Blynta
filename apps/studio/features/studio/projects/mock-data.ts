import type { Asset, Clip, Project } from "../types";
export const mockAssets: Asset[] = [
  {
    id: "main",
    sourceGroup: "Original source",
    name: "Northern light · original",
    kind: "video",
    duration: 48,
    origin: "Blynta demo",
  },
  {
    id: "clip-one",
    sourceGroup: "Generated clips",
    name: "The quiet moments · clip 01",
    kind: "video",
    duration: 12,
    origin: "Blynta demo",
  },
  {
    id: "clip-two",
    sourceGroup: "Generated clips",
    name: "A different perspective · clip 02",
    kind: "video",
    duration: 18,
    origin: "Blynta demo",
  },
  {
    id: "music",
    sourceGroup: "Audio",
    name: "Slow mornings · ambient",
    kind: "audio",
    duration: 48,
    origin: "Blynta demo",
  },
];
export { defaultTracks, makeClip } from "./document";
import { defaultTracks } from "./document";
const clip = (
  id: string,
  assetId: string,
  kind: Clip["kind"],
  name: string,
  trackId: string,
  start: number,
  duration: number,
): Clip => ({
  id,
  assetId,
  kind,
  name,
  trackId,
  start,
  duration,
  offset: 0,
  opacity: 100,
  scale: 100,
  rotation: 0,
  volume: kind === "audio" ? 30 : 80,
  speed: 1,
  x: 0,
  y: 0,
  fontSize: 34,
  color: "#ffffff",
  fadeIn: 0,
  fadeOut: 0,
  fit: "contain",
});
export function mockProjects(): Project[] {
  return [
    {
      id: "northern-light",
      name: "Northern light",
      ratio: "16:9",
      updatedAt: "2026-10-01T12:00:00.000Z",
      assets: mockAssets,
      tracks: defaultTracks,
      demo: true,
      clips: [
        clip(
          "v1",
          "main",
          "video",
          "Northern light · original",
          "video",
          0,
          32,
        ),
        clip("v2", "clip-one", "video", "The quiet moments", "overlay", 16, 8),
        clip(
          "t1",
          "title",
          "text",
          "A little further from ordinary.",
          "text",
          2,
          8,
        ),
        clip("a1", "music", "audio", "Slow mornings", "audio", 0, 32),
      ],
    },
    {
      id: "quiet-moments",
      name: "The quiet moments",
      ratio: "9:16",
      updatedAt: "2026-09-30T12:00:00.000Z",
      assets: mockAssets,
      tracks: defaultTracks,
      demo: true,
      clips: [
        clip("v3", "clip-one", "video", "The quiet moments", "video", 0, 12),
      ],
    },
  ];
}
