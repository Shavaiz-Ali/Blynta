import type { Job } from "./types";

const stages: Record<string, number> = {
  queued: 0,
  cutting: 1,
  captioning: 2,
  uploading: 3,
  ready: 4,
};
const stamp = (value?: string) => (value ? Date.parse(value) : NaN);

/** Retain newer observations within an attempt, without changing query timing. */
export function mergeJobProgress(
  previous: Job | undefined,
  incoming: Job,
): Job {
  if (
    !previous ||
    (previous._id || previous.id) !== (incoming._id || incoming.id)
  )
    return incoming;
  if (stamp(incoming.updatedAt) < stamp(previous.updatedAt)) return previous;
  if (!previous.render) return incoming;
  const render = incoming.render ?? previous.render;
  const retained = previous.render.clips
    .filter(
      (sample) =>
        !incoming.render?.clips.some(
          (entry) => entry.clipId === sample.clipId,
        ) &&
        incoming.clips.some(
          (clip) =>
            (clip._id || clip.id) === sample.clipId &&
            clip.status === "cutting_clips" &&
            clip.processingState !== "queued",
        ),
    )
    .map((sample) => ({ ...sample, etaSeconds: undefined }));
  const clips = (incoming.render?.clips ?? []).map((sample) => {
    const old = previous.render!.clips.find(
      (entry) => entry.clipId === sample.clipId,
    );
    if (!old) return sample;
    const clip = incoming.clips.find(
      (entry) => (entry._id || entry.id) === sample.clipId,
    );
    const oldClip = previous.clips.find(
      (entry) => (entry._id || entry.id) === sample.clipId,
    );
    // Retry success clears render data in the cache. A retry from another client
    // is also identifiable by a newer persisted transition back into the queue.
    const newAttempt =
      (oldClip?.status === "failed" && clip && clip.status !== "failed") ||
      (sample.status === "queued" &&
        stamp(clip?.updatedAt) > stamp(oldClip?.updatedAt));
    if (
      newAttempt ||
      ["failed", "cancelled", "completed"].includes(clip?.status ?? "")
    )
      return sample;
    if (
      sample.updatedAt !== undefined &&
      old.updatedAt !== undefined &&
      sample.updatedAt < old.updatedAt
    )
      return old;
    if (stages[sample.status] < stages[old.status]) return old;
    if (!Number.isFinite(sample.progress) && Number.isFinite(old.progress))
      return old;
    return Number.isFinite(old.progress) && sample.progress < old.progress
      ? { ...sample, progress: old.progress }
      : sample;
  });
  return { ...incoming, render: { ...render, clips: [...clips, ...retained] } };
}
