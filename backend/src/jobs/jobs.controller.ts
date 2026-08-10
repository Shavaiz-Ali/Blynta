import { Body, Controller, Get, Param, Post, Request, Res, StreamableFile, UseGuards, NotFoundException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { createReadStream } from 'fs';
import { JobsService } from './jobs.service';
import { CreateJobDto } from './dto/create-job.dto';
import * as path from 'path';

@Controller('jobs')
@UseGuards(AuthGuard('jwt'))
export class JobsController {
  constructor(private jobsService: JobsService) {}

  @Post()
  create(@Request() req, @Body() dto: CreateJobDto) {
    return this.jobsService.createJob(req.user.userId, dto);
  }

  @Get()
  findAll(@Request() req) {
    return this.jobsService.getJobsForUser(req.user.userId);
  }

  @Get(':id')
  findOne(@Request() req, @Param('id') id: string) {
    return this.jobsService.getJobById(req.user.userId, id);
  }

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
}