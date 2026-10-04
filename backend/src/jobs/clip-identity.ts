import { Types } from 'mongoose';
import type { Clip } from './schemas/job.schema';

/** Retrying the same highlight must not invalidate clip URLs or import keys. */
export function clipIdentity(
  existing: Clip | undefined,
  range: { startTime: number; endTime: number },
) {
  return existing?._id &&
    existing.startTime === range.startTime &&
    existing.endTime === range.endTime
    ? existing._id
    : new Types.ObjectId();
}
