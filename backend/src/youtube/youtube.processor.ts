import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Job as BullJob } from 'bullmq';
import { Readable } from 'stream';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import {
  ClipPublication,
  ClipPublicationDocument,
  PublicationStatus,
} from './schemas/clip-publication.schema';
import { YouTubeOAuthService } from './youtube-oauth.service';
import { YouTubeApiService } from './youtube-api.service';
import { R2Service } from '../storage/r2.service';
import { JobsService } from '../jobs/jobs.service';
import {
  YOUTUBE_PUBLISHING_QUEUE,
  YOUTUBE_JOB_TYPES,
} from './youtube.constants';
import { YouTubeReauthRequiredException } from './exceptions/youtube-reauth-required.exception';

// We need direct S3Client access from R2Service to stream without downloading to disk
import { S3Client } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';

export interface YouTubeUploadJobData {
  publicationId: string;
  jobId: string;
  clipId: string;
  userId: string;
}

@Processor(YOUTUBE_PUBLISHING_QUEUE, {
  concurrency: 1,
  lockDuration: 10 * 60 * 1000, // 10 min — uploads can take a while
  stalledInterval: 60_000,
  maxStalledCount: 1,
})
export class YouTubeProcessor extends WorkerHost {
  private readonly logger = new Logger(YouTubeProcessor.name);
  private readonly s3Client: S3Client;
  private readonly bucket: string;

  constructor(
    @InjectModel(ClipPublication.name)
    private publicationModel: Model<ClipPublicationDocument>,
    private youtubeOAuthService: YouTubeOAuthService,
    private youtubeApiService: YouTubeApiService,
    private jobsService: JobsService,
    private r2Service: R2Service,
    private configService: ConfigService,
  ) {
    super();

    // Build our own S3Client so we can stream directly without a temp file
    this.bucket = this.configService.get<string>('R2_BUCKET_NAME', '');
    const endpoint = this.configService.get<string>('R2_ENDPOINT', '');
    const accessKeyId = this.configService.get<string>('R2_ACCESS_KEY_ID', '');
    const secretAccessKey = this.configService.get<string>(
      'R2_SECRET_ACCESS_KEY',
      '',
    );

    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: endpoint || undefined,
      credentials: { accessKeyId, secretAccessKey },
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }

  async process(bullJob: BullJob<YouTubeUploadJobData>): Promise<void> {
    if (bullJob.name === YOUTUBE_JOB_TYPES.UPLOAD) {
      await this.handleYouTubeUpload(bullJob.data);
    }
  }

  private async handleYouTubeUpload(data: YouTubeUploadJobData): Promise<void> {
    const { publicationId, jobId, clipId, userId } = data;
    this.logger.log(
      `Processing YouTube upload — publicationId=${publicationId}`,
    );

    // Load publication
    const publication = await this.publicationModel
      .findById(publicationId)
      .exec();
    if (!publication) {
      this.logger.error(`Publication ${publicationId} not found — skipping`);
      return;
    }

    // Mark uploading
    publication.status = PublicationStatus.UPLOADING;
    await publication.save();

    try {
      // Load clip (validates ownership implicitly — throws if not found)
      const { clip } = await this.jobsService.getClipForDownload(
        userId,
        jobId,
        clipId,
      );

      if (!clip.r2ObjectKey) {
        throw new Error(
          'Clip has no R2 object key — it may not have been processed yet.',
        );
      }

      // Load YouTube connection (with tokens)
      const connection =
        await this.youtubeOAuthService.findConnectionWithTokens(userId);
      if (!connection) {
        throw new Error(
          'YouTube connection not found. User may have disconnected.',
        );
      }

      // Get a valid (possibly refreshed) access token
      const accessToken =
        await this.youtubeOAuthService.getValidAccessToken(connection);

      // Stream the clip directly from R2 to YouTube — no temp file needed
      const r2Response = await this.s3Client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: clip.r2ObjectKey }),
      );

      const videoStream = r2Response.Body as Readable;
      const contentLength = r2Response.ContentLength;

      this.logger.log(
        `Uploading clip ${clipId} (${contentLength ?? 'unknown'} bytes) to YouTube`,
      );

      // Upload to YouTube — include tags and categoryId from the publication record
      const result = await this.youtubeApiService.uploadVideo(
        accessToken,
        {
          title: publication.title,
          description: publication.description,
          privacyStatus: publication.privacyStatus as
            'private' | 'unlisted' | 'public',
          ...(publication.categoryId
            ? { categoryId: publication.categoryId }
            : {}),
          ...(publication.tags && publication.tags.length > 0
            ? { tags: publication.tags }
            : {}),
        },
        videoStream,
        contentLength,
      );

      // Save the YouTube video ID immediately — even if thumbnail fails the video is live
      publication.status = PublicationStatus.PUBLISHED;
      publication.externalId = result.videoId;
      publication.externalUrl = result.videoUrl;
      publication.publishedAt = new Date();
      await publication.save();

      this.logger.log(
        `YouTube upload complete — videoId=${result.videoId} publicationId=${publicationId}`,
      );

      // -----------------------------------------------------------------------
      // Optional: set custom thumbnail
      // IMPORTANT: thumbnail failure is non-fatal — the video is already live.
      // We log a warning but do NOT change the publication status to failed.
      // -----------------------------------------------------------------------
      if (publication.thumbnailKey) {
        try {
          this.logger.log(
            `Setting custom thumbnail for video ${result.videoId} from key ${publication.thumbnailKey}`,
          );
          const imageBuffer = await this.r2Service.downloadToBuffer(
            publication.thumbnailKey,
          );
          await this.youtubeApiService.setThumbnail(
            accessToken,
            result.videoId,
            imageBuffer,
          );
          this.logger.log(`Custom thumbnail set for video ${result.videoId}`);
        } catch (thumbnailErr: any) {
          this.logger.warn(
            `Custom thumbnail upload failed (non-fatal) for video ${result.videoId}: ${thumbnailErr?.message}`,
          );
          // Store the thumbnail error in metadata for debugging, but keep status = PUBLISHED
          publication.metadata = {
            ...(publication.metadata ?? {}),
            thumbnailError: thumbnailErr?.message ?? 'Unknown thumbnail error',
          };
          await publication.save();
        }
      }
    } catch (err: any) {
      const isReauth = err instanceof YouTubeReauthRequiredException;
      const errorMessage = isReauth
        ? 'YouTube connection expired. Please reconnect your account.'
        : this.getSafeErrorMessage(err);

      this.logger.error(
        `YouTube upload failed — publicationId=${publicationId}: ${err?.message ?? err}`,
        !isReauth ? err?.stack : undefined,
      );

      publication.status = PublicationStatus.FAILED;
      publication.error = errorMessage;
      await publication.save();

      // Re-throw so BullMQ records the failure properly
      throw err;
    }
  }

  /**
   * Converts a raw error into a safe, user-facing message.
   * Never exposes stack traces or raw API error objects.
   */
  private getSafeErrorMessage(err: any): string {
    const youtubeError = err?.response?.data?.error;
    if (youtubeError) {
      // YouTube API errors have a structured format
      const ytMessage =
        youtubeError?.message || youtubeError?.errors?.[0]?.message;
      if (ytMessage) {
        return `YouTube API error: ${ytMessage}`;
      }
    }
    if (
      err?.message &&
      typeof err.message === 'string' &&
      err.message.length < 300
    ) {
      return err.message;
    }
    return 'An unexpected error occurred during the YouTube upload.';
  }
}
