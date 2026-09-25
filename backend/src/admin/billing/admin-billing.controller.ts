import {
  Body,
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
import { AdminBillingService } from './admin-billing.service';
import { ListCustomersAdminDto } from '../dto/list-customers-admin.dto';
import { AdjustCreditsDto } from '../dto/adjust-credits.dto';
import { CancelSubscriptionAdminDto } from '../dto/update-subscription-admin.dto';

@Controller('admin/billing')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminBillingController {
  constructor(private readonly adminBillingService: AdminBillingService) {}

  @Get('customers')
  async listCustomers(
    @Query(new ValidationPipe({ transform: true, whitelist: true }))
    query: ListCustomersAdminDto,
  ) {
    return this.adminBillingService.listCustomers(query);
  }

  @Get('customers/:userId')
  async getCustomerBillingPicture(@Param('userId') userId: string) {
    return this.adminBillingService.getCustomerBillingPicture(userId);
  }

  @Post('customers/:userId/adjust-credits')
  async adjustCredits(
    @Param('userId') userId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    )
    dto: AdjustCreditsDto,
    @CurrentAdmin() admin: AuthenticatedUser,
  ) {
    return this.adminBillingService.adjustCredits(userId, dto, admin.userId);
  }

  @Post('customers/:userId/cancel-subscription')
  async cancelSubscription(
    @Param('userId') userId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    )
    dto: CancelSubscriptionAdminDto,
    @CurrentAdmin() admin: AuthenticatedUser,
  ) {
    return this.adminBillingService.cancelSubscription(
      userId,
      dto,
      admin.userId,
    );
  }
}
