import { Types } from 'mongoose';
import {
  estimateRenderEta,
  smoothRenderEta,
  type RenderEtaEntry,
  type RenderCapacity,
} from './render-eta';
import { Clip, JobStatus, ClipProcessingState } from './schemas/job.schema';

const now = 100000;
function queued(duration = 50, hasCaptions = true): RenderEtaEntry {
  return {
    clip: {
      _id: new Types.ObjectId(),
      startTime: 0,
      endTime: duration,
      status: JobStatus.PENDING,
    } as Clip,
    hasCaptions,
    queueState: 'waiting',
  };
}
function active(
  remaining = 100,
  duration = 50,
  processed = 20,
): RenderEtaEntry {
  const entry = queued(duration);
  entry.queueState = 'active';
  entry.progress = {
    clipId: entry.clip._id.toString(),
    status: ClipProcessingState.CAPTIONING,
    progress: (processed / duration) * 100,
    renderProgress: 65,
    durationSeconds: duration,
    processedSeconds: processed,
    speed: (duration - processed) / remaining,
    etaSeconds: remaining,
    cuttingSeconds: duration,
    hasCaptions: true,
    updatedAt: now,
  };
  return entry;
}
function completed(duration = 50, cut = 50, caption = 100): RenderEtaEntry {
  const entry = queued(duration);
  entry.clip.status = JobStatus.COMPLETED;
  entry.clip.renderTiming = {
    cuttingSeconds: cut,
    captioningSeconds: caption,
    overheadSeconds: 10,
    totalSeconds: cut + caption + 10,
  };
  entry.queueState = undefined;
  return entry;
}
const capacity = (
  slots: number,
  active: number,
  waiting = 0,
): RenderCapacity => ({ slots, active, waiting, delayed: 0 });
const estimate = (
  entries: RenderEtaEntry[],
  metrics: RenderCapacity | null,
  status = 'cutting_clips',
) => estimateRenderEta(status, entries, metrics, now);

describe('backend-owned batch ETA', () => {
  it('includes measured active-stage ETA and setup/finalizing allowance in seconds', () => {
    expect(estimate([active(100)], capacity(1, 1))).toBe(130);
  });
  it('takes the longest active timeline rather than adding concurrent ETAs', () => {
    expect(estimate([active(100), active(200)], capacity(2, 2))).toBe(230);
  });
  it('assigns queued durations to the earliest available slots', () => {
    const entries = [
      completed(),
      active(100),
      active(200),
      queued(),
      queued(),
      queued(),
    ];
    // Observed full clip cost: 50 cut + 100 caption + 10 overhead = 160.
    // Slots: [110,210] -> [270,210] -> [270,370] -> [430,370].
    expect(estimate(entries, capacity(2, 2, 3))).toBe(430);
    expect(estimate(entries, capacity(1, 2, 3))).toBeNull();
  });
  it('uses idle registered capacity and does not divide the longest clip blindly', () => {
    expect(
      estimate(
        [completed(), queued(60), queued(15), queued(15)],
        capacity(2, 0, 3),
      ),
    ).toBe(190);
  });
  it('prefers completed parent phase timings over a noisy active speed sample', () => {
    expect(estimate([active(300), queued()], capacity(1, 1, 1))).toBe(910);
    expect(
      estimate([completed(), active(300), queued()], capacity(1, 1, 1)),
    ).toBe(470);
  });
  it('includes the future captioning phase when a clip is still being cut', () => {
    const entry = active(100);
    entry.progress!.status = ClipProcessingState.CUTTING;
    expect(estimate([completed(), entry], capacity(1, 1))).toBe(210);
    expect(estimate([entry], capacity(1, 1))).toBeNull();
    entry.hasCaptions = false;
    expect(estimate([entry], capacity(1, 1))).toBe(130);
  });
  it('does not invent a speed when samples or capacity are unavailable', () => {
    expect(estimate([queued()], capacity(1, 0, 1))).toBeNull();
    expect(estimate([active()], null)).toBeNull();
    const entry = active();
    entry.progress!.processedSeconds = 1;
    expect(estimate([entry], capacity(1, 1))).toBeNull();
  });
  it('returns zero only when every required clip is ready', () => {
    expect(estimate([completed(), completed()], null)).toBe(0);
    expect(estimate([], null, 'pending')).toBeNull();
  });
  it.each(['failed', 'cancelled'])(
    'returns null for a %s parent, even with completed clips',
    (status) => {
      expect(estimate([completed()], capacity(1, 0), status)).toBeNull();
    },
  );
  it('returns null for failed clips, delayed retry schedules or competing parents', () => {
    const failure = queued();
    failure.clip.status = JobStatus.FAILED;
    expect(estimate([active(), failure], capacity(1, 1))).toBeNull();
    expect(estimate([active()], { ...capacity(1, 1), delayed: 1 })).toBeNull();
    expect(estimate([active(), queued()], capacity(2, 2, 1))).toBeNull();
    expect(estimate([active(), queued()], capacity(2, 1, 3))).toBeNull();
  });
  it('rejects stale progress, incomplete queue state and out-of-range duration', () => {
    const entry = active();
    entry.progress!.updatedAt = now - 16000;
    expect(estimate([entry], capacity(1, 1))).toBeNull();
    expect(
      estimate([{ ...active(), queueState: undefined }], capacity(1, 1)),
    ).toBeNull();
    expect(estimate([completed(), queued(NaN)], capacity(1, 0, 1))).toBeNull();
  });
  it('rejects unusably slow/non-finite estimates instead of returning Infinity/NaN', () => {
    const entry = active();
    entry.progress!.speed = 1e-300;
    expect(estimate([entry], capacity(1, 1))).toBeNull();
    entry.progress!.speed = 0.0001;
    const seconds = estimate([entry], capacity(1, 1));
    expect(seconds).toBe(300030);
    expect(Number.isFinite(seconds)).toBe(true);
  });
  it('smooths fresh observations without counting down an unchanged sample', () => {
    expect(smoothRenderEta(1000, 5000, 1000)).toBeLessThan(1300);
    expect(smoothRenderEta(1000, 1000, 1000)).toBe(1000);
    expect(smoothRenderEta(1000, 100, 1000)).toBeGreaterThan(900);
    expect(smoothRenderEta(1000, 5000, 0)).toBe(1000);
  });
  it('projects the reported seven-clip/two-slot case without summing its workloads', () => {
    const entries = [
      active(1147, 50, 19),
      active(1351, 50, 17),
      ...Array.from({ length: 5 }, () => queued(50)),
    ];
    const seconds = estimate(entries, capacity(2, 2, 5))!;
    const serial = estimate(
      entries.map((entry, index) =>
        index === 1
          ? { ...entry, queueState: 'waiting', progress: undefined }
          : entry,
      ),
      capacity(1, 1, 6),
    )!;
    expect(seconds).toBeGreaterThan(1351);
    expect(seconds).toBeLessThan(serial);
    expect(seconds).toBe(7263);
  });
});
