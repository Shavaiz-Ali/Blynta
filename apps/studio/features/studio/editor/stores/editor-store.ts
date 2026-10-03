import type { EditorDocument, Clip, Asset, AIAction } from "../../types";
import { makeClip } from "../../projects/document";
export interface History {
  past: EditorDocument[];
  present: EditorDocument;
  future: EditorDocument[];
}
export type EditorAction =
  | { type: "edit"; apply: (doc: EditorDocument) => EditorDocument }
  | { type: "undo" }
  | { type: "redo" };
export function editorReducer(state: History, action: EditorAction): History {
  if (action.type === "undo") {
    const previous = state.past.at(-1);
    return previous
      ? {
          past: state.past.slice(0, -1),
          present: previous,
          future: [state.present, ...state.future],
        }
      : state;
  }
  if (action.type === "redo") {
    const next = state.future[0];
    return next
      ? {
          past: [...state.past, state.present],
          present: next,
          future: state.future.slice(1),
        }
      : state;
  }
  const next = action.apply(state.present);
  if (JSON.stringify(next) === JSON.stringify(state.present)) return state;
  return {
    past: [...state.past.slice(-49), state.present],
    present: next,
    future: [],
  };
}
export function patchClip(
  doc: EditorDocument,
  id: string,
  patch: Partial<Clip>,
): EditorDocument {
  if (
    doc.tracks.find((t) => t.id === doc.clips.find((c) => c.id === id)?.trackId)
      ?.locked
  )
    return doc;
  return {
    ...doc,
    clips: doc.clips.map((c) => {
      if (c.id !== id) return c;
      const next = { ...c, ...patch };
      const asset = doc.assets.find((a) => a.id === c.assetId);
      if (asset && !['image', 'text'].includes(c.kind)) next.duration = Math.min(next.duration, Math.max(0.01, (asset.duration - next.offset) / next.speed));
      return next;
    }),
  };
}
export function splitClip(
  doc: EditorDocument,
  id: string,
  at: number,
): EditorDocument {
  const c = doc.clips.find((c) => c.id === id);
  if (
    !c ||
    doc.tracks.find((t) => t.id === c.trackId)?.locked ||
    at <= c.start + 0.1 ||
    at >= c.start + c.duration - 0.1
  )
    return doc;
  return {
    ...doc,
    clips: doc.clips.flatMap((clip) =>
      clip.id !== id
        ? [clip]
        : [
            { ...clip, duration: at - clip.start },
            {
              ...clip,
              id: crypto.randomUUID(),
              start: at,
              offset: clip.offset + (at - clip.start) * clip.speed,
              duration: clip.start + clip.duration - at,
            },
          ],
    ),
  };
}
export function addAsset(
  doc: EditorDocument,
  asset: Asset,
  start = 0,
  trackId?: string,
): EditorDocument {
  const clip = makeClip(asset, start, trackId);
  if (doc.tracks.find((t) => t.id === clip.trackId)?.locked) return doc;
  return {
    ...doc,
    assets: doc.assets.some((a) => a.id === asset.id)
      ? doc.assets
      : [...doc.assets, asset],
    clips: [...doc.clips, clip],
  };
}
export function applyAIActions(
  doc: EditorDocument,
  actions: AIAction[],
): EditorDocument {
  const locked = new Set(doc.tracks.filter((t) => t.locked).map((t) => t.id));
  const touchesLocked = actions.some((action) =>
    action.type === "captions"
      ? locked.has("text")
      : action.type === "ratio"
        ? false
        : doc.clips.some(
            (c) =>
              locked.has(c.trackId) &&
              (action.targetClipId
                ? c.id === action.targetClipId
                : action.type === "trim" || c.kind === "audio"),
          ),
  );
  if (touchesLocked)
    throw new Error(
      "This proposal changes a locked track. Unlock that track before applying.",
    );
  return actions.reduce((d, action) => {
    if (action.type === "ratio") return { ...d, ratio: action.ratio };
    if (action.type === "volume")
      return {
        ...d,
        clips: d.clips.map((c) =>
          (
            action.targetClipId
              ? c.id === action.targetClipId
              : c.kind === "audio"
          )
            ? { ...c, volume: action.volume }
            : c,
        ),
      };
    if (action.type === 'trim' && action.targetClipId && !d.clips.some((c) => c.id === action.targetClipId && c.duration > action.seconds + 0.2)) throw new Error('Trim exceeds the selected clip duration.');
    if (action.type === "trim" && action.targetClipId)
      return {
        ...d,
        clips: d.clips.map((c) =>
          c.id === action.targetClipId
            ? {
                ...c,
                duration: Math.max(0.2, c.duration - action.seconds),
                offset: c.offset + action.seconds * c.speed,
              }
            : c,
        ),
      };
    if (action.type === "trim")
      return {
        ...d,
        clips: d.clips.flatMap((c) => {
          if (c.start + c.duration <= action.seconds) return [];
          const removed = Math.max(0, action.seconds - c.start);
          return [
            {
              ...c,
              start: Math.max(0, c.start - action.seconds),
              duration: c.duration - removed,
              offset: c.offset + removed * c.speed,
            },
          ];
        }),
      };
    if (!action.segments?.length) throw new Error('No transcript captions available.');
    if (d.clips.length + action.segments.length > 150) throw new Error('Caption proposal exceeds the 150 clip timeline limit.');
    let next = d;
    for (const segment of action.segments)
      next = addAsset(
        next,
        {
          id: crypto.randomUUID(),
          name: segment.text,
          kind: "text",
          duration: segment.end - segment.start,
          origin: "Text",
        },
        segment.start,
      );
    return next;
  }, doc);
}
