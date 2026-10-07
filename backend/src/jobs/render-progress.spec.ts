import { Types } from 'mongoose';
import { renderSnapshot } from './render-progress';
import { Clip, JobStatus, ClipProcessingState } from './schemas/job.schema';

describe('parent render progress', () => {
  const clip = (duration: number, status = JobStatus.PENDING) =>
    ({
      _id: new Types.ObjectId(),
      startTime: 0,
      endTime: duration,
      status,
      processingState: ClipProcessingState.QUEUED,
    }) as Clip;
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
    expect(result).toMatchObject({ ready: 1, total: 2, progressPercent: 74 });
    expect(result.clips[1]).toMatchObject({
      progress: 50,
      status: 'captioning',
      renderProgress: 70,
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
