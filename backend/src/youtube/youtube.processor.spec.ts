import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Types } from 'mongoose';
import { Readable } from 'stream';
import { YouTubeProcessor } from './youtube.processor';
import { YouTubeOAuthService } from './youtube-oauth.service';
import { YouTubeApiService } from './youtube-api.service';
import { JobsService } from '../jobs/jobs.service';
import { R2Service } from '../storage/r2.service';
import {
  ClipPublication,
  PublicationStatus,
} from './schemas/clip-publication.schema';
import { YOUTUBE_JOB_TYPES } from './youtube.constants';

describe('YouTubeProcessor', () => {
  let processor: YouTubeProcessor;

  const mockFindById = jest.fn();
  const mockOAuthService = {
    findConnectionWithTokens: jest.fn(),
    getValidAccessToken: jest.fn(),
  };
  const mockApiService = {
    uploadVideo: jest.fn(),
  };
  const mockJobsService = {
    getClipForDownload: jest.fn(),
  };
  const mockR2Service = {};
  const mockConfigService = {
    get: jest.fn((key: string, defaultVal?: any) => {
      if (key === 'R2_BUCKET_NAME') return 'test-bucket';
      if (key === 'R2_ENDPOINT') return 'https://r2.test';
      if (key === 'R2_ACCESS_KEY_ID') return 'key';
      if (key === 'R2_SECRET_ACCESS_KEY') return 'secret';
      return defaultVal;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        YouTubeProcessor,
        {
          provide: getModelToken(ClipPublication.name),
          useValue: {
            findById: mockFindById,
          },
        },
        {
          provide: YouTubeOAuthService,
          useValue: mockOAuthService,
        },
        {
          provide: YouTubeApiService,
          useValue: mockApiService,
        },
        {
          provide: JobsService,
          useValue: mockJobsService,
        },
        {
          provide: R2Service,
          useValue: mockR2Service,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    processor = module.get<YouTubeProcessor>(YouTubeProcessor);
  });

  it('should process upload job, stream video, and mark publication as PUBLISHED', async () => {
    const pubId = new Types.ObjectId().toString();
    const userId = new Types.ObjectId().toString();
    const jobId = new Types.ObjectId().toString();
    const clipId = 'clip_01';

    const mockPublication = {
      _id: pubId,
      status: PublicationStatus.QUEUED,
      title: 'Test Clip',
      description: 'Test Desc',
      privacyStatus: 'private',
      save: jest.fn().mockResolvedValue(true),
    };

    mockFindById.mockReturnValue({
      exec: jest.fn().mockResolvedValue(mockPublication),
    });

    mockJobsService.getClipForDownload.mockResolvedValue({
      clip: { id: clipId, r2ObjectKey: 'clips/test.mp4' },
    });

    mockOAuthService.findConnectionWithTokens.mockResolvedValue({
      userId,
      channelId: 'UC123',
    });

    mockOAuthService.getValidAccessToken.mockResolvedValue('valid-access-token');

    // Mock S3 send
    const stream = new Readable();
    stream.push('dummy video data');
    stream.push(null);

    (processor as any).s3Client = {
      send: jest.fn().mockResolvedValue({
        Body: stream,
        ContentLength: 1024,
      }),
    };

    mockApiService.uploadVideo.mockResolvedValue({
      videoId: 'yt_video_123',
      videoUrl: 'https://youtube.com/watch?v=yt_video_123',
    });

    await processor.process({
      name: YOUTUBE_JOB_TYPES.UPLOAD,
      data: { publicationId: pubId, jobId, clipId, userId },
    } as any);

    expect(mockPublication.status).toBe(PublicationStatus.PUBLISHED);
    expect((mockPublication as any).externalId).toBe('yt_video_123');
    expect(mockPublication.save).toHaveBeenCalled();
  });

  it('should record error and mark publication as FAILED when upload throws', async () => {
    const pubId = new Types.ObjectId().toString();
    const userId = new Types.ObjectId().toString();
    const jobId = new Types.ObjectId().toString();
    const clipId = 'clip_01';

    const mockPublication = {
      _id: pubId,
      status: PublicationStatus.QUEUED,
      title: 'Test Clip',
      description: 'Test Desc',
      privacyStatus: 'private',
      save: jest.fn().mockResolvedValue(true),
    };

    mockFindById.mockReturnValue({
      exec: jest.fn().mockResolvedValue(mockPublication),
    });

    mockJobsService.getClipForDownload.mockRejectedValue(new Error('Clip not found'));

    await expect(
      processor.process({
        name: YOUTUBE_JOB_TYPES.UPLOAD,
        data: { publicationId: pubId, jobId, clipId, userId },
      } as any),
    ).rejects.toThrow('Clip not found');

    expect(mockPublication.status).toBe(PublicationStatus.FAILED);
    expect((mockPublication as any).error).toContain('Clip not found');
  });
});
