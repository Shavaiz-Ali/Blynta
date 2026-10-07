import { Types } from 'mongoose';
import {
  renderSnapshot,
  overallClipProgress,
  clipProgressSample,
} from './render-progress';
import { Clip, JobStatus, ClipProcessingState } from './schemas/job.schema';

describe('parent render progress', () => {
  it.each([
    [ClipProcessingState.CUTTING, 0, 0],
    [ClipProcessingState.CUTTING, 50, 15],
    [ClipProcessingState.CUTTING, 100, 30],
    [ClipProcessingState.CAPTIONING, 0, 30],
    [ClipProcessingState.CAPTIONING, 10, 36],
    [ClipProcessingState.CAPTIONING, 50, 60],
    [ClipProcessingState.CAPTIONING, 100, 90],
    [ClipProcessingState.UPLOADING, 0, 90],
    [ClipProcessingState.UPLOADING, 50, 95],
    [ClipProcessingState.UPLOADING, 100, 100],
    [ClipProcessingState.READY, 0, 100],
  ])('maps %s at %s to %s overall', (status, stage, overall) => {
    expect(overallClipProgress(status, stage)).toBe(overall);
  });
  const clip = (duration: number, status = JobStatus.PENDING) =>
    ({
      _id: new Types.ObjectId(),
      startTime: 0,
      endTime: duration,
      status,
      processingState: ClipProcessingState.QUEUED,
    }) as Clip;
  it('keeps clip and parent progress monotonic while stage media time resets', () => {
    const current = clip(50);
    let previous: ReturnType<typeof clipProgressSample> | undefined;
    let parentProgress = 0;
    for (const [status, stageProgress] of [
      [ClipProcessingState.CUTTING, 100],
      [ClipProcessingState.CAPTIONING, 0],
      [ClipProcessingState.CAPTIONING, 50],
      [ClipProcessingState.CAPTIONING, 10], // stale FFmpeg observation
      [ClipProcessingState.UPLOADING, 0],
      [ClipProcessingState.READY, 0],
    ] as const) {
      const next = clipProgressSample(
        { clipId: current._id.toString(), status, durationSeconds: 50 },
        {
          progress: stageProgress,
          processedSeconds: stageProgress / 2,
          durationSeconds: 50,
        },
        previous,
      );
      expect(next.progress).toBeGreaterThanOrEqual(previous?.progress ?? 0);
      const snapshot = renderSnapshot([{ clip: current, progress: next }]);
      expect(snapshot.progressPercent).toBeGreaterThanOrEqual(parentProgress);
      parentProgress = snapshot.progressPercent;
      if (status === ClipProcessingState.CAPTIONING && stageProgress === 0) {
        expect(next).toMatchObject({
          progress: 30,
          stageProgress: 0,
          processedSeconds: 0,
        });
      }
      if (status === ClipProcessingState.CAPTIONING && stageProgress === 10)
        expect(next).toBe(previous);
      previous = next;
    }
    expect(previous?.progress).toBe(100);
  });
  it('preserves the overall watermark across a queued retry without retaining stage ETA', () => {
    const base = {
      clipId: 'clip',
      status: ClipProcessingState.CAPTIONING,
      durationSeconds: 50,
    };
    const prior = clipProgressSample(base, {
      progress: 80,
      processedSeconds: 40,
      durationSeconds: 50,
      etaSeconds: 10,
    });
    const retry = clipProgressSample(
      { ...base, status: ClipProcessingState.QUEUED },
      undefined,
      prior,
    );
    expect(retry).toMatchObject({ progress: 78, stageProgress: 0 });
    expect(retry.etaSeconds).toBeUndefined();
    expect(retry.processedSeconds).toBeUndefined();
    expect(
      clipProgressSample(
        { ...base, status: ClipProcessingState.CUTTING },
        { progress: 50, processedSeconds: 25, durationSeconds: 50 },
        retry,
      ).progress,
    ).toBe(78);
  });
  it.each([NaN, Infinity, -1])('hides invalid stage ETA %s', (etaSeconds) => {
    expect(
      clipProgressSample(
        { clipId: 'clip', status: ClipProcessingState.CUTTING },
        { progress: 50, processedSeconds: 25, durationSeconds: 50, etaSeconds },
      ).etaSeconds,
    ).toBeUndefined();
  });
  it('weights active work by duration rather than clip count', () => {
    const long = clip(60);
    const result = renderSnapshot([
      { clip: clip(10, JobStatus.COMPLETED) },
      {
        clip: long,
        progress: {
          clipId: long._id.toString(),
          status: ClipProcessingState.CAPTIONING,
          progress: 50,
          renderProgress: 70,
          updatedAt: 1,
        },
      },
    ]);
    expect(result).toMatchObject({ ready: 1, total: 2, progressPercent: 66 });
    expect(result.clips[1]).toMatchObject({
      progress: 60,
      status: 'captioning',
      renderProgress: 60,
    });
  });
  it('terminal failure finishes work but is reported independently from ready', () => {
    const result = renderSnapshot([
      { clip: clip(10, JobStatus.COMPLETED) },
      { clip: clip(60, JobStatus.FAILED) },
    ]);
    expect(result).toMatchObject({
      progressPercent: 100,
      ready: 1,
      failed: 1,
      total: 2,
    });
  });
});
