import { Types } from 'mongoose';
import { clipIdentity } from './clip-identity';
import type { Clip } from './schemas/job.schema';

describe('Clip identities during job retries', () => {
  const id = new Types.ObjectId();
  const clip = { _id: id, startTime: 10, endTime: 20 } as Clip;
  it('keeps generated clip IDs stable for the same highlight', () => {
    expect(clipIdentity(clip, { startTime: 10, endTime: 20 })).toBe(id);
  });
  it('creates a new identity for a new or changed highlight', () => {
    expect(
      String(clipIdentity(undefined, { startTime: 10, endTime: 20 })),
    ).not.toBe(String(id));
    expect(String(clipIdentity(clip, { startTime: 11, endTime: 20 }))).not.toBe(
      String(id),
    );
  });
});
