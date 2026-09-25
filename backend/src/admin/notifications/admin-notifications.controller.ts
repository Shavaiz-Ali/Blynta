import {
  Body,
  Controller,
  Post,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { AdminGuard } from '../guards/admin.guard';
import { CurrentAdmin } from '../decorators/current-admin.decorator';
import type { AuthenticatedUser } from '../../auth/jwt.strategy';
import { AdminNotificationsService } from './admin-notifications.service';
import { BroadcastNotificationDto } from '../dto/broadcast-notification.dto';

@Controller('admin/notifications')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminNotificationsController {
  constructor(
    private readonly adminNotificationsService: AdminNotificationsService,
  ) {}

  @Post('broadcast')
  async broadcast(
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    )
    dto: BroadcastNotificationDto,
    @CurrentAdmin() admin: AuthenticatedUser,
  ) {
    return this.adminNotificationsService.broadcast(dto, admin.userId);
  }
}
