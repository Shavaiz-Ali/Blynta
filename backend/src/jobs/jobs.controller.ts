import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DownloadClipDto } from './dto/download-clip.dto';
import { clipFailure } from './clip-failure';
import { jobFailure } from './job-failure';
import { AuthGuard } from '@nestjs/passport';
import { JobsService } from './jobs.service';
import { BillingRateLimitGuard } from '../billing/billing-rate-limit.guard';
import { CreditsService } from '../billing/credits.service';
import { Optional } from '@nestjs/common';
import { CreateJobDto } from './dto/create-job.dto';
import { ListJobsDto } from './dto/list-jobs.dto';
import { R2Service } from '../storage/r2.service';
import { UsersService } from '../users/users.service';
import { UserPlan } from '../users/schemas/user.schema';
import { JobDocument, JobStatus } from './schemas/job.schema';
import { STYLE_PRESETS } from '../media/style-presets';
import { ActivitiesService } from '../activities/activities.service';
import {
  ActivityActorType,
  ActivityCategory,
  ActivitySeverity,
  ActivityStatus,
  ActivityType,
} from '../activities/schemas/activity.schema';

@Controller('jobs')
@UseGuards(AuthGuard('jwt'))
export class JobsController {
  private readonly logger = new Logger(JobsController.name);
  constructor(
    private jobsService: JobsService,
    private usersService: UsersService,
    private r2Service: R2Service,
    private activitiesService: ActivitiesService,
    @Optional() private credits?: CreditsService,
  ) {}

  private async shapeJobResponse(job: JobDocument, userPlan: UserPlan) {
    const responseJob = job.toObject<JobDocument>();
    const processingFailure = jobFailure(responseJob);
    Reflect.deleteProperty(responseJob, 'errorMessage');
    Reflect.deleteProperty(responseJob, 'activeExecutions');
    Reflect.deleteProperty(responseJob, 'mediaExecutionLeases');
    let sourceAvailable: boolean | undefined;
    if (responseJob.clips?.some((clip) => clip.status === JobStatus.FAILED)) {
      sourceAvailable = job.sourceObjectKey
        ? await this.r2Service
            .fileExists(job.sourceObjectKey)
            .catch(() => undefined)
        : false;
    }
    const clips = responseJob.clips?.map((clip) => {
      const { errorMessage, errorStage, retryRequested, ...safe } = clip;
      void errorMessage;
      void errorStage;
      void retryRequested;
      return {
        ...safe,
        ...(clip.status === JobStatus.FAILED
          ? {
              failure: {
                ...clipFailure(clip, sourceAvailable),
                ...(job.cancellationRequestedAt
                  ? { retryAvailable: false }
                  : {}),
              },
            }
          : {}),
      };
    });
    if (userPlan === UserPlan.FREE && responseJob.highlights) {
      responseJob.highlights = responseJob.highlights.map((h) => {
        const copy = { ...h };
        Reflect.deleteProperty(copy, 'clipDescription');
        return copy;
      });
    }
    const render = job.renderManifestReady
      ? await this.jobsService.getRenderSnapshot(job)
      : undefined;
    const creditOperation =
      job.creditOperationId && this.credits
        ? await this.credits.operations
            .findOne({
              operationId: job.creditOperationId,
              userId: String(job.userId),
            })
            .lean()
        : null;
    return {
      ...responseJob,
      ...(creditOperation
        ? {
            billing: {
              authorized: creditOperation.authorized,
              held: creditOperation.held,
              charged: creditOperation.charged,
              status: creditOperation.status,
              pricingVersion: creditOperation.pricing.version,
            },
          }
        : {}),
      ...(processingFailure
        ? { processingFailure, errorMessage: processingFailure.message }
        : {}),
      deletionAvailable:
        [JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED].includes(
          job.status,
        ) && !job.activeExecutions?.length,
      ...(job.cancellationRequestedAt && !render ? { progressPercent: 0 } : {}),
      ...(job.status === JobStatus.CANCELLING &&
      job.cancellationRequestedAt &&
      Date.now() - new Date(job.cancellationRequestedAt).getTime() > 30000
        ? { cancellationPendingReason: 'worker_confirmation_required' }
        : {}),
      ...(clips ? { clips } : {}),
      ...(job.renderManifestReady && job.status === JobStatus.FAILED
        ? {
            errorMessage:
              'Some clips could not be created. Retry the failed clips to finish this video.',
          }
        : {}),
      estimatedRemainingSeconds: render
        ? render.estimatedRemainingSeconds
        : job.status === JobStatus.COMPLETED
          ? 0
          : null,
      ...(render ? { render, progressPercent: render.progressPercent } : {}),
    };
  }

  // POST /jobs — create a new clip job
  @Post()
  @UseGuards(BillingRateLimitGuard)
  async create(
    @Request() req: { user: { userId: string } },
    @Body() dto: CreateJobDto,
  ) {
    const user = await this.usersService.findById(req.user.userId);
    const plan = user?.plan || UserPlan.FREE;
    const job = await this.jobsService.createJob(req.user.userId, dto);
    return this.shapeJobResponse(job, plan);
  }

