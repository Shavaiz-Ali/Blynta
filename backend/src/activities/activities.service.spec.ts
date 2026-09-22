import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { getQueueToken } from '@nestjs/bullmq';
import { Types } from 'mongoose';
import {
  Activity,
  ActivityActorType,
  ActivityCategory,
  ActivitySeverity,
  ActivityStatus,
  ActivityType,
} from './schemas/activity.schema';
import { ActivitiesService } from './activities.service';
import { ACTIVITIES_QUEUE, ACTIVITY_JOBS } from './activities.constants';

describe('ActivitiesService', () => {
  let service: ActivitiesService;

  const activitySave = jest.fn();
  const findOneExec = jest.fn();
  const listExec = jest.fn();
  const countDocumentsExec = jest.fn();
  const aggregateExec = jest.fn();
  const queueAdd = jest.fn().mockResolvedValue(undefined);

  function ActivityModel(this: any, data: any) {
    Object.assign(this, data);
    this.save = activitySave;
  }

  (ActivityModel as any).findOne = jest.fn(() => ({ exec: findOneExec }));
  (ActivityModel as any).find = jest.fn(() => ({
    sort: jest.fn(() => ({
      skip: jest.fn(() => ({
        limit: jest.fn(() => ({ exec: listExec })),
      })),
    })),
  }));
  (ActivityModel as any).countDocuments = jest.fn(() => ({
    exec: countDocumentsExec,
  }));
  (ActivityModel as any).aggregate = jest.fn(() => ({
    exec: aggregateExec,
  }));

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivitiesService,
        {
          provide: getModelToken(Activity.name),
          useValue: ActivityModel,
        },
        {
          provide: getQueueToken(ACTIVITIES_QUEUE),
          useValue: { add: queueAdd },
        },
      ],
    }).compile();

    service = module.get<ActivitiesService>(ActivitiesService);
  });

  describe('create', () => {
    it('creates and saves an activity with correct defaults', async () => {
      const userId = new Types.ObjectId().toString();
      activitySave.mockResolvedValueOnce({
        _id: new Types.ObjectId(),
        userId: new Types.ObjectId(userId),
        type: ActivityType.AUTH_LOGIN,
        category: ActivityCategory.AUTH,
        title: 'Logged in',
        status: ActivityStatus.SUCCESS,
        severity: ActivitySeverity.INFO,
        actorType: ActivityActorType.USER,
      });

      const result = await service.create({
        userId,
        type: ActivityType.AUTH_LOGIN,
        category: ActivityCategory.AUTH,
        title: 'Logged in',
      });

      expect(activitySave).toHaveBeenCalled();
      expect(result.type).toBe(ActivityType.AUTH_LOGIN);
      expect(result.status).toBe(ActivityStatus.SUCCESS);
    });

    it('handles duplicate key deduplication gracefully', async () => {
      const userId = new Types.ObjectId().toString();
      const existingActivity = {
        _id: new Types.ObjectId(),
        userId: new Types.ObjectId(userId),
        dedupeKey: 'job:123:completed',
      };

      activitySave.mockRejectedValueOnce({ code: 11000 });
      findOneExec.mockResolvedValueOnce(existingActivity);

      const result = await service.create({
        userId,
        type: ActivityType.JOB_COMPLETE,
        category: ActivityCategory.JOB,
        title: 'Clip generation completed',
        dedupeKey: 'job:123:completed',
      });

      expect(result).toBe(existingActivity);
    });
  });

  describe('queueCreate', () => {
    it('adds job to BullMQ queue with retry options', async () => {
      const userId = new Types.ObjectId().toString();
      await service.queueCreate({
        userId,
        type: ActivityType.AUTH_REGISTER,
        category: ActivityCategory.AUTH,
        title: 'Account created',
      });

      expect(queueAdd).toHaveBeenCalledWith(
        ACTIVITY_JOBS.CREATE,
        expect.objectContaining({
          userId,
          type: ActivityType.AUTH_REGISTER,
          category: ActivityCategory.AUTH,
        }),
        expect.objectContaining({
          attempts: 3,
        }),
      );
    });
  });

  describe('queueCreateIfNotExists', () => {
    it('adds deduplicated job to BullMQ queue', async () => {
      const userId = new Types.ObjectId().toString();
      await service.queueCreateIfNotExists({
        userId,
        type: ActivityType.JOB_COMPLETE,
        category: ActivityCategory.JOB,
        title: 'Clip generation completed',
        dedupeKey: 'job:123:completed',
      });

      expect(queueAdd).toHaveBeenCalledWith(
        ACTIVITY_JOBS.CREATE_IF_NOT_EXISTS,
        expect.objectContaining({
          dedupeKey: 'job:123:completed',
        }),
        expect.any(Object),
      );
    });
  });

  describe('listForUser', () => {
    it('paginates user activities correctly', async () => {
      const userId = new Types.ObjectId().toString();
      const mockActivities = [
        { _id: new Types.ObjectId(), title: 'Activity 1' },
        { _id: new Types.ObjectId(), title: 'Activity 2' },
      ];

      listExec.mockResolvedValueOnce(mockActivities);
      countDocumentsExec.mockResolvedValueOnce(2);

      const result = await service.listForUser(userId, { page: 1, limit: 10 });

      expect(result.activities).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.totalPages).toBe(1);
    });

    it('caps the requested limit at MAX_LIMIT (100)', async () => {
      const userId = new Types.ObjectId().toString();
      listExec.mockResolvedValueOnce([]);
      countDocumentsExec.mockResolvedValueOnce(0);

      const result = await service.listForUser(userId, { limit: 500 });

      expect(result.limit).toBe(100);
    });

    it('applies a case-insensitive search filter across title and description', async () => {
      const userId = new Types.ObjectId().toString();
      listExec.mockResolvedValueOnce([]);
      countDocumentsExec.mockResolvedValueOnce(0);

      await service.listForUser(userId, { search: 'clip' });

      const filter = (ActivityModel as any).countDocuments.mock.calls[0][0];
      expect(filter.$or).toHaveLength(4);
      // Case-insensitive across title, description, type and entityType
      expect(filter.$or[0].title.test('Clip generation completed')).toBe(true);
      expect(filter.$or[0].title.test('A CLIP was made')).toBe(true);
      expect(
        filter.$or[1].description.test('A clip download link was generated.'),
      ).toBe(true);
      expect(filter.$or[2].type.test('clip.download')).toBe(true);
      expect(filter.$or[0].title.test('Credit used')).toBe(false);
    });

    it('escapes regex metacharacters in the search term', async () => {
      const userId = new Types.ObjectId().toString();
      listExec.mockResolvedValueOnce([]);
      countDocumentsExec.mockResolvedValueOnce(0);

      await service.listForUser(userId, { search: 'a.*b' });

      const filter = (ActivityModel as any).countDocuments.mock.calls[0][0];
      expect(filter.$or[0].title.test('a.*b')).toBe(true);
      expect(filter.$or[0].title.test('axxb')).toBe(false);
    });
  });

  describe('getStatsForUser', () => {
    it('aggregates lifetime counters from grouped category/type rows', async () => {
      const userId = new Types.ObjectId().toString();

      aggregateExec.mockResolvedValueOnce([
        {
          _id: {
            category: ActivityCategory.JOB,
            type: ActivityType.JOB_CREATE,
          },
          count: 3,
        },
        {
          _id: {
            category: ActivityCategory.JOB,
            type: ActivityType.JOB_COMPLETE,
          },
          count: 2,
        },
        {
          _id: {
            category: ActivityCategory.JOB,
            type: ActivityType.CLIP_DOWNLOAD,
          },
          count: 9,
        },
        {
          _id: {
            category: ActivityCategory.CREDIT,
            type: ActivityType.CREDIT_DEDUCT,
          },
          count: 3,
          credits: 3,
        },
        {
          _id: {
            category: ActivityCategory.BILLING,
            type: ActivityType.BILLING_PAYMENT_SUCCESS,
          },
          count: 2,
        },
        {
          _id: {
            category: ActivityCategory.AUTH,
            type: ActivityType.AUTH_LOGIN,
          },
          count: 2,
        },
      ]);

      const result = await service.getStatsForUser(userId);

      expect(result.total).toBe(21);
      expect(result.jobsCount).toBe(14);
      expect(result.jobsCompleted).toBe(2);
      expect(result.creditsUsed).toBe(3);
      expect(result.billingEvents).toBe(2);
    });

    it('returns zeroed counters when the user has no activity', async () => {
      const userId = new Types.ObjectId().toString();
      aggregateExec.mockResolvedValueOnce([]);

      const result = await service.getStatsForUser(userId);

      expect(result).toEqual({
        total: 0,
        jobsCount: 0,
        jobsCompleted: 0,
        creditsUsed: 0,
        billingEvents: 0,
      });
    });
  });
});
