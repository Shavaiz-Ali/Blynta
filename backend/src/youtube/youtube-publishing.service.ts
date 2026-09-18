import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Model, Types } from 'mongoose';
import {
  ClipPublication,
  ClipPublicationDocument,
  PublicationPlatform,
  PublicationStatus,
} from './schemas/clip-publication.schema';
import { YouTubeOAuthService } from './youtube-oauth.service';
import { YouTubeNotConnectedException } from './exceptions/youtube-not-connected.exception';
import { PublishToYouTubeDto } from './dto/publish-to-youtube.dto';
import { JobsService } from '../jobs/jobs.service';
import { YOUTUBE_PUBLISHING_QUEUE, YOUTUBE_JOB_TYPES } from './youtube.constants';

/** Statuses that block a new publication (an upload is already in progress). */
const ACTIVE_PUBLICATION_STATUSES: PublicationStatus[] = [
  PublicationStatus.QUEUED,
  PublicationStatus.UPLOADING,
  PublicationStatus.PROCESSING,
];

@Injectable()
export class YouTubePublishingService {
  private readonly logger = new Logger(YouTubePublishingService.name);

  constructor(
    @InjectModel(ClipPublication.name)
    private publicationModel: Model<ClipPublicationDocument>,
    @InjectQueue(YOUTUBE_PUBLISHING_QUEUE) private youtubeQueue: Queue,
    private youtubeOAuthService: YouTubeOAuthService,
    private jobsService: JobsService,
  ) {}

  // ---------------------------------------------------------------------------
  // Connection status
  // ---------------------------------------------------------------------------

  async getConnectionStatus(userId: string) {
    const connection = await this.youtubeOAuthService.findConnectionByUserId(userId);
    if (!connection) {
      return { connected: false, channel: null };
    }
    return {
      connected: true,
      channel: {
        id: connection.channelId,
        title: connection.channelTitle,
        thumbnail: connection.channelThumbnail || null,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Disconnect
  // ---------------------------------------------------------------------------

  async disconnectYouTube(
    userId: string,
  ): Promise<{ success: boolean; message: string }> {
    const connection = await this.youtubeOAuthService.findConnectionByUserId(userId);
    if (!connection) {
      return {
        success: true,
        message: 'YouTube account was already disconnected.',
      };
    }

    await this.youtubeOAuthService.revokeAndDelete(userId);

    return { success: true, message: 'YouTube account disconnected successfully.' };
  }

  // ---------------------------------------------------------------------------
  // Publish
  // ---------------------------------------------------------------------------

  async publishClip(
    userId: string,
    jobId: string,
    clipId: string,
    dto: PublishToYouTubeDto,
  ): Promise<{
    success: boolean;
    publication: Partial<ClipPublicationDocument>;
  }> {
    // 1. Verify clip exists and belongs to user (throws NotFoundException / JobAccessDeniedException)
    const { clip } = await this.jobsService.getClipForDownload(userId, jobId, clipId);

    // clip.r2ObjectKey is verified non-null by getClipForDownload
    void clip; // referenced above just for the side-effect check

    // 2. Verify YouTube is connected
    const connection = await this.youtubeOAuthService.findConnectionByUserId(userId);
    if (!connection) {
      throw new YouTubeNotConnectedException();
    }

    const existing = await this.publicationModel
      .findOne({
        userId: new Types.ObjectId(userId),
        jobId: new Types.ObjectId(jobId),
        clipId,
        platform: PublicationPlatform.YOUTUBE,
        status: { $in: ACTIVE_PUBLICATION_STATUSES },
      })
      .exec();

    if (existing) {
      throw new ConflictException('This clip is already being published to YouTube.');
    }

    // 4. Create publication record
    const publication = new this.publicationModel({
      userId: new Types.ObjectId(userId),
      jobId: new Types.ObjectId(jobId),
      clipId,
      platform: PublicationPlatform.YOUTUBE,
      status: PublicationStatus.QUEUED,
      title: dto.title,
      description: dto.description,
      privacyStatus: dto.privacyStatus,
    });
    const saved = await publication.save();

    // 5. Enqueue BullMQ job — the HTTP request returns immediately
    await this.youtubeQueue.add(YOUTUBE_JOB_TYPES.UPLOAD, {
      publicationId: saved._id.toString(),
      jobId,
      clipId,
      userId,
    });

    this.logger.log(
      `YouTube publish queued — publicationId=${saved._id} clipId=${clipId}`,
    );

    return {
      success: true,
      publication: {
        _id: saved._id,
        platform: saved.platform,
        status: saved.status,
        title: saved.title,
        privacyStatus: saved.privacyStatus,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // List publications
  // ---------------------------------------------------------------------------

  async getPublications(
    userId: string,
    jobId: string,
    clipId: string,
  ): Promise<{ publications: ClipPublicationDocument[] }> {
    // Ownership check — throws if the job doesn't belong to the user
    await this.jobsService.getJobById(userId, jobId);

    const publications = await this.publicationModel
      .find({
        userId: new Types.ObjectId(userId),
        jobId: new Types.ObjectId(jobId),
        clipId,
      })
      .sort({ createdAt: -1 })
      .exec();

    return { publications };
  }

  // ---------------------------------------------------------------------------
  // Retry
  // ---------------------------------------------------------------------------

  async retryPublication(
    userId: string,
    jobId: string,
    clipId: string,
    publicationId: string,
  ): Promise<{ success: boolean; publication: Partial<ClipPublicationDocument> }> {
    // Ownership check
    await this.jobsService.getClipForDownload(userId, jobId, clipId);

    const publication = await this.publicationModel
      .findById(publicationId)
      .exec();

    if (!publication) {
      throw new NotFoundException('Publication not found.');
    }

    if (publication.userId.toString() !== userId) {
      throw new NotFoundException('Publication not found.');
    }

    if (publication.status !== PublicationStatus.FAILED) {
      throw new ConflictException(
        `Cannot retry a publication with status "${publication.status}". Only failed publications can be retried.`,
      );
    }

    // Reset to queued
    publication.status = PublicationStatus.QUEUED;
    publication.error = undefined as any;
    await publication.save();

    // Re-enqueue
    await this.youtubeQueue.add(YOUTUBE_JOB_TYPES.UPLOAD, {
      publicationId: publication._id.toString(),
      jobId,
      clipId,
      userId,
    });

    this.logger.log(`YouTube publication retried — publicationId=${publicationId}`);

    return {
      success: true,
      publication: {
        _id: publication._id,
        platform: publication.platform,
        status: publication.status,
        title: publication.title,
        privacyStatus: publication.privacyStatus,
      },
    };
  }
}
