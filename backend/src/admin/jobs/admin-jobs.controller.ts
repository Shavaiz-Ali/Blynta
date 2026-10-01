import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { AdminGuard } from '../guards/admin.guard';
import { CurrentAdmin } from '../decorators/current-admin.decorator';
import type { AuthenticatedUser } from '../../auth/jwt.strategy';
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

  @Get('queues')
  async getQueueStats() {
    return this.adminJobsService.getQueueStats();
  }

  @Get(':id')
  async getJobDetail(@Param('id') id: string) {
    return this.adminJobsService.getJobDetail(id);
  }

  @Post(':id/retry')
  async retryJob(
    @Param('id') id: string,
    @CurrentAdmin() admin: AuthenticatedUser,
  ) {
    return this.adminJobsService.retryJob(id, admin.userId);
  }
}
