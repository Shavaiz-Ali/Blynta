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
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JobsService } from './jobs.service';
import { CreateJobDto } from './dto/create-job.dto';
import { ListJobsDto } from './dto/list-jobs.dto';
import { R2Service } from '../storage/r2.service';
import { UsersService } from '../users/users.service';
import { UserPlan } from '../users/schemas/user.schema';
import { JobDocument } from './schemas/job.schema';
import { STYLE_PRESETS } from '../media/style-presets';

@Controller('jobs')
@UseGuards(AuthGuard('jwt'))
export class JobsController {
  constructor(
    private jobsService: JobsService,
    private usersService: UsersService,
    private r2Service: R2Service,
  ) { }

  private shapeJobResponse(job: JobDocument, userPlan: UserPlan) {
    const responseJob = job.toObject();
    if (userPlan === UserPlan.FREE && responseJob.highlights) {
      responseJob.highlights = responseJob.highlights.map((h: any) => {
        const { clipDescription, ...rest } = h;
        return rest;
      });
    }
    return responseJob;
  }

  // POST /jobs — create a new clip job
  @Post()
  async create(@Request() req, @Body() dto: CreateJobDto) {
    const user = await this.usersService.findById(req.user.userId);
    const plan = user?.plan || UserPlan.FREE;
    const job = await this.jobsService.createJob(req.user.userId, dto);
    return this.shapeJobResponse(job, plan);
  }

  // GET /jobs?status=completed&page=1&limit=20 — paginated + filterable job list (Task 1)
  @Get()
  async findAll(@Request() req, @Query() query: ListJobsDto) {
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
      jobs: result.jobs.map((job) => this.shapeJobResponse(job, plan)),
    };
  }

  // GET /jobs/style-presets — returns the public-safe shape for style presets
  @Get('style-presets')
  getStylePresets() {
    return Object.values(STYLE_PRESETS).map(({ key, label, isPro }) => ({ key, label, isPro }));
  }

  // GET /jobs/:id — single job detail
  @Get(':id')
  async findOne(@Request() req, @Param('id') id: string) {
    const [job, user] = await Promise.all([
      this.jobsService.getJobById(req.user.userId, id),
      this.usersService.findById(req.user.userId),
    ]);
    const plan = user?.plan || UserPlan.FREE;
    return this.shapeJobResponse(job, plan);
  }

  // DELETE /jobs/:id — delete a completed/failed job and its files (Task 2)
  @Delete(':id')
  deleteJob(@Request() req, @Param('id') id: string) {
    return this.jobsService.deleteJob(req.user.userId, id);
  }

  // POST /jobs/:id/retry — recreate a failed job as a new job (Task 4)
  @Post(':id/retry')
  async retryJob(@Request() req, @Param('id') id: string) {
    const user = await this.usersService.findById(req.user.userId);
    const plan = user?.plan || UserPlan.FREE;
    const job = await this.jobsService.retryJob(req.user.userId, id);
    return this.shapeJobResponse(job, plan);
  }

  // GET /jobs/:jobId/clips/:clipId/download — returns a time-limited presigned R2 download URL
  @Get(':jobId/clips/:clipId/download')
  async downloadClip(
    @Request() req,
    @Param('jobId') jobId: string,
    @Param('clipId') clipId: string,
  ): Promise<{ signedUrl: string }> {
    const { clip } = await this.jobsService.getClipForDownload(
      req.user.userId,
      jobId,
      clipId,
    );

    const signedUrl = await this.r2Service.getSignedDownloadUrl(clip.r2ObjectKey, 3600);
    return { signedUrl };
  }

  // DELETE /jobs/:jobId/clips/:clipId — remove a single clip from a job (Task 3)
  @Delete(':jobId/clips/:clipId')
  deleteClip(
    @Request() req,
    @Param('jobId') jobId: string,
    @Param('clipId') clipId: string,
  ) {
    return this.jobsService.deleteClip(req.user.userId, jobId, clipId);
  }
}