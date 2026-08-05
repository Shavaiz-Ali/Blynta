import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JobsService } from './jobs.service';
import { CreateJobDto } from './dto/create-job.dto';

@Controller('jobs')
@UseGuards(AuthGuard('jwt')) // protects every route in this controller at once
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
}