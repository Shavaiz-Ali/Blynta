import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { AdminGuard } from '../guards/admin.guard';
import { AdminJobsService } from './admin-jobs.service';
import { ListJobsAdminDto } from '../dto/list-jobs-admin.dto';

@Controller('admin/jobs')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminJobsController {
  constructor(private readonly adminJobsService: AdminJobsService) {}

  @Get()
  async listJobs(
    @Query(new ValidationPipe({ transform: true, whitelist: true }))
    query: ListJobsAdminDto,
  ) {
    return this.adminJobsService.listJobs(query);
  }

  @Get('stats')
  async getJobStats() {
    return this.adminJobsService.getJobStats();
  }

  @Get(':id')
  async getJobDetail(@Param('id') id: string) {
    return this.adminJobsService.getJobDetail(id);
  }
}
