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
import { CreditsService } from '../../billing/credits.service';
import { z } from 'zod';
import { parse } from '../../studio/studio.contract';

@Controller('admin/billing')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminBillingController {
  constructor(
    private readonly adminBillingService: AdminBillingService,
    private credits: CreditsService,
  ) {}

  @Get('customers/:userId/credits') async creditsPicture(
    @Param('userId') userId: string,
    @Query() query: unknown,
  ) {
    const q = parse(
      z.object({
        page: z.coerce.number().int().min(1).max(100000).default(1),
        limit: z.coerce.number().int().min(1).max(50).default(20),
      }),
      query,
    );
    const [audit, history, reservations] = await Promise.all([
      this.credits.audit(userId),
      this.credits.history(userId, q.page, q.limit),
      this.credits.operations
        .find({ userId, status: 'reserved' })
        .limit(50)
        .lean(),
    ]);
    const ids = [
      ...new Set(
        history.rows
          .map((e) => e.operationId)
          .concat(reservations.map((o) => o.operationId)),
      ),
    ];
    const usage = await this.credits.usage
      .find({ operationId: { $in: ids } })
      .sort({ recordedAt: -1 })
      .limit(100)
      .lean();
    return { ...audit, history, reservations, usage };
  }

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
  @Post('customers/:userId/refunds') async refund(
    @Param('userId') userId: string,
    @Body() body: unknown,
    @CurrentAdmin() admin: AuthenticatedUser,
  ) {
    const b = parse(
      z
        .object({
          chargeId: z.string().regex(/^[a-f0-9]{24}$/i),
          amount: z.number().int().positive(),
          operationId: z.string().uuid(),
          reason: z.string().trim().min(1).max(1000),
        })
        .strict(),
      body,
    );
    return this.credits.refund(
      userId,
      b.chargeId,
      b.amount,
      `refund:${admin.userId}:${b.operationId}`,
      b.reason,
      admin.userId,
    );
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
