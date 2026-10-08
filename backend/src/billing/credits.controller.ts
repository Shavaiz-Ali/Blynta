import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { z } from 'zod';
import { CreditsService } from './credits.service';
import { BillingRateLimitGuard } from './billing-rate-limit.guard';
import { parse } from '../studio/studio.contract';

@Controller('billing/credits')
@UseGuards(AuthGuard('jwt'), BillingRateLimitGuard)
export class CreditsController {
  constructor(private credits: CreditsService) {}
  @Get() balance(@Request() req: { user: { userId: string } }) {
    return this.credits.balance(req.user.userId);
  }
  @Post('estimate') estimate(
    @Request() req: { user: { userId: string } },
    @Body() body: unknown,
  ) {
    const b = parse(
      z
        .object({
          sourceSeconds: z.number().positive().max(14400),
          maxOutputSeconds: z.number().positive().max(3600),
        })
        .strict(),
      body,
    );
    return this.credits.estimate(
      req.user.userId,
      b.sourceSeconds,
      b.maxOutputSeconds,
    );
  }
  @Get('history') history(
    @Request() req: { user: { userId: string } },
    @Query() query: unknown,
  ) {
    const q = parse(
      z.object({
        page: z.coerce.number().int().min(1).max(100000).default(1),
        limit: z.coerce.number().int().min(1).max(50).default(20),
        product: z.enum(['ai-clips', 'studio', 'account']).optional(),
        type: z
          .enum([
            'opening',
            'grant',
            'reserve',
            'charge',
            'release',
            'refund',
            'adjustment',
          ])
          .optional(),
      }),
      query,
    );
    return this.credits.history(
      req.user.userId,
      q.page,
      q.limit,
      q.product,
      q.type,
    );
  }
  @Get('transactions/:id') async detail(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
  ) {
    if (!/^[a-f0-9]{24}$/i.test(id))
      throw new NotFoundException('Transaction not found');
    const e = await this.credits.entries
      .findOne({ _id: id, userId: req.user.userId })
      .select('-metadata -key -__v')
      .lean();
    if (!e) throw new NotFoundException('Transaction not found');
    return e;
  }
}
