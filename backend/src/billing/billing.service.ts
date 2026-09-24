import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PaddleService } from '../paddle/paddle.service';
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

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private paddleService: PaddleService,
    private configService: ConfigService,
    private notificationsService: NotificationsService,
    private mailService: MailService,
    private activitiesService: ActivitiesService,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  private get frontendUrl(): string {
    return (
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000'
    );
  }

  private nextMonth(): Date {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d;
  }

  /**
   * Ensure a user has a Paddle customer ID.
   * Checks DB first, then Paddle (active and archived), creating only if absent everywhere.
   */
  async getOrCreatePaddleCustomer(
    emailOrUser: string | UserDocument,
    name?: string,
  ): Promise<string> {
    const email = (
      typeof emailOrUser === 'string' ? emailOrUser : emailOrUser.email
    )
      .toLowerCase()
      .trim();
    const userName =
      typeof emailOrUser === 'string'
        ? name
        : emailOrUser.name || name || undefined;

    // 1. Check MongoDB first: if paddleCustomerId already exists, return it immediately
    const user =
      typeof emailOrUser !== 'string' && emailOrUser.paddleCustomerId
        ? emailOrUser
        : await this.userModel.findOne({ email });

    if (user?.paddleCustomerId) {
      return user.paddleCustomerId;
    }

    try {
      // 2. Query Paddle for existing customer by email (explicitly including 'active' and 'archived')
      const customerCollection = this.paddleService.paddle.customers.list({
        email: [email],
        status: ['active', 'archived'],
      });

      let existingCustomer: any = null;
      for await (const customer of customerCollection) {
        if (customer.email && customer.email.toLowerCase().trim() === email) {
          existingCustomer = customer;
          break;
        }
      }

      // 3. If found on Paddle (active or archived), save its ID and return it
      if (existingCustomer) {
        if (user) {
          user.paddleCustomerId = existingCustomer.id;
          await user.save();
        } else {
          await this.userModel.findOneAndUpdate(
            { email },
            { $set: { paddleCustomerId: existingCustomer.id } },
          );
        }
        this.logger.log(
          `Found existing Paddle customer ${existingCustomer.id} (status: ${existingCustomer.status}) for ${email}. Associated with user in DB.`,
        );
        return existingCustomer.id;
      }

      // 4. Only if no match exists on Paddle either, create a new customer
      const customData: Record<string, any> = {};
      if (user?._id) {
        customData.blyntaUserId = String(user._id);
      }

      const newCustomer = await this.paddleService.paddle.customers.create({
        email,
        name: userName,
        customData: Object.keys(customData).length > 0 ? customData : undefined,
      });

      if (user) {
        user.paddleCustomerId = newCustomer.id;
        await user.save();
      } else {
        await this.userModel.findOneAndUpdate(
          { email },
          { $set: { paddleCustomerId: newCustomer.id } },
        );
      }

      this.logger.log(
        `Created Paddle customer ${newCustomer.id} for user ${user?._id ?? ''} (${email})`,
      );
      return newCustomer.id;
    } catch (err: any) {
      // Fallback in case of conflict / race condition: re-query Paddle with active + archived status
      this.logger.warn(
        `Encountered issue when obtaining Paddle customer for ${email}: ${err?.message}. Checking if customer exists in Paddle...`,
      );

      try {
        const fallbackCollection = this.paddleService.paddle.customers.list({
          email: [email],
          status: ['active', 'archived'],
        });

        for await (const customer of fallbackCollection) {
          if (customer.email && customer.email.toLowerCase().trim() === email) {
            if (user) {
              user.paddleCustomerId = customer.id;
              await user.save();
            } else {
              await this.userModel.findOneAndUpdate(
                { email },
                { $set: { paddleCustomerId: customer.id } },
              );
            }
            this.logger.log(
              `Recovered existing Paddle customer ${customer.id} for ${email}`,
            );
            return customer.id;
          }
        }
      } catch (fallbackErr: any) {
        this.logger.error(
          `Recovery search failed for ${email}: ${fallbackErr?.message}`,
        );
      }

      this.logger.error(
        `Failed to create or retrieve Paddle customer for ${email}: ${err?.message}`,
      );
      throw new InternalServerErrorException(
        `Failed to obtain Paddle customer: ${err?.message ?? 'unknown error'}`,
      );
    }
  }

  /**
   * Creates a transaction / checkout for the requested plan and returns the checkout URL.
   */
  async createCheckoutSession(
    user: UserDocument,
    dto: CreateCheckoutSessionDto,
  ): Promise<{ checkoutUrl: string }> {
    if (user.plan === dto.plan) {
      throw new BadRequestException(`You are already on the ${dto.plan} plan.`);
    }

    const customerId = await this.getOrCreatePaddleCustomer(user);
    const priceId = this.paddleService.getPriceIdForPlan(dto.plan);

    try {
      const transaction = await this.paddleService.paddle.transactions.create({
        customerId,
        items: [
          {
            priceId,
            quantity: 1,
          },
        ],
        customData: {
          blyntaUserId: String(user._id),
          requestedPlan: dto.plan,
        },
      });

      let checkoutUrl = transaction.checkout?.url;

      if (!checkoutUrl) {
        throw new InternalServerErrorException(
          'Paddle transaction did not return a checkout URL.',
        );
      }

      // Normalization: Ensure localhost development URLs match the local HTTP scheme
      if (
        checkoutUrl.startsWith('https://localhost:3000') &&
        this.frontendUrl.startsWith('http://localhost:3000')
      ) {
        checkoutUrl = checkoutUrl.replace(
          'https://localhost:3000',
          'http://localhost:3000',
        );
      } else if (
        checkoutUrl.startsWith('https://127.0.0.1:3000') &&
        this.frontendUrl.startsWith('http://127.0.0.1:3000')
      ) {
        checkoutUrl = checkoutUrl.replace(
          'https://127.0.0.1:3000',
          'http://127.0.0.1:3000',
        );
      }

      this.logger.log(
        `Created Paddle transaction ${transaction.id} for user ${user._id} (checkoutUrl: ${checkoutUrl})`,
      );

      return { checkoutUrl };
    } catch (err: any) {
      this.logger.error(`Failed to create Paddle transaction: ${err?.message}`);
      throw new InternalServerErrorException(
        `Failed to create Paddle checkout session: ${
          err?.message ?? 'unknown error'
        }`,
      );
    }
  }

  /**
   * Resolves customer portal URL for user to manage their subscription.
   */
  async getCustomerPortalUrl(user: UserDocument): Promise<{ url: string }> {
    const customerId = await this.getOrCreatePaddleCustomer(user);

    try {
      const portalSession =
        await this.paddleService.paddle.customerPortalSessions.create(
          customerId,
          user.paddleSubscriptionId ? [user.paddleSubscriptionId] : [],
        );

      const portalUrl = portalSession.urls?.general?.overview;
      if (!portalUrl) {
        throw new InternalServerErrorException(
          'Paddle did not return a customer portal URL.',
        );
      }

      return { url: portalUrl };
    } catch (err: any) {
      this.logger.error(
        `Failed to create customer portal session: ${err?.message}`,
      );
      throw new InternalServerErrorException(
        `Failed to create customer portal session: ${
          err?.message ?? 'unknown error'
        }`,
      );
    }
  }

  /**
   * Applies paid subscription upgrades and assigns credits.
   */
  async applyPaddleSubscription(params: {
    paddleCustomerId?: string;
    paddleSubscriptionId?: string;
    plan: UserPlan;
    productId?: string;
    priceId?: string;
    status?: string;
    scheduledChangeAction?: string | null;
    scheduledChangeAt?: Date | null;
    userId?: string;
    userEmail?: string;
  }): Promise<void> {
    const {
      paddleCustomerId,
      paddleSubscriptionId,
      plan,
      productId,
      priceId,
      status = 'active',
      scheduledChangeAction = null,
      scheduledChangeAt = null,
      userId,
      userEmail,
    } = params;

    const conditions: any[] = [];
    if (userId && Types.ObjectId.isValid(userId)) {
      conditions.push({ _id: new Types.ObjectId(userId) });
    }
    if (paddleCustomerId) {
      conditions.push({ paddleCustomerId });
    }
    if (paddleSubscriptionId) {
      conditions.push({ paddleSubscriptionId });
    }
    if (userEmail) {
      conditions.push({ email: userEmail.toLowerCase().trim() });
    }

    if (conditions.length === 0) {
      this.logger.warn(
        '[applyPaddleSubscription] No identifiers provided to find Blynta user.',
      );
      return;
    }

    const query = conditions.length === 1 ? conditions[0] : { $or: conditions };
    const nextReset = this.nextMonth();

    const update: any = {
      $set: {
        plan,
        paddleSubscriptionStatus: status,
        creditsBalance: PLAN_CREDITS[plan],
        creditsResetAt: nextReset,
      },
    };

    if (paddleCustomerId) update.$set.paddleCustomerId = paddleCustomerId;
    if (paddleSubscriptionId) {
      update.$set.paddleSubscriptionId = paddleSubscriptionId;
    }
    if (productId) update.$set.paddleProductId = productId;
    if (priceId) update.$set.paddlePriceId = priceId;
    if (scheduledChangeAction !== undefined) {
      update.$set.paddleScheduledChangeAction = scheduledChangeAction;
    }
    if (scheduledChangeAt !== undefined) {
      update.$set.paddleScheduledChangeAt = scheduledChangeAt;
    }

    const user = await this.userModel.findOneAndUpdate(query, update, {
      new: true,
    });

    if (!user) {
      this.logger.warn(
        `[applyPaddleSubscription] User not found in MongoDB matching query: ${JSON.stringify(
          query,
        )}`,
      );
      return;
    }

    this.logger.log(
      `[applyPaddleSubscription] Successfully updated user ${user._id} (${user.email}) -> plan: ${plan}, status: ${status}, credits: ${PLAN_CREDITS[plan]}`,
    );

    try {
      const subId = paddleSubscriptionId || 'sub_init';
      await this.notificationsService.queueCreateIfNotExists({
        userId: user._id,
        type: NotificationType.SUCCESS,
        category: NotificationCategory.BILLING,
        title: `Upgraded to ${plan.toUpperCase()}`,
        message: `Your account has been upgraded to ${plan.toUpperCase()} with ${
          PLAN_CREDITS[plan]
        } credits.`,
        actionUrl: '/billing',
        actionLabel: 'View plan',
        dedupeKey: `billing:upgrade:${subId}:${Date.now()}`,
      });

      if (user.email) {
        await this.mailService.queueSubscriptionActivatedEmail(
          user.email,
          plan,
          PLAN_CREDITS[plan],
        );
      }

      await this.activitiesService.queueCreateIfNotExists({
        userId: user._id,
        type: ActivityType.BILLING_SUBSCRIPTION_CREATE,
        category: ActivityCategory.BILLING,
        title: `Subscribed to ${plan.toUpperCase()}`,
        description: `Upgraded to ${plan.toUpperCase()} plan with ${
          PLAN_CREDITS[plan]
        } monthly credits.`,
        activityUrl: '/billing',
        entityType: 'subscription',
        entityId: user._id,
        actorType: ActivityActorType.SYSTEM,
        isSystem: true,
        status: ActivityStatus.SUCCESS,
        severity: ActivitySeverity.SUCCESS,
        dedupeKey: `activity:billing:sub:${subId}`,
        metadata: {
          plan,
          creditsGranted: PLAN_CREDITS[plan],
          paddleSubscriptionId: subId,
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
        dedupeKey: `activity:billing:credits:${subId}`,
        metadata: {
          amount: PLAN_CREDITS[plan],
          plan,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Failed to dispatch billing notification/email/activity: ${err}`,
      );
    }
  }

  /**
   * Reverts subscription to Free tier.
   */
  async revertSubscriptionToFree(params: {
    paddleSubscriptionId?: string;
    paddleCustomerId?: string;
    status?: string;
  }): Promise<void> {
    const {
      paddleSubscriptionId,
      paddleCustomerId,
      status = 'canceled',
    } = params;
    const nextReset = this.nextMonth();

    const conditions: any[] = [];
    if (paddleSubscriptionId) conditions.push({ paddleSubscriptionId });
    if (paddleCustomerId) conditions.push({ paddleCustomerId });

    if (conditions.length === 0) {
      this.logger.warn(
        '[revertSubscriptionToFree] No identifiers provided to find subscription.',
      );
      return;
    }

    const query = conditions.length === 1 ? conditions[0] : { $or: conditions };

    const user = await this.userModel.findOneAndUpdate(
      query,
      {
        $set: {
          plan: UserPlan.FREE,
          paddleSubscriptionStatus: status,
          paddleScheduledChangeAction: null,
          paddleScheduledChangeAt: null,
          creditsBalance: PLAN_CREDITS[UserPlan.FREE],
          creditsResetAt: nextReset,
        },
      },
      { new: true },
    );

    if (user) {
      this.logger.log(
        `[revertSubscriptionToFree] Downgraded user ${user._id} (${user.email}) to Free tier (status: ${status})`,
      );

      const subId = paddleSubscriptionId || 'sub_revert';
      try {
        await this.notificationsService.queueCreateIfNotExists({
          userId: user._id,
          type: NotificationType.INFO,
          category: NotificationCategory.BILLING,
          title: 'Subscription ended',
          message: 'Your plan has reverted to Free tier.',
          actionUrl: '/billing',
          actionLabel: 'Manage plan',
          dedupeKey: `billing:revert:${subId}:${Date.now()}`,
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
          dedupeKey: `activity:billing:cancel:${subId}`,
        });
      } catch (err) {
        this.logger.warn(
          `Failed to dispatch billing cancel notification/activity: ${err}`,
        );
      }
    }
  }

  /**
   * Handles subscription lifecycle events.
   */
  async handleSubscriptionUpdated(subscription: any): Promise<void> {
    const subscriptionId = subscription?.id;
    const customerId = subscription?.customerId || subscription?.customer_id;
    const status = subscription?.status; // 'active', 'trialing', 'past_due', 'paused', 'canceled'
    const customData =
      subscription?.customData || subscription?.custom_data || {};
    let userId = customData?.blyntaUserId || customData?.blynta_user_id;

    const firstItem = subscription?.items?.[0];
    const priceId =
      firstItem?.price?.id ||
      firstItem?.price_id ||
      firstItem?.priceId ||
      (typeof firstItem?.price === 'string' ? firstItem.price : undefined);
    const productId =
      firstItem?.price?.productId ||
      firstItem?.price?.product_id ||
      firstItem?.product_id ||
      firstItem?.productId;

    const scheduledChange =
      subscription?.scheduledChange || subscription?.scheduled_change;
    const scheduledChangeAction = scheduledChange?.action ?? null;
    const scheduledChangeAt =
      scheduledChange?.effectiveAt || scheduledChange?.effective_at
        ? new Date(scheduledChange.effectiveAt || scheduledChange.effective_at)
        : null;

    let userEmail: string | undefined;

    // If userId not on subscription, check customer in Paddle
    if (!userId && customerId) {
      try {
        const customer =
          await this.paddleService.paddle.customers.get(customerId);
        if (customer?.customData?.blyntaUserId) {
          userId = customer.customData.blyntaUserId;
        }
        if (customer?.email) {
          userEmail = customer.email;
        }
      } catch (err) {
        this.logger.debug(
          `Could not fetch customer ${customerId} from Paddle SDK: ${err}`,
        );
      }
    }

    this.logger.log(
      `[Paddle Event] handleSubscriptionUpdated: subId=${subscriptionId} customerId=${customerId} userId=${userId} status=${status} priceId=${priceId} scheduledAction=${scheduledChangeAction}`,
    );

    if (status === 'canceled' || status === 'paused') {
      await this.revertSubscriptionToFree({
        paddleSubscriptionId: subscriptionId,
        paddleCustomerId: customerId,
        status,
      });
      return;
    }

    // Active, trialing, past_due maintain plan access
    let mappedPlan: UserPlan | null = null;
    if (priceId) {
      const planStr = this.paddleService.mapPriceIdToPlan(priceId);
      if (planStr && planStr !== 'free') {
        mappedPlan = planStr as UserPlan;
      }
    }

    if (!mappedPlan && customData?.requestedPlan) {
      mappedPlan =
        customData.requestedPlan === 'pro'
          ? UserPlan.PRO
          : customData.requestedPlan === 'business'
            ? UserPlan.BUSINESS
            : null;
    }

    if (mappedPlan) {
      await this.applyPaddleSubscription({
        userId,
        userEmail,
        paddleCustomerId: customerId,
        paddleSubscriptionId: subscriptionId,
        plan: mappedPlan,
        productId,
        priceId,
        status,
        scheduledChangeAction,
        scheduledChangeAt,
      });
    } else {
      this.logger.warn(
        `[Paddle Event] Could not resolve plan for priceId=${priceId}. Updating status only.`,
      );
      await this.userModel.findOneAndUpdate(
        {
          $or: [
            ...(userId && Types.ObjectId.isValid(userId)
              ? [{ _id: new Types.ObjectId(userId) }]
              : []),
            ...(subscriptionId
              ? [{ paddleSubscriptionId: subscriptionId }]
              : []),
            ...(customerId ? [{ paddleCustomerId: customerId }] : []),
          ],
        },
        {
          $set: {
            paddleSubscriptionStatus: status,
            paddleScheduledChangeAction: scheduledChangeAction,
            paddleScheduledChangeAt: scheduledChangeAt,
          },
        },
      );
    }
  }

  /**
   * Handles customer events (customer.created, customer.updated).
   * Upserts paddleCustomerId onto the matching user by userId or email.
   */
  async handleCustomerUpserted(customer: any): Promise<void> {
    const customerId = customer?.id;
    const email = customer?.email;
    const customData = customer?.customData || customer?.custom_data || {};
    const userId = customData?.blyntaUserId || customData?.blynta_user_id;

    this.logger.log(
      `[Paddle Event] handleCustomerUpserted: customerId=${customerId} email=${email} userId=${userId}`,
    );

    if (!customerId) return;

    if (userId && Types.ObjectId.isValid(userId)) {
      const updated = await this.userModel.findByIdAndUpdate(userId, {
        $set: { paddleCustomerId: customerId },
      });
      if (updated) {
        this.logger.log(
          `[Paddle Event] handleCustomerUpserted: Updated user ${userId} with paddleCustomerId ${customerId}`,
        );
        return;
      }
    }

    if (email) {
      const normalizedEmail = email.toLowerCase().trim();
      const updated = await this.userModel.findOneAndUpdate(
        { email: normalizedEmail },
        { $set: { paddleCustomerId: customerId } },
      );
      if (updated) {
        this.logger.log(
          `[Paddle Event] handleCustomerUpserted: Updated user ${updated._id} (${normalizedEmail}) with paddleCustomerId ${customerId}`,
        );
      } else {
        this.logger.warn(
          `[Paddle Event] handleCustomerUpserted: No matching user found for email ${normalizedEmail}`,
        );
      }
    }
  }

  /**
   * Handles transaction.completed event.
   */
  async handleTransactionCompleted(transaction: any): Promise<void> {
    const transactionId = transaction?.id;
    const subscriptionId =
      transaction?.subscriptionId || transaction?.subscription_id;
    const customerId = transaction?.customerId || transaction?.customer_id;
    const customData =
      transaction?.customData || transaction?.custom_data || {};
    let userId = customData?.blyntaUserId || customData?.blynta_user_id;

    const firstItem = transaction?.items?.[0];
    const priceId =
      firstItem?.price?.id ||
      firstItem?.price_id ||
      firstItem?.priceId ||
      (typeof firstItem?.price === 'string' ? firstItem.price : undefined);
    const productId =
      firstItem?.price?.productId ||
      firstItem?.price?.product_id ||
      firstItem?.product_id ||
      firstItem?.productId;

    let userEmail: string | undefined;

    if (!userId && customerId) {
      try {
        const customer =
          await this.paddleService.paddle.customers.get(customerId);
        if (customer?.customData?.blyntaUserId) {
          userId = customer.customData.blyntaUserId;
        }
        if (customer?.email) {
          userEmail = customer.email;
        }
      } catch (err) {
        this.logger.debug(
          `Could not fetch customer ${customerId} from Paddle SDK: ${err}`,
        );
      }
    }

    let targetPlan: UserPlan | null = null;
    if (priceId) {
      const mapped = this.paddleService.mapPriceIdToPlan(priceId);
      if (mapped && mapped !== 'free') targetPlan = mapped as UserPlan;
    }

    if (!targetPlan && customData?.requestedPlan) {
      targetPlan =
        customData.requestedPlan === 'pro'
          ? UserPlan.PRO
          : customData.requestedPlan === 'business'
            ? UserPlan.BUSINESS
            : null;
    }

    this.logger.log(
      `[Paddle Event] handleTransactionCompleted: txId=${transactionId} subId=${subscriptionId} customerId=${customerId} userId=${userId} plan=${targetPlan}`,
    );

    if (targetPlan && (subscriptionId || customerId || userId || userEmail)) {
      await this.applyPaddleSubscription({
        userId,
        userEmail,
        paddleCustomerId: customerId,
        paddleSubscriptionId: subscriptionId,
        plan: targetPlan,
        productId,
        priceId,
        status: 'active',
      });
    }
  }
}
