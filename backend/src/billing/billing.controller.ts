import {
  Body,
  Controller,
  Post,
  Get,
  Request,
  UseGuards,
  NotFoundException,
  Headers,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request as ExpressRequest } from 'express';
import type { Response } from 'express';
import type { RawBodyRequest } from '@nestjs/common';
import { ZodValidationPipe } from 'nestjs-zod';
import { BillingService } from './billing.service';
import { PaddleService } from '../paddle/paddle.service';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';
import { UsersService } from '../users/users.service';

@Controller('billing')
export class BillingController {
  private readonly logger = new Logger(BillingController.name);

  constructor(
    private billingService: BillingService,
    private usersService: UsersService,
    private paddleService: PaddleService,
  ) {}

  /* -------------------------------------------------------------------------- */
  /*                      Checkout session — authenticated                      */
  /* -------------------------------------------------------------------------- */

  @Post('checkout-session')
  @UseGuards(AuthGuard('jwt'))
  async createCheckoutSession(
    @Request() req,
    @Body(new ZodValidationPipe(CreateCheckoutSessionDto))
    dto: CreateCheckoutSessionDto,
  ) {
    const user = await this.usersService.findById(req.user.userId);
    if (!user) throw new NotFoundException('User not found');

    return this.billingService.createCheckoutSession(user, dto);
  }

  /* -------------------------------------------------------------------------- */
  /*                      Customer portal — authenticated                       */
  /* -------------------------------------------------------------------------- */

  @Get('customer-portal')
  @UseGuards(AuthGuard('jwt'))
  async getCustomerPortal(@Request() req) {
    const user = await this.usersService.findById(req.user.userId);
    if (!user) throw new NotFoundException('User not found');

    return this.billingService.getCustomerPortalUrl(user);
  }

  /* -------------------------------------------------------------------------- */
  /*                Paddle webhook — NO JWT auth, signature only                */
  /* -------------------------------------------------------------------------- */

  /**
   * IMPORTANT: Paddle's signature check REQUIRES the UNTOUCHED raw request
   * body. We extract it from req.body (express.raw Buffer) or req.rawBody.
   */
  @Post('paddle/webhook')
  @HttpCode(HttpStatus.OK)
  async paddleWebhook(
    @Req() req: RawBodyRequest<ExpressRequest>,
    @Headers('paddle-signature') signature: string | undefined,
    @Res() res: Response,
  ) {
    const sig =
      signature ||
      (req.headers['paddle-signature'] as string) ||
      (req.headers['Paddle-Signature'] as string);

    let rawBody = '';
    if (Buffer.isBuffer(req.body)) {
      rawBody = req.body.toString('utf8');
    } else if (req.rawBody) {
      rawBody = Buffer.isBuffer(req.rawBody)
        ? req.rawBody.toString('utf8')
        : String(req.rawBody);
    } else if (typeof req.body === 'string') {
      rawBody = req.body;
    } else if (req.body && typeof req.body === 'object') {
      rawBody = JSON.stringify(req.body);
    }

    if (!rawBody || !sig) {
      this.logger.warn(
        `[Paddle Webhook] Rejected request: missing signature (${Boolean(
          sig,
        )}) or rawBody (len: ${rawBody?.length ?? 0})`,
      );
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({ error: 'Missing Paddle signature or raw body.' });
    }

    let event: any;
    try {
      const secret = this.paddleService.getWebhookSecret();
      event = await this.paddleService.paddle.webhooks.unmarshal(
        rawBody,
        secret,
        sig,
      );
    } catch (err: any) {
      this.logger.error(
        `[Paddle Webhook] Signature verification failed: ${err?.message}`,
      );
      return res.status(HttpStatus.BAD_REQUEST).json({
        error: `Webhook signature verification failed: ${err?.message}`,
      });
    }

    try {
      const eventType = event?.eventType || event?.event_type;
      const eventId = event?.eventId || event?.event_id || event?.id;
      const data = event?.data;

      this.logger.log(
        `[Paddle Webhook] Successfully verified & received event: ${eventType} (ID: ${eventId})`,
      );

      switch (eventType) {
        case 'subscription.created':
        case 'subscription.updated':
        case 'subscription.activated':
        case 'subscription.paused':
        case 'subscription.resumed':
          await this.billingService.handleSubscriptionUpdated(data);
          break;

        case 'subscription.canceled':
          if (data?.id) {
            await this.billingService.revertSubscriptionToFree({
              paddleSubscriptionId: data.id,
              paddleCustomerId: data.customerId || data.customer_id,
              status: 'canceled',
            });
          }
          break;

        case 'customer.created':
        case 'customer.updated':
          await this.billingService.handleCustomerUpserted(data);
          break;

        case 'transaction.completed':
        case 'transaction.paid':
          await this.billingService.handleTransactionCompleted(data);
          break;

        default:
          this.logger.debug(
            `[Paddle Webhook] Unhandled event type: ${eventType}`,
          );
          break;
      }
    } catch (err: any) {
      this.logger.error(
        `[Paddle Webhook] Error processing event: ${err?.message}`,
        err?.stack,
      );
    }

    return res.status(HttpStatus.OK).json({ received: true });
  }
}
