import { BillingRateLimitGuard } from '../billing/billing-rate-limit.guard';
import { Test } from '@nestjs/testing';
import { INestApplication, NotFoundException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ZodValidationPipe } from 'nestjs-zod';
import { randomUUID } from 'node:crypto';
import { Types } from 'mongoose';
import request from 'supertest';
import { Server } from 'node:http';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { UsersService } from '../users/users.service';
import { R2Service } from '../storage/r2.service';
import { ActivitiesService } from '../activities/activities.service';
import { UserPlan } from '../users/schemas/user.schema';
import { ActivityType } from '../activities/schemas/activity.schema';

describe('clip download HTTP intent and read endpoints', () => {
  let app: INestApplication;
  const userId = new Types.ObjectId().toString();
  const jobId = new Types.ObjectId().toString();
  const clipId = new Types.ObjectId().toString();
  const queueCreate = jest.fn().mockResolvedValue(undefined);
  const getClipForDownload = jest.fn();
  const getSignedDownloadUrl = jest.fn();
  const job = { toObject: () => ({ _id: jobId }), renderManifestReady: false };
  const url = `/jobs/${jobId}/clips/${clipId}`;

  beforeEach(async () => {
    jest.clearAllMocks();
    getClipForDownload.mockResolvedValue({
      clip: { _id: new Types.ObjectId(clipId), r2ObjectKey: 'clip.mp4' },
    });
    getSignedDownloadUrl.mockResolvedValue('https://example.test/signed');
    const module = await Test.createTestingModule({
      controllers: [JobsController],
      providers: [
        {
          provide: JobsService,
          useValue: {
            finalizeCancellation: () => Promise.resolve(),
            getClipForDownload,
            getJobById: () => Promise.resolve(job),
            getJobsForUser: () => Promise.resolve({ jobs: [job] }),
          },
        },
        {
          provide: UsersService,
          useValue: {
            findById: () => Promise.resolve({ plan: UserPlan.FREE }),
          },
        },
        { provide: R2Service, useValue: { getSignedDownloadUrl } },
        { provide: ActivitiesService, useValue: { queueCreate } },
      ],
    })
      .overrideGuard(BillingRateLimitGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AuthGuard('jwt'))
      .useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
    app.use(
      (req: { user: { userId: string } }, _res: unknown, next: () => void) => {
        req.user = { userId };
        next();
      },
    );
    app.useGlobalPipes(new ZodValidationPipe());
    await app.init();
  });
  afterEach(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer() as Server);

  it('makes one producer call for one HTTP download action with complete correlation', async () => {
    const actionId = randomUUID();
    await http().post(`${url}/download`).send({ actionId }).expect(201);
    expect(queueCreate).toHaveBeenCalledTimes(1);
    expect(queueCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        userId,
        type: ActivityType.CLIP_DOWNLOAD,
        dedupeKey: `activity:download:${userId}:${jobId}:${clipId}:${actionId}`,
        metadata: expect.objectContaining({
          jobId,
          clipId,
          actionId,
        }) as unknown,
      }),
    );
  });

  it('reuses an event for HTTP retries and changes it for another click', async () => {
    const actionId = randomUUID();
    await http().post(`${url}/download`).send({ actionId }).expect(201);
    await http().post(`${url}/download`).send({ actionId }).expect(201);
    await http()
      .post(`${url}/download`)
      .send({ actionId: randomUUID() })
      .expect(201);
    const calls = queueCreate.mock.calls as [{ dedupeKey: string }][];
    expect(calls[0][0].dedupeKey).toBe(calls[1][0].dedupeKey);
    expect(calls[0][0].dedupeKey).not.toBe(calls[2][0].dedupeKey);
  });

  it('creates no activity for preview, legacy GET, job loading, or repeated polling', async () => {
    for (const path of [
      `${url}/media-url`,
      `${url}/download`,
      '/jobs',
      `/jobs/${jobId}`,
      `${url}/media-url`,
      `/jobs/${jobId}`,
    ]) {
      await http().get(path).expect(200);
    }
    expect(queueCreate).not.toHaveBeenCalled();
  });

  it('rejects absent/invalid action IDs before creating activity', async () => {
    for (const body of [{}, { actionId: 'not-an-action-id' }]) {
      await http().post(`${url}/download`).send(body).expect(400);
    }
    expect(queueCreate).not.toHaveBeenCalled();
  });

  it('creates no activity when authorization/availability or signing fails', async () => {
    getClipForDownload.mockRejectedValueOnce(new NotFoundException());
    await http()
      .post(`${url}/download`)
      .send({ actionId: randomUUID() })
      .expect(404);
    getSignedDownloadUrl.mockRejectedValueOnce(
      new Error('storage unavailable'),
    );
    await http()
      .post(`${url}/download`)
      .send({ actionId: randomUUID() })
      .expect(500);
    expect(queueCreate).not.toHaveBeenCalled();
  });
});
