"use client";
import { useEffect, useState } from "react";

const storageKey = "blynta-studio:workspace:v7";
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
export function useWorkspaceLayout() {
  const [layout, setLayout] = useState({
    mediaWidth: 280,
    inspectorWidth: 300,
    aiWidth: 300,
    timelineHeight: 280,
    contextOpen: true,
    inspectorOpen: true,
  });
  const [viewport, setViewport] = useState({ width: 1440, height: 900 });
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      setViewport(viewport);
      const defaults = {
        mediaWidth: 280,
        inspectorWidth: 300,
        aiWidth: 300,
        timelineHeight: Math.max(180, Math.round(viewport.height * 0.34)),
        contextOpen: viewport.width >= 1100,
        inspectorOpen: viewport.width >= 980,
      };
      try {
        const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null");
        setLayout({
          aiWidth: Number.isFinite(saved?.aiWidth)
            ? clamp(saved.aiWidth, 280, 360)
            : 300,
          inspectorWidth: Number.isFinite(saved?.inspectorWidth)
            ? clamp(saved.inspectorWidth, 280, 360)
            : 300,
          mediaWidth: Number.isFinite(saved?.mediaWidth)
            ? clamp(saved.mediaWidth, 260, 330)
            : defaults.mediaWidth,
          timelineHeight: Number.isFinite(saved?.timelineHeight)
            ? clamp(
                saved.timelineHeight,
                180,
                Math.max(180, viewport.height - 340),
              )
            : defaults.timelineHeight,
          contextOpen:
            viewport.width >= 1100 && typeof saved?.contextOpen === "boolean"
              ? saved.contextOpen
              : defaults.contextOpen,
          inspectorOpen:
            viewport.width >= 980 && typeof saved?.inspectorOpen === "boolean"
              ? saved.inspectorOpen
              : defaults.inspectorOpen,
        });
      } catch {
        setLayout(defaults);
      }
      setReady(true);
    });
    const resize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
      setLayout((previous) => ({
        ...previous,
        contextOpen: window.innerWidth < 1100 ? false : previous.contextOpen,
        inspectorOpen: window.innerWidth < 980 ? false : previous.inspectorOpen,
      }));
    };
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(layout));
    } catch {
      /* Resizing still works without storage. */
    }
  }, [layout, ready]);
  const set = <K extends keyof typeof layout>(
    key: K,
    value: (typeof layout)[K],
  ) => setLayout((previous) => ({ ...previous, [key]: value }));
  const maxTimeline = Math.max(
    180,
    Math.min(viewport.height * 0.6, viewport.height - 340),
  );
  return {
    ...layout,
    timelineHeight: clamp(layout.timelineHeight, 180, maxTimeline),
    maxTimeline,
    setMediaWidth: (value: number) => set("mediaWidth", clamp(value, 260, 330)),
    setInspectorWidth: (value: number) =>
      set("inspectorWidth", clamp(value, 280, 360)),
    setAiWidth: (value: number) => set("aiWidth", clamp(value, 280, 360)),
    setTimelineHeight: (value: number) =>
      set("timelineHeight", clamp(value, 180, maxTimeline)),
    setContextOpen: (value: boolean) => set("contextOpen", value),
    setInspectorOpen: (value: boolean) => set("inspectorOpen", value),
  };
}
