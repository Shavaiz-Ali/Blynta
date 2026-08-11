import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Request,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { createReadStream } from 'fs';
import { JobsService } from './jobs.service';
import { CreateJobDto } from './dto/create-job.dto';
import { ListJobsDto } from './dto/list-jobs.dto';
import * as path from 'path';

@Controller('jobs')
@UseGuards(AuthGuard('jwt'))
export class JobsController {
  constructor(private jobsService: JobsService) {}

  // POST /jobs — create a new clip job
  @Post()
  create(@Request() req, @Body() dto: CreateJobDto) {
    return this.jobsService.createJob(req.user.userId, dto);
  }

  // GET /jobs?status=completed&page=1&limit=20 — paginated + filterable job list (Task 1)
  @Get()
  findAll(@Request() req, @Query() query: ListJobsDto) {
    return this.jobsService.getJobsForUser(req.user.userId, {
      status: query.status,
      page: query.page,
      limit: query.limit,
    });
  }

  // GET /jobs/:id — single job detail
  @Get(':id')
  findOne(@Request() req, @Param('id') id: string) {
    return this.jobsService.getJobById(req.user.userId, id);
  }

  // DELETE /jobs/:id — delete a completed/failed job and its files (Task 2)
  @Delete(':id')
  deleteJob(@Request() req, @Param('id') id: string) {
    return this.jobsService.deleteJob(req.user.userId, id);
  }

  // POST /jobs/:id/retry — recreate a failed job as a new job (Task 4)
  @Post(':id/retry')
  retryJob(@Request() req, @Param('id') id: string) {
    return this.jobsService.retryJob(req.user.userId, id);
  }

  // GET /jobs/:jobId/clips/:clipId/download — stream a clip file for download
  @Get(':jobId/clips/:clipId/download')
  async downloadClip(
    @Request() req,
    @Param('jobId') jobId: string,
    @Param('clipId') clipId: string,
    @Res({ passthrough: true }) res: any,
  ): Promise<StreamableFile> {
    const { clip, filePath } = await this.jobsService.getClipForDownload(
      req.user.userId,
      jobId,
      clipId,
    );

    try {
      const stream = createReadStream(filePath);
      const filename = `clip-${clip._id}.mp4`;
      res.set({
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="${filename}"`,
      });
      return new StreamableFile(stream);
    } catch (err) {
      throw new NotFoundException('Clip file not found on disk');
    }
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