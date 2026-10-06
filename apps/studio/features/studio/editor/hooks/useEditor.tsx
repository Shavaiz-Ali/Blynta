"use client";
import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import {
  editorReducer,
  patchClip,
  splitClip,
  addAsset,
} from "../stores/editor-store";
import type { Project, EditorDocument, Asset, Clip } from "../../types";
import { useWorkspaceLayout } from "./useWorkspaceLayout";
import { studioApi, studioKeys } from "../../api";
import { SaveSession } from "../stores/save-session";
import { useQuery } from "@tanstack/react-query";
import { PlaybackClock } from "../stores/playback-clock";
export function useEditorState(project: Project, userId: string) {
  const [history, dispatch] = useReducer(editorReducer, {
    past: [],
    present: {
      name: project.name,
      ratio: project.ratio,
      assets: project.assets,
      clips: project.clips,
      tracks: project.tracks,
    },
    future: [],
  });
  const media = useQuery({
    queryKey: studioKeys.assets(project.id, userId),
    queryFn: () => studioApi.assets(project.id),
    refetchInterval: (query) =>
      query.state.data?.some(
        (a) =>
          a.status === "processing" ||
          ["queued", "processing"].includes(a.transcriptStatus || ""),
      )
        ? 3000
        : 25 * 60 * 1000,
  });
  const doc = useMemo(
    () => ({
      ...history.present,
      assets: history.present.assets.map((a) => ({
        ...a,
        ...media.data?.find((m) => m.id === a.id),
        name: a.name,
      })),
    }),
    [history.present, media.data],
  );
  const [selectedId, select] = useState<string | null>(null);
  const [playback] = useState(() => new PlaybackClock());
  const seek = playback.seek;
  const layout = useWorkspaceLayout();
  const [tool, setTool] = useState("Media");
  const [aiOpen, setAiOpen] = useState(
    () =>
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("ai") === "1",
  );
  const [zoom, setZoom] = useState(18);
  const [snapping, setSnapping] = useState(true);
  const [showAllTracks, setShowAllTracks] = useState(false);
  const mainTrack =
    doc.tracks.find((track) => track.id === "video") ??
    doc.tracks.find((track) => track.kind === "video") ??
    doc.tracks[0];
  const visibleTracks = showAllTracks
    ? doc.tracks
    : doc.tracks.filter(
        (track) =>
          track.id === mainTrack?.id ||
          doc.clips.some((clip) => clip.trackId === track.id),
      );
  const [saveSession] = useState(
    () =>
      new SaveSession(
        history.present,
        project.revision || 0,
        (revision, document) => studioApi.save(project.id, revision, document),
      ),
  );
  const [saveState, setSaveState] = useState("Saved");
  const duration = Math.max(0, ...doc.clips.map((c) => c.start + c.duration));
  const selected = doc.clips.find((c) => c.id === selectedId);
  const edit = (apply: (d: EditorDocument) => EditorDocument) =>
    dispatch({ type: "edit", apply });
  useEffect(() => {
    return saveSession.subscribe(() => setSaveState(saveSession.status));
  }, [saveSession]);
  useEffect(() => {
    saveSession.enqueue(history.present);
  }, [history.present, saveSession]);
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => {
      if (saveSession.dirty) {
        event.preventDefault();
      }
    };
    window.addEventListener("beforeunload", unload);
    return () => {
      window.removeEventListener("beforeunload", unload);
      void saveSession.flush().catch(() => {});
    };
  }, [saveSession]);
  useEffect(() => {
    playback.setDuration(duration);
  }, [playback, duration]);
  useEffect(() => () => playback.stop(), [playback]);
  useEffect(() => {
    function keydown(e: KeyboardEvent) {
      if (e.defaultPrevented || e.isComposing || e.altKey) return;
      const target = e.target as HTMLElement;
      if (
        target.closest(
          "input, textarea, select, [contenteditable]:not([contenteditable=false]), [role=dialog], [role=combobox], [role=listbox], [role=menu], [role=textbox], [role=slider], [role=separator]",
        )
      )
        return;
      const modifier = e.ctrlKey || e.metaKey;
      if (modifier && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setAiOpen((v) => !v);
      } else if (modifier && e.key.toLowerCase() === "z") {
        e.preventDefault();
        dispatch({ type: e.shiftKey ? "redo" : "undo" });
      } else if (
        e.code === "Space" &&
        !target.closest("button, a, [role=button]")
      ) {
        e.preventDefault();
        if (duration) {
          playback.toggle();
        }
      } else if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedId &&
        !doc.tracks.find(
          (t) => t.id === doc.clips.find((c) => c.id === selectedId)?.trackId,
        )?.locked
      ) {
        e.preventDefault();
        dispatch({
          type: "edit",
          apply: (d) => ({
            ...d,
            clips: d.clips.filter((c) => c.id !== selectedId),
          }),
        });
        select(null);
      } else if (e.key === "Escape") {
        setAiOpen(false);
        select(null);
      } else if (!modifier && e.key.toLowerCase() === "s" && selectedId) {
        e.preventDefault();
        dispatch({
          type: "edit",
          apply: (d) =>
            splitClip(d, selectedId, playback.getSnapshot().playhead),
        });
      }
    }
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [selectedId, duration, doc, playback]);
  const togglePlay = playback.toggle;
  return {
    projectId: project.id,
    userId,
    flushSave: () => saveSession.flush(),
    retrySave: () => saveSession.retry(),
    refreshMedia: () => media.refetch(),
    mediaStatus: media.data || [],
    mediaError: media.error?.message,
    doc,
    history,
    edit,
    selected,
    selectedId,
    selectedTrackId: selected?.trackId ?? null,
    select: (id: string | null) => {
      select(id);
      if (id) {
        layout.setInspectorOpen(true);
        if (window.innerWidth < 1180) layout.setContextOpen(false);
      }
    },
    playback,
    get playhead() {
      return playback.getSnapshot().playhead;
    },
    seek,
    get playing() {
      return playback.getSnapshot().playing;
    },
    togglePlay,
    duration,
    ...layout,
    tool,
    setTool,
    aiOpen,
    setAiOpen,
    zoom,
    setZoom,
    snapping,
    setSnapping,
    showAllTracks,
    setShowAllTracks,
    visibleTracks,
    saveState,
    undo: () => dispatch({ type: "undo" }),
    redo: () => dispatch({ type: "redo" }),
    patch: (id: string, patch: Partial<Clip>) =>
      edit((d) => patchClip(d, id, patch)),
    remove: () => {
      if (doc.tracks.find((t) => t.id === selected?.trackId)?.locked) return;
      edit((d) => ({
        ...d,
        clips: d.clips.filter((c) => c.id !== selectedId),
      }));
      select(null);
    },
    duplicate: () => {
      if (
        selected &&
        !doc.tracks.find((t) => t.id === selected.trackId)?.locked
      )
        edit((d) => ({
          ...d,
          clips: [
            ...d.clips,
            {
              ...selected,
              id: crypto.randomUUID(),
              start: selected.start + selected.duration,
            },
          ],
        }));
    },
    split: () => {
      if (selectedId)
        edit((d) => splitClip(d, selectedId, playback.getSnapshot().playhead));
    },
    add: (
      asset: Asset,
      start = playback.getSnapshot().playhead,
      trackId?: string,
    ) => edit((d) => addAsset(d, asset, start, trackId)),
  };
}
type Editor = ReturnType<typeof useEditorState>;
export const EditorContext = createContext<Editor | null>(null);
export function useEditor() {
  const editor = useContext(EditorContext);
  if (!editor) throw new Error("Editor components require EditorContext");
  return editor;
}

export function useEditorPlayback() {
  const editor = useEditor();
  const snapshot = useSyncExternalStore(
    editor.playback.subscribe,
    editor.playback.getSnapshot,
    editor.playback.getSnapshot,
  );
  return { ...editor, ...snapshot };
}
