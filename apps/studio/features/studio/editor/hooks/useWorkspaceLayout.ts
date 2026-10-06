"use client";
import { useEffect, useState } from "react";

const storageKey = "blynta-studio:workspace:v6";
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
export function useWorkspaceLayout() {
  const [layout, setLayout] = useState({
    mediaWidth: 240,
    inspectorWidth: 280,
    aiWidth: 340,
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
        mediaWidth: 240,
        inspectorWidth: 280,
        aiWidth: 340,
        timelineHeight: Math.max(180, Math.round(viewport.height * 0.32)),
        contextOpen: viewport.width >= 1100,
        inspectorOpen: viewport.width >= 980,
      };
      try {
        const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null");
        setLayout({
          aiWidth: Number.isFinite(saved?.aiWidth)
            ? clamp(saved.aiWidth, 320, 400)
            : 340,
          inspectorWidth: Number.isFinite(saved?.inspectorWidth)
            ? clamp(saved.inspectorWidth, 260, 340)
            : 280,
          mediaWidth: Number.isFinite(saved?.mediaWidth)
            ? clamp(saved.mediaWidth, 240, 320)
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
    setMediaWidth: (value: number) => set("mediaWidth", clamp(value, 240, 320)),
    setInspectorWidth: (value: number) =>
      set("inspectorWidth", clamp(value, 260, 340)),
    setAiWidth: (value: number) => set("aiWidth", clamp(value, 320, 400)),
    setTimelineHeight: (value: number) =>
      set("timelineHeight", clamp(value, 180, maxTimeline)),
    setContextOpen: (value: boolean) => set("contextOpen", value),
    setInspectorOpen: (value: boolean) => set("inspectorOpen", value),
  };
}
