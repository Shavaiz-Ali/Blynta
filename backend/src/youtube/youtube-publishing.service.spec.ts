import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { getQueueToken } from '@nestjs/bullmq';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { YouTubePublishingService } from './youtube-publishing.service';
import { YouTubeOAuthService } from './youtube-oauth.service';
import { JobsService } from '../jobs/jobs.service';
import {
  ClipPublication,
  PublicationPlatform,
  PublicationStatus,
} from './schemas/clip-publication.schema';
import { YOUTUBE_PUBLISHING_QUEUE } from './youtube.constants';
import { YouTubeNotConnectedException } from './exceptions/youtube-not-connected.exception';

describe('YouTubePublishingService', () => {
  let service: YouTubePublishingService;

  const mockSave = jest.fn();
  const mockFindOne = jest.fn();
  const mockFind = jest.fn();
  const mockFindById = jest.fn();
  const mockQueue = { add: jest.fn().mockResolvedValue({}) };
  const mockOAuthService = {
    findConnectionByUserId: jest.fn(),
    revokeAndDelete: jest.fn(),
  };
  const mockJobsService = {
    getClipForDownload: jest.fn(),
    getJobById: jest.fn(),
  };

  function MockPublicationModel(this: any, data: any) {
    Object.assign(this, data);
    this._id = new Types.ObjectId();
    this.save = mockSave.mockResolvedValue(this);
  }

  (MockPublicationModel as any).findOne = mockFindOne;
  (MockPublicationModel as any).find = mockFind;
  (MockPublicationModel as any).findById = mockFindById;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        YouTubePublishingService,
        {
          provide: getModelToken(ClipPublication.name),
          useValue: MockPublicationModel,
        },
        {
          provide: getQueueToken(YOUTUBE_PUBLISHING_QUEUE),
          useValue: mockQueue,
        },
        {
          provide: YouTubeOAuthService,
          useValue: mockOAuthService,
        },
        {
          provide: JobsService,
          useValue: mockJobsService,
        },
      ],
    }).compile();

    service = module.get<YouTubePublishingService>(YouTubePublishingService);
  });

  describe('getConnectionStatus', () => {
    it('should return connected: false when no connection exists', async () => {
      mockOAuthService.findConnectionByUserId.mockResolvedValue(null);

      const status = await service.getConnectionStatus(
        '507f1f77bcf86cd799439011',
      );
      expect(status).toEqual({ connected: false, channel: null });
    });

    it('should return channel info when connected', async () => {
      mockOAuthService.findConnectionByUserId.mockResolvedValue({
        channelId: 'UC123',
        channelTitle: 'My Channel',
        channelThumbnail: 'http://img.url',
      });

      const status = await service.getConnectionStatus(
        '507f1f77bcf86cd799439011',
      );
      expect(status.connected).toBe(true);
      expect(status.channel?.title).toBe('My Channel');
    });
  });

  describe('publishClip', () => {
    const userId = new Types.ObjectId().toString();
    const jobId = new Types.ObjectId().toString();
    const clipId = 'clip_01';

    it('should throw YouTubeNotConnectedException when user has no YouTube connection', async () => {
      mockJobsService.getClipForDownload.mockResolvedValue({
        job: {},
        clip: { id: clipId, r2ObjectKey: 'path/to/clip.mp4' },
      });
      mockOAuthService.findConnectionByUserId.mockResolvedValue(null);

      await expect(
        service.publishClip(userId, jobId, clipId, {
          title: 'Test Title',
          privacyStatus: 'private',
        }),
      ).rejects.toThrow(YouTubeNotConnectedException);
    });

    it('should throw ConflictException if publication is already in progress', async () => {
      mockJobsService.getClipForDownload.mockResolvedValue({
        job: {},
        clip: { id: clipId, r2ObjectKey: 'path/to/clip.mp4' },
      });
      mockOAuthService.findConnectionByUserId.mockResolvedValue({
        channelId: 'UC123',
      });
      mockFindOne.mockReturnValue({
        exec: jest
          .fn()
          .mockResolvedValue({ status: PublicationStatus.UPLOADING }),
      });

      await expect(
        service.publishClip(userId, jobId, clipId, {
          title: 'Test Title',
          privacyStatus: 'private',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should create publication and enqueue BullMQ job when valid', async () => {
      mockJobsService.getClipForDownload.mockResolvedValue({
        job: {},
        clip: { id: clipId, r2ObjectKey: 'path/to/clip.mp4' },
      });
      mockOAuthService.findConnectionByUserId.mockResolvedValue({
        channelId: 'UC123',
      });
      mockFindOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const result = await service.publishClip(userId, jobId, clipId, {
        title: 'My YouTube Clip',
        description: 'Check this out!',
        privacyStatus: 'private',
      });

      expect(result.success).toBe(true);
      expect(mockQueue.add).toHaveBeenCalledTimes(1);
    });
  });

  describe('retryPublication', () => {
    const userId = new Types.ObjectId().toString();
    const jobId = new Types.ObjectId().toString();
    const clipId = 'clip_01';
    const pubId = new Types.ObjectId().toString();

    it('should throw ConflictException if publication is not in failed status', async () => {
      mockJobsService.getClipForDownload.mockResolvedValue({
        job: {},
        clip: { id: clipId, r2ObjectKey: 'path/to/clip.mp4' },
      });
      mockFindById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: pubId,
          userId,
          status: PublicationStatus.PUBLISHED,
        }),
      });

      await expect(
        service.retryPublication(userId, jobId, clipId, pubId),
      ).rejects.toThrow(ConflictException);
    });

    it('should re-enqueue and reset status to QUEUED when publication is failed', async () => {
      const mockPub = {
        _id: pubId,
        userId,
        status: PublicationStatus.FAILED,
        error: 'Network timeout',
        save: jest.fn().mockResolvedValue(true),
      };

      mockJobsService.getClipForDownload.mockResolvedValue({
        job: {},
        clip: { id: clipId, r2ObjectKey: 'path/to/clip.mp4' },
      });
      mockFindById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockPub),
      });

      const result = await service.retryPublication(
        userId,
        jobId,
        clipId,
        pubId,
      );
      expect(result.success).toBe(true);
      expect(mockPub.status).toBe(PublicationStatus.QUEUED);
      expect(mockPub.error).toBeUndefined();
      expect(mockQueue.add).toHaveBeenCalledTimes(1);
    });
  });
});
