import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  Logger,
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
import {
  NotificationCategory,
  NotificationType,
} from '../notifications/schemas/notification.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { MailService } from '../mail/mail.service';
import { ActivitiesService } from '../activities/activities.service';
import {
  ActivityActorType,
  ActivityCategory,
  ActivitySeverity,
  ActivityStatus,
  ActivityType,
} from '../activities/schemas/activity.schema';
import type { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';
import Stripe from 'stripe';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private stripeService: StripeService,
    private configService: ConfigService,
    private notificationsService: NotificationsService,
    private mailService: MailService,
    private activitiesService: ActivitiesService,
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

    const user = await this.userModel.findOneAndUpdate(
      { stripeCustomerId },
      {
        $set: {
          plan,
          stripeSubscriptionId,
          creditsBalance: PLAN_CREDITS[plan],
          creditsResetAt: nextReset,
        },
      },
      { new: true },
    );

    if (user) {
      try {
        await this.notificationsService.queueCreateIfNotExists({
          userId: user._id,
          type: NotificationType.SUCCESS,
          category: NotificationCategory.BILLING,
          title: `Upgraded to ${plan.toUpperCase()}`,
          message: `Your account has been upgraded to ${plan.toUpperCase()} with ${PLAN_CREDITS[plan]} credits.`,
          actionUrl: '/billing',
          actionLabel: 'View plan',
          dedupeKey: `billing:upgrade:${stripeSubscriptionId}:${Date.now()}`,
        });

        if (user.email) {
          await this.mailService.queueSubscriptionActivatedEmail(
            user.email,
            plan,
            PLAN_CREDITS[plan],
          );
        }

        // Activities for billing upgrade and credits granted
        await this.activitiesService.queueCreateIfNotExists({
          userId: user._id,
          type: ActivityType.BILLING_SUBSCRIPTION_CREATE,
          category: ActivityCategory.BILLING,
          title: `Subscribed to ${plan.toUpperCase()}`,
          description: `Upgraded to ${plan.toUpperCase()} plan with ${PLAN_CREDITS[plan]} monthly credits.`,
          activityUrl: '/billing',
          entityType: 'subscription',
          entityId: user._id,
          actorType: ActivityActorType.SYSTEM,
          isSystem: true,
          status: ActivityStatus.SUCCESS,
          severity: ActivitySeverity.SUCCESS,
          dedupeKey: `activity:billing:sub:${stripeSubscriptionId}`,
          metadata: {
            plan,
            creditsGranted: PLAN_CREDITS[plan],
            stripeSubscriptionId,
          },
        });

        await this.activitiesService.queueCreateIfNotExists({
          userId: user._id,
          type: ActivityType.CREDIT_PURCHASE,
          category: ActivityCategory.CREDIT,
          title: 'Credits added',
          description: `${PLAN_CREDITS[plan]} credits added with ${plan.toUpperCase()} plan.`,
          activityUrl: '/billing',
          entityType: 'subscription',
          entityId: user._id,
          actorType: ActivityActorType.SYSTEM,
          isSystem: true,
          status: ActivityStatus.SUCCESS,
          severity: ActivitySeverity.SUCCESS,
          dedupeKey: `activity:billing:credits:${stripeSubscriptionId}`,
          metadata: {
            amount: PLAN_CREDITS[plan],
            plan,
          },
        });
      } catch (err) {
        this.logger.warn(`Failed to dispatch billing notification/email/activity: ${err}`);
      }
    }
  }

  /**
   * Called from the webhook when a subscription is cancelled (or non-renewed).
   * We immediately downgrade back to FREE and clamp credits to FREE tier.
   */
  async revertSubscriptionToFree(params: {
    stripeSubscriptionId: string;
  }): Promise<void> {
    const { stripeSubscriptionId } = params;
    const nextReset = this.nextMonth();

    const user = await this.userModel.findOneAndUpdate(
      { stripeSubscriptionId },
      {
        $set: {
          plan: UserPlan.FREE,
          stripeSubscriptionId: undefined,
          creditsBalance: PLAN_CREDITS[UserPlan.FREE],
          creditsResetAt: nextReset,
        },
      },
      { new: true },
    );

    if (user) {
      try {
        await this.notificationsService.queueCreateIfNotExists({
          userId: user._id,
          type: NotificationType.INFO,
          category: NotificationCategory.BILLING,
          title: 'Subscription ended',
          message: 'Your plan has reverted to Free tier.',
          actionUrl: '/billing',
          actionLabel: 'Manage plan',
          dedupeKey: `billing:revert:${stripeSubscriptionId}:${Date.now()}`,
        });

        await this.activitiesService.queueCreateIfNotExists({
          userId: user._id,
          type: ActivityType.BILLING_SUBSCRIPTION_CANCEL,
          category: ActivityCategory.BILLING,
          title: 'Subscription ended',
          description: 'Your plan reverted to the Free tier.',
          activityUrl: '/billing',
          entityType: 'subscription',
          entityId: user._id,
          actorType: ActivityActorType.SYSTEM,
          isSystem: true,
          status: ActivityStatus.SUCCESS,
          severity: ActivitySeverity.INFO,
          dedupeKey: `activity:billing:cancel:${stripeSubscriptionId}`,
        });
      } catch (err) {
        this.logger.warn(`Failed to dispatch billing cancel notification/activity: ${err}`);
      }
    }
  }
}
