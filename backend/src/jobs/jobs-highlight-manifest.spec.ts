import { ConfigService } from '@nestjs/config';
import { Model, Types } from 'mongoose';
import { Queue } from 'bullmq';
import { JobsService } from './jobs.service';
import { JobDocument } from './schemas/job.schema';
import { UsersService } from '../users/users.service';
import { R2Service } from '../storage/r2.service';
import { ActivitiesService } from '../activities/activities.service';
import { RenderEtaService } from './render-eta.service';

describe('highlight manifest authorization and resume', () => {
  test.each([0, 100, 540])(
    'keeps highlight metadata and cards synchronized within %s seconds',
    async (budget) => {
      const jobId = new Types.ObjectId().toString();
      const highlights = Array.from({ length: 12 }, (_, i) => ({
        startTime: i * 80,
        endTime: i * 80 + 45,
        score: 0.9,
        reason: 'Complete moment',
        clipTitle: `Clip ${i}`,
        clipDescription: '',
        tags: [],
        style: 'curiosity-hook',
      }));
      const parent = {
        _id: new Types.ObjectId(jobId),
        clips: [],
        highlights,
        creditOperationId: 'immutable-operation',
        creditOutputSeconds: budget,
        creditSourceSeconds: 3233,
        videoDuration: 3233.461,
        clipTargetMax: 9,
        renderManifestReady: false,
      };
      const model = {
        findById: jest.fn(() => ({ exec: () => Promise.resolve(parent) })),
        updateOne: jest.fn((_filter: object, update: { $set: object }) => ({
          exec: () => {
            Object.assign(parent, update.$set);
            return Promise.resolve({ modifiedCount: 1 });
          },
        })),
      };
      const service = new JobsService(
        model as unknown as Model<JobDocument>,
        {} as Queue,
        {} as Queue,
        {} as UsersService,
        new ConfigService(),
        {} as R2Service,
        {} as ActivitiesService,
        {} as RenderEtaService,
      );
      await service.prepareRenderManifest(jobId, highlights);
      const expected = Math.min(9, Math.floor(budget / 45));
      expect(parent.clips).toHaveLength(expected);
      expect(parent.highlights).toHaveLength(expected);
      expect(parent.highlights).toEqual(highlights.slice(0, expected));
      const ids = parent.clips.map((c: { _id: Types.ObjectId }) =>
        c._id.toString(),
      );
      await service.prepareRenderManifest(jobId, highlights);
      expect(model.updateOne).toHaveBeenCalledTimes(1);
      expect(
        parent.clips.map((c: { _id: Types.ObjectId }) => c._id.toString()),
      ).toEqual(ids);
      expect(parent).toMatchObject({
        creditOperationId: 'immutable-operation',
        creditOutputSeconds: budget,
        creditSourceSeconds: 3233,
      });
      expect(model.updateOne.mock.calls[0][0]).toMatchObject({
        renderManifestReady: { $ne: true },
      });
    },
  );
});
