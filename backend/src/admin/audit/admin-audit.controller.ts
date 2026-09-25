import {
  Controller,
  Get,
  Query,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { AdminGuard } from '../guards/admin.guard';
import { AdminAuditService } from './admin-audit.service';
import { ListAuditAdminDto } from '../dto/list-audit-admin.dto';

@Controller('admin/audit')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminAuditController {
  constructor(private readonly adminAuditService: AdminAuditService) {}

  @Get()
  async listAdminAuditLogs(
    @Query(new ValidationPipe({ transform: true, whitelist: true }))
    query: ListAuditAdminDto,
  ) {
    return this.adminAuditService.listAdminAuditLogs(query);
  }
}
