import { model, Types } from 'mongoose';
import { JobSchema } from './job.schema';

describe('Job ownership query casting', () => {
  const owner = '6ab507089b7f22501c40aeb5';
  const jobId = '6abe4d644b3ff2840974672f';
  const clipId = '6abe4de08c39dc00dddedd54';
  const JobModel = model('JobOwnershipCastingTest', JobSchema);
  afterEach(() => jest.restoreAllMocks());
  it('finds an ObjectId-owned job when Studio supplies string IDs', async () => {
    const rawJob = {
      _id: new Types.ObjectId(jobId),
      userId: new Types.ObjectId(owner),
      clips: [{ _id: new Types.ObjectId(clipId), startTime: 10, endTime: 20 }],
    };
    const find = jest
      .spyOn(JobModel.collection, 'findOne')
      .mockImplementation((filter) => {
        const query = filter as { _id: Types.ObjectId; userId: unknown };
        return Promise.resolve(
          query._id.equals(rawJob._id) &&
            query.userId instanceof Types.ObjectId &&
            query.userId.equals(rawJob.userId)
            ? rawJob
            : null,
        );
      });
    const result = await JobModel.findOne({ _id: jobId, userId: owner }).exec();
    expect(result).not.toBeNull();
    expect(String(result?.clips[0]._id)).toBe(clipId);
    expect(find.mock.calls[0][0]).toMatchObject({
      _id: new Types.ObjectId(jobId),
      userId: new Types.ObjectId(owner),
    });
  });
  it('continues to reject another user with the same job ID', async () => {
    const storedOwner = new Types.ObjectId(owner);
    jest.spyOn(JobModel.collection, 'findOne').mockImplementation((filter) => {
      const query = filter as { userId: Types.ObjectId };
      return Promise.resolve(
        query.userId.equals(storedOwner)
          ? { _id: new Types.ObjectId(jobId), userId: storedOwner }
          : null,
      );
    });
    await expect(
      JobModel.findOne({
        _id: jobId,
        userId: '507f1f77bcf86cd799439011',
      }).exec(),
    ).resolves.toBeNull();
  });
});
