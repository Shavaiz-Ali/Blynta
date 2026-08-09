import {
  Body,
  Controller,
  Post,
  Get,
  Request,
  UseGuards,
  NotFoundException,
  BadRequestException,
  Headers,
  Req,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request as ExpressRequest } from 'express';
import type { Response } from 'express';
import type { RawBodyRequest } from '@nestjs/common';
import { ZodValidationPipe } from 'nestjs-zod';
import { BillingService } from './billing.service';
import { StripeService } from '../stripe/stripe.service';
import {
  CreateCheckoutSessionDto,
} from './dto/create-checkout-session.dto';
import { UsersService } from '../users/users.service';
import { UserPlan } from '../users/schemas/user.schema';
import Stripe from 'stripe';

@Controller('billing')
export class BillingController {
  constructor(
    private billingService: BillingService,
    private usersService: UsersService,
    private stripeService: StripeService,
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
  /*                Stripe webhook — NO JWT auth, signature only                */
  /* -------------------------------------------------------------------------- */

  /**
   * IMPORTANT: Stripe's signature check REQUIRES the UNTOUCHED raw request
   * body. We cannot run the global JSON parser + Zod pipe over this endpoint
   * — the bytes must be exactly what Stripe sent, otherwise the HMAC will
   * fail to verify.
   *
   * We mount express.raw({ type: 'application/json' }) for this route in
   * main.ts BEFORE the global JSON body parser runs, and here we read from
   * `(req as RawBodyRequest<ExpressRequest>).rawBody`.
   */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async stripeWebhook(
    @Req() req: RawBodyRequest<ExpressRequest>,
    @Headers('stripe-signature') signature: string | undefined,
    @Res() res: Response,
  ) {
    const rawBody = req.rawBody;

    if (!rawBody || !signature) {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({ error: 'Missing Stripe signature or raw body.' });
    }

    let event: Stripe.Event;
    try {
      event = this.stripeService.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.stripeService.getWebhookSecret(),
      );
    } catch (err: any) {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({ error: `Webhook signature verification failed: ${err?.message}` });
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          const customerId = session.customer as string;
          const subscriptionId = session.subscription as string;

          // For checkout.session.completed in subscription mode, the price
          // lives on the session's line_items OR the linked subscription. The
          // most reliable source is expanding the subscription and reading
          // the item's price. But we also support a fast path via metadata
          // requestedPlan set on session.
          let targetPlan: UserPlan | null =
            session.metadata?.requestedPlan === 'pro'
              ? UserPlan.PRO
              : session.metadata?.requestedPlan === 'business'
                ? UserPlan.BUSINESS
                : null;

          if (!targetPlan && subscriptionId) {
            try {
              const sub = await this.stripeService.stripe.subscriptions.retrieve(
                subscriptionId,
                { expand: ['items.data.price'] },
              );
              const priceId = sub.items.data?.[0]?.price?.id;
              if (priceId) {
                const mapped = this.stripeService.mapPriceIdToPlan(priceId);
                if (mapped && mapped !== 'free') targetPlan = mapped as UserPlan;
              }
            } catch {
              /* swallow — fall through to error below */
            }
          }

          if (!targetPlan) {
            return res
              .status(HttpStatus.BAD_REQUEST)
              .json({ error: 'Could not resolve plan from checkout session.' });
          }

          if (customerId && subscriptionId) {
            await this.billingService.applyPaidSubscription({
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscriptionId,
              plan: targetPlan,
            });
          }
          break;
        }

        case 'customer.subscription.deleted': {
          const sub = event.data.object as Stripe.Subscription;
          const subscriptionId = sub.id;
          if (subscriptionId) {
            await this.billingService.revertSubscriptionToFree({
              stripeSubscriptionId: subscriptionId,
            });
          }
          break;
        }

        // We don't need to handle anything else, but we must ACK with 200 so
        // Stripe stops retrying.
        default:
          break;
      }
    } catch (err: any) {
      // Log the error but return 200 for unhandled event types; we don't
      // want Stripe to keep retrying a failing webhook. In production, send
      // this to an error tracker (Sentry etc).
      // eslint-disable-next-line no-console
      console.error('[billing/webhook] unhandled error:', err?.message ?? err);
    }

    return res.json({ received: true });
  }
}