  // GET /jobs?status=completed&page=1&limit=20 — paginated + filterable job list (Task 1)
  @Get()
  async findAll(
    @Request() req: { user: { userId: string } },
    @Query() query: ListJobsDto,
  ) {
    const [result, user] = await Promise.all([
      this.jobsService.getJobsForUser(req.user.userId, {
        status: query.status,
        page: query.page,
        limit: query.limit,
      }),
      this.usersService.findById(req.user.userId),
    ]);
    const plan = user?.plan || UserPlan.FREE;
    return {
      ...result,
      jobs: await Promise.all(
        result.jobs.map((job) => this.shapeJobResponse(job, plan)),
      ),
    };
  }

  // GET /jobs/style-presets — returns the public-safe shape for style presets
  @Get('style-presets')
  getStylePresets() {
    return Object.values(STYLE_PRESETS).map(({ key, label, isPro }) => ({
      key,
      label,
      isPro,
    }));
  }

  // GET /jobs/:id — single job detail
  @Get(':id')
  async findOne(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
  ) {
    await this.jobsService.getJobById(req.user.userId, id);
    await this.jobsService
      .finalizeCancellation(id)
      .catch((error) =>
        this.logger.warn(`Cancellation remains pending: ${error}`),
      );
    const [job, user] = await Promise.all([
      this.jobsService.getJobById(req.user.userId, id),
      this.usersService.findById(req.user.userId),
    ]);
    const plan = user?.plan || UserPlan.FREE;
    return this.shapeJobResponse(job, plan);
  }

  @Post(':id/cancel')
  async cancelJob(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
  ) {
    const job = await this.jobsService.cancelJob(req.user.userId, id);
    const user = await this.usersService.findById(req.user.userId);
    return this.shapeJobResponse(job, user?.plan || UserPlan.FREE);
  }

  // DELETE /jobs/:id — delete a completed/failed job and its files (Task 2)
  @Delete(':id')
  deleteJob(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
  ) {
    return this.jobsService.deleteJob(req.user.userId, id);
  }

  // POST /jobs/:id/retry — resume the same failed job in-place (Step 2)
  // Returns { jobId, status: 'queued_for_retry' } — no new job doc, same page.
  @Post(':id/retry')
  retryJob(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
  ) {
    return this.jobsService.retryJob(req.user.userId, id);
  }

  @Post(':jobId/clips/:clipId/retry')
  retryClip(
    @Request() req: { user: { userId: string } },
    @Param('jobId') jobId: string,
    @Param('clipId') clipId: string,
  ) {
    return this.jobsService.retryClip(req.user.userId, jobId, clipId);
  }

  // Keep old GET clients safe: URL retrieval never records a user download.
  @Get(':jobId/clips/:clipId/download')
  legacyClipUrl(
    @Request() req: { user: { userId: string } },
    @Param('jobId') jobId: string,
    @Param('clipId') clipId: string,
  ) {
    return this.clipMediaUrl(req, jobId, clipId);
  }

  @Get(':jobId/clips/:clipId/media-url')
  async clipMediaUrl(
    @Request() req: { user: { userId: string } },
    @Param('jobId') jobId: string,
    @Param('clipId') clipId: string,
  ): Promise<{ signedUrl: string }> {
    const { clip } = await this.jobsService.getClipForDownload(
      req.user.userId,
      jobId,
      clipId,
    );
    return {
      signedUrl: await this.r2Service.getSignedDownloadUrl(
        clip.r2ObjectKey,
        3600,
      ),
    };
  }

  @Post(':jobId/clips/:clipId/download')
  async downloadClip(
    @Request() req: { user: { userId: string } },
    @Param('jobId') jobId: string,
    @Param('clipId') clipId: string,
    @Body() dto: DownloadClipDto,
  ): Promise<{ signedUrl: string; requestId: string; actionId: string }> {
    const requestId = randomUUID();
    const dedupeKey = `activity:download:${req.user.userId}:${jobId}:${clipId}:${dto.actionId}`;
    this.logger.log(
      JSON.stringify({
        phase: 'clip.download_requested',
        requestId,
        actionId: dto.actionId,
        userId: req.user.userId,
        jobId,
        clipId,
        activityType: ActivityType.CLIP_DOWNLOAD,
        eventId: dedupeKey,
      }),
    );
    const { clip } = await this.jobsService.getClipForDownload(
      req.user.userId,
      jobId,
      clipId,
    );

    const signedUrl = await this.r2Service.getSignedDownloadUrl(
      clip.r2ObjectKey,
      3600,
    );

    await this.activitiesService.queueCreate({
      userId: req.user.userId,
      type: ActivityType.CLIP_DOWNLOAD,
      category: ActivityCategory.JOB,
      title: 'Clip download requested',
      description: 'A download link was generated for your clip.',
      activityUrl: `/my-clips/${jobId}/clips/${clipId}`,
      entityType: 'clip',
      entityId: clip._id,
      actorType: ActivityActorType.USER,
      actorId: req.user.userId,
      status: ActivityStatus.SUCCESS,
      severity: ActivitySeverity.INFO,
      dedupeKey,
      metadata: { jobId, clipId, requestId, actionId: dto.actionId },
    });

    return { signedUrl, requestId, actionId: dto.actionId };
  }

  // DELETE /jobs/:jobId/clips/:clipId — remove a single clip from a job (Task 3)
  @Delete(':jobId/clips/:clipId')
  deleteClip(
    @Request() req: { user: { userId: string } },
    @Param('jobId') jobId: string,
    @Param('clipId') clipId: string,
  ) {
    return this.jobsService.deleteClip(req.user.userId, jobId, clipId);
  }
}
