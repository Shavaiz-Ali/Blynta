import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { AdminJobsService } from './admin-jobs.service';
import { AdminJobsController } from './admin-jobs.controller';
import { Job, JobStatus, SourcePlatform } from '../../jobs/schemas/job.schema';

describe('AdminJobs Module', () => {
  let controller: AdminJobsController;
  let service: AdminJobsService;

  const mockJobId = new Types.ObjectId().toString();
  const mockUserId = new Types.ObjectId().toString();

  const mockJobDoc = {
    _id: new Types.ObjectId(mockJobId),
    userId: new Types.ObjectId(mockUserId),
    sourceUrl: 'https://youtube.com/watch?v=123',
    sourcePlatform: SourcePlatform.YOUTUBE,
    status: JobStatus.COMPLETED,
    videoTitle: 'Test Video',
    progressPercent: 100,
  };

  const jobModelMock = {
    find: jest.fn(),
    findById: jest.fn(),
    countDocuments: jest.fn(),
    aggregate: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminJobsController],
      providers: [
        AdminJobsService,
        {
          provide: getModelToken(Job.name),
          useValue: jobModelMock,
        },
      ],
    }).compile();

    controller = module.get<AdminJobsController>(AdminJobsController);
    service = module.get<AdminJobsService>(AdminJobsService);
  });

  describe('listJobs', () => {
    it('returns system-wide jobs with pagination and user populate', async () => {
      jobModelMock.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            sort: jest.fn().mockReturnValue({
              skip: jest.fn().mockReturnValue({
                limit: jest.fn().mockReturnValue({
                  lean: jest.fn().mockReturnValue({
                    exec: jest.fn().mockResolvedValue([mockJobDoc]),
                  }),
                }),
              }),
            }),
          }),
        }),
      });

      jobModelMock.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(1),
      });

      const result = await controller.listJobs({ page: 1, limit: 10 });
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('getJobStats', () => {
    it('aggregates jobs by status for 24h, 7d and all-time', async () => {
      jobModelMock.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(10),
      });

      jobModelMock.aggregate
        .mockResolvedValueOnce([{ _id: JobStatus.COMPLETED, count: 2 }]) // 24h
        .mockResolvedValueOnce([{ _id: JobStatus.COMPLETED, count: 5 }]) // 7d
        .mockResolvedValueOnce([
          { _id: JobStatus.COMPLETED, count: 8 },
          { _id: JobStatus.FAILED, count: 2 },
        ]); // all-time

      const stats = await controller.getJobStats();
      expect(stats.totalJobs).toBe(10);
      expect(stats.last24Hours.total).toBe(2);
      expect(stats.last7Days.total).toBe(5);
      expect(stats.allTimeByStatus[JobStatus.COMPLETED]).toBe(8);
      expect(stats.allTimeByStatus[JobStatus.FAILED]).toBe(2);
    });
  });

  describe('getJobDetail', () => {
    it('retrieves detailed job document', async () => {
      jobModelMock.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(mockJobDoc),
          }),
        }),
      });

      const result = await controller.getJobDetail(mockJobId);
      expect(result._id.toString()).toBe(mockJobId);
      expect(result.videoTitle).toBe('Test Video');
    });
  });
});
