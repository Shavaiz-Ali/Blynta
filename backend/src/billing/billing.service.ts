import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { StripeService } from '../stripe/stripe.service';
import {
  User,
  UserDocument,
  UserPlan,
  PLAN_CREDITS,
} from '../users/schemas/user.schema';
import type { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';
import Stripe from 'stripe';

@Injectable()
export class BillingService {
  constructor(
    private stripeService: StripeService,
    private configService: ConfigService,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  private get frontendUrl(): string {
    return this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
  }

  private nextMonth(): Date {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d;
  }

  /**
   * Ensure a user has a Stripe customer ID, creating one on Stripe and saving
   * it back to the user document if missing. Returns the customer ID.
   */
  async getOrCreateStripeCustomer(user: UserDocument): Promise<string> {
    if (user.stripeCustomerId) return user.stripeCustomerId;

    let customer: Stripe.Customer;
    try {
      customer = await this.stripeService.stripe.customers.create({
        email: user.email,
        name: user.name || undefined,
        metadata: {
          blyntaUserId: String(user._id),
        },
      });
    } catch (err: any) {
      throw new InternalServerErrorException(
        `Failed to create Stripe customer: ${err?.message ?? 'unknown error'}`,
      );
    }

    user.stripeCustomerId = customer.id;
    await user.save();
    return customer.id;
  }

  async createCheckoutSession(
    user: UserDocument,
    dto: CreateCheckoutSessionDto,
  ): Promise<{ checkoutUrl: string }> {
    if (user.plan === dto.plan) {
      throw new BadRequestException(`You are already on the ${dto.plan} plan.`);
    }

    const customerId = await this.getOrCreateStripeCustomer(user);
    const priceId = this.stripeService.getPriceIdForPlan(dto.plan);

    const frontendUrl = this.frontendUrl.replace(/\/$/, '');
    const successUrl = `${frontendUrl}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${frontendUrl}/billing?canceled=true`;

    let session: Stripe.Checkout.Session;
    try {
      session = await this.stripeService.stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        subscription_data:
          user.stripeSubscriptionId
            ? undefined
            : { metadata: { blyntaUserId: String(user._id) } },
        metadata: {
          blyntaUserId: String(user._id),
          requestedPlan: dto.plan,
        },
        allow_promotion_codes: true,
      });
    } catch (err: any) {
      throw new InternalServerErrorException(
        `Failed to create Stripe checkout session: ${err?.message ?? 'unknown error'}`,
      );
    }

    if (!session.url) {
      throw new InternalServerErrorException(
        'Stripe did not return a checkout URL.',
      );
    }

    return { checkoutUrl: session.url };
  }

  /**
   * Called from the webhook when a checkout session has been paid for and the
   * subscription is active. Updates the user's plan, subscription ID, and
   * grants a full bucket of credits for the new tier immediately.
   */
  async applyPaidSubscription(params: {
    stripeCustomerId: string;
    stripeSubscriptionId: string;
    plan: UserPlan;
  }): Promise<void> {
    const { stripeCustomerId, stripeSubscriptionId, plan } = params;
    const nextReset = this.nextMonth();

    await this.userModel.updateOne(
      { stripeCustomerId },
      {
        $set: {
          plan,
          stripeSubscriptionId,
          creditsBalance: PLAN_CREDITS[plan],
          creditsResetAt: nextReset,
        },
      },
    );
  }

  /**
   * Called from the webhook when a subscription is cancelled (or non-renewed).
   * We immediately downgrade back to FREE and clamp credits to FREE tier.
   *
   * Trade-off: simpler and fully auditable — user keeps free-tier credits only
   * going forward. Alternative: preserve paid credits until creditsResetAt and
   * downgrade at cycle end (requires storing "pending plan" state, more moving
   * parts). We'll start simple; refine later if churn UX matters.
   */
  async revertSubscriptionToFree(params: {
    stripeSubscriptionId: string;
  }): Promise<void> {
    const { stripeSubscriptionId } = params;
    const nextReset = this.nextMonth();

    await this.userModel.updateOne(
      { stripeSubscriptionId },
      {
        $set: {
          plan: UserPlan.FREE,
          stripeSubscriptionId: undefined,
          creditsBalance: PLAN_CREDITS[UserPlan.FREE],
          creditsResetAt: nextReset,
        },
      },
    );
  }
}
