import {
  Injectable,
  Logger,
  NotFoundException,
  GoneException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as crypto from 'crypto';
import { Share, ShareDocument } from './schemas/share.schema';
import { CreateShareDto } from './dto/create-share.dto';
import { UpdateShareDto } from './dto/update-share.dto';
import { JobsService } from '../jobs/jobs.service';
import { R2Service } from '../storage/r2.service';
import { ShareAccessDeniedException } from '../common/exceptions';

/** Minimum TTL for per-request R2 signed URLs (15 min). */
const PUBLIC_SIGNED_URL_TTL_SECONDS = 15 * 60;

function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function generateRawToken(): string {
  return crypto.randomBytes(32).toString('hex'); // 64 hex chars
}

/** Shape returned to the owner for their share list/detail. */
export interface ShareView {
  id: string;
  jobId: string;
  clipId: string;
  token?: string | null;
  isActive: boolean;
  expiresAt: string | null;
  revokedAt: string | null;
  accessCount: number;
  lastAccessedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Shape returned to the owner on creation (includes raw token once). */
export interface CreateShareResponse extends ShareView {
  token: string;
}

/** Shape returned to the public (no owner info, no tokenHash). */
export interface PublicShareResponse {
  clipTitle: string | null;
  videoTitle: string | null;
  thumbnailUrl: string | null;
  durationSec: number;
  hasCaptions: boolean;
  signedUrl: string;
  expiresAt: string | null;
}

function toShareView(doc: ShareDocument): ShareView {
  const obj = doc.toObject() as ShareDocument & {
    _id: Types.ObjectId;
    rawToken?: string;
    createdAt: Date;
    updatedAt: Date;
  };
  return {
    id: obj._id.toString(),
    jobId: obj.jobId.toString(),
    clipId: obj.clipId.toString(),
    token: obj.rawToken || null,
    isActive: obj.isActive,
    expiresAt: obj.expiresAt ? obj.expiresAt.toISOString() : null,
    revokedAt: obj.revokedAt ? obj.revokedAt.toISOString() : null,
    accessCount: obj.accessCount,
    lastAccessedAt: obj.lastAccessedAt
      ? obj.lastAccessedAt.toISOString()
      : null,
    createdAt: obj.createdAt.toISOString(),
    updatedAt: obj.updatedAt.toISOString(),
  };
}

@Injectable()
export class SharesService {
  private readonly logger = new Logger(SharesService.name);

  constructor(
    @InjectModel(Share.name) private shareModel: Model<ShareDocument>,
    private readonly jobsService: JobsService,
    private readonly r2Service: R2Service,
  ) {}

  /** POST /shares — create a new share link for a clip the caller owns. */
  async createShare(
    userId: string,
    dto: CreateShareDto,
  ): Promise<CreateShareResponse> {
    // Ownership + existence check — throws NotFoundException / ForbiddenException
    const { clip } = await this.jobsService.getClipForDownload(
      userId,
      dto.jobId,
      dto.clipId,
    );

    const rawToken = generateRawToken();
    const tokenHash = sha256(rawToken);

    const share = await this.shareModel.create({
      ownerId: new Types.ObjectId(userId),
      jobId: new Types.ObjectId(dto.jobId),
      clipId: new Types.ObjectId(dto.clipId),
      tokenHash,
      rawToken,
      isActive: true,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      revokedAt: null,
      accessCount: 0,
      lastAccessedAt: null,
    });

    this.logger.log(
      `Share created for clip ${clip._id} by user ${userId} [shareId=${share._id}]`,
    );

    return { ...toShareView(share), token: rawToken };
  }

  /** GET /shares — list all shares the caller owns, optionally filtered by clipId. */
  async getMyShares(userId: string, clipId?: string): Promise<ShareView[]> {
    const filter: Record<string, unknown> = {
      ownerId: new Types.ObjectId(userId),
    };
    if (clipId && Types.ObjectId.isValid(clipId)) {
      filter.clipId = new Types.ObjectId(clipId);
    }
    const shares = await this.shareModel
      .find(filter)
      .sort({ createdAt: -1 })
      .exec();
    return shares.map(toShareView);
  }

  /** GET /shares/:id — single share owned by caller. */
  async getShareById(userId: string, shareId: string): Promise<ShareView> {
    const share = await this.findOwnedShare(userId, shareId);
    return toShareView(share);
  }

  /** PATCH /shares/:id — update editable fields. */
  async updateShare(
    userId: string,
    shareId: string,
    dto: UpdateShareDto,
  ): Promise<ShareView> {
    const share = await this.findOwnedShare(userId, shareId);

    if (dto.isActive !== undefined) share.isActive = dto.isActive;
    if (dto.expiresAt !== undefined) {
      share.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    }

    const updated = await share.save();
    return toShareView(updated);
  }

  /** DELETE /shares/:id — revoke (soft-delete). */
  async revokeShare(
    userId: string,
    shareId: string,
  ): Promise<{ message: string }> {
    const share = await this.findOwnedShare(userId, shareId);

    share.isActive = false;
    share.revokedAt = new Date();
    await share.save();

    return { message: 'Share revoked successfully' };
  }

  /**
   * GET /shares/public/:token — resolve a public token without authentication.
   *
   * Flow:
   * 1. Hash the raw token.
   * 2. Find the share by hash.
   * 3. Validate active / not revoked / not expired.
   * 4. Verify the clip still exists and has an R2 key.
   * 5. Increment access counters.
   * 6. Return a short-lived signed URL + public clip metadata.
   */
  async resolvePublicShare(rawToken: string): Promise<PublicShareResponse> {
    const tokenHash = sha256(rawToken);

    const share = await this.shareModel.findOne({ tokenHash }).exec();

    if (!share) {
      throw new NotFoundException('Share link not found');
    }

    if (!share.isActive || share.revokedAt) {
      throw new GoneException('This share link is no longer available');
    }

    if (share.expiresAt && share.expiresAt < new Date()) {
      throw new GoneException('This share link has expired');
    }

    // Verify the referenced clip still exists (no ownership check — public)
    let clip: import('../jobs/schemas/job.schema').Clip | undefined;
    let jobTitle: string | null = null;
    let thumbnailUrl: string | null = null;

    try {
      const job = await this.jobsService.getJobById(
        share.ownerId.toString(),
        share.jobId.toString(),
      );
      clip = job.clips.find(
        (c) => c._id.toString() === share.clipId.toString(),
      );
      jobTitle = job.videoTitle || null;
      thumbnailUrl = job.thumbnailUrl || null;
    } catch {
      throw new GoneException('The shared clip is no longer available');
    }

    if (!clip) {
      throw new GoneException('The shared clip is no longer available');
    }

    if (!clip.r2ObjectKey) {
      throw new GoneException('The shared clip file is not yet ready');
    }

    // Generate a short-lived signed URL — do not expose the raw R2 key
    const signedUrl = await this.r2Service.getSignedDownloadUrl(
      clip.r2ObjectKey,
      PUBLIC_SIGNED_URL_TTL_SECONDS,
    );

    // Record access (non-blocking — don't let analytics fail the response)
    this.shareModel
      .updateOne(
        { _id: share._id },
        {
          $inc: { accessCount: 1 },
          $set: { lastAccessedAt: new Date() },
        },
      )
      .exec()
      .catch((err: unknown) => {
        this.logger.warn(
          `Failed to record share access for ${share._id}: ${err instanceof Error ? err.message : err}`,
        );
      });

    const durationSec = Math.max(0, Math.round(clip.endTime - clip.startTime));

    return {
      clipTitle: null, // highlight title is not stored on the clip itself
      videoTitle: jobTitle,
      thumbnailUrl,
      durationSec,
      hasCaptions: clip.hasCaptions,
      signedUrl,
      expiresAt: share.expiresAt ? share.expiresAt.toISOString() : null,
    };
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private async findOwnedShare(
    userId: string,
    shareId: string,
  ): Promise<ShareDocument> {
    if (!Types.ObjectId.isValid(shareId)) {
      throw new NotFoundException('Share not found');
    }

    const share = await this.shareModel.findById(shareId).exec();

    if (!share) {
      throw new NotFoundException('Share not found');
    }

    if (share.ownerId.toString() !== userId) {
      throw new ShareAccessDeniedException();
    }

    return share;
  }
}
