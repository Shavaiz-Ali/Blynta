import { CreditsService } from './credits.service';
import { randomUUID } from 'node:crypto';
import { creditPacks, planCredits } from './credit-config';
import { Optional } from '@nestjs/common';
import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PaddleService } from '../paddle/paddle.service';
import { User, UserDocument, UserPlan } from '../users/schemas/user.schema';
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
import {
  ProcessedPaddleEvent,
  ProcessedPaddleEventDocument,
} from './schemas/processed-paddle-event.schema';
import { Customer, CustomerDocument } from './schemas/customer.schema';
import {
  SubscriptionEvent,
  SubscriptionEventDocument,
} from './schemas/subscription-event.schema';

interface CreditPayment {
  id?: string;
  customerId?: string;
  customer_id?: string;
  subscriptionId?: string | null;
  subscription_id?: string | null;
  customData?: { purchaseKind?: string; blyntaUserId?: string };
  custom_data?: { purchaseKind?: string; blyntaUserId?: string };
  items?: {
    quantity?: number;
    priceId?: string;
    price_id?: string;
    price?: { id?: string; billingCycle?: unknown; billing_cycle?: unknown };
  }[];
}
interface CreditAdjustment {
  id?: string;
  status?: string;
  action?: string;
  type?: string | null;
  transactionId?: string;
  transaction_id?: string;
  originalAdjustmentId?: string | null;
  original_adjustment_id?: string | null;
  totals?: { total?: string | null } | null;
}

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
    @InjectModel(Customer.name) private customerModel: Model<CustomerDocument>,
    @InjectModel(SubscriptionEvent.name)
    private subscriptionEventModel: Model<SubscriptionEventDocument>,
    @InjectModel(ProcessedPaddleEvent.name)
    private processedEventModel: Model<ProcessedPaddleEventDocument>,
    @Optional() private credits?: CreditsService,
  ) {}

  /* =========================================================================
     Idempotency helpers
     ========================================================================= */

  /**
   * Returns true if this Paddle event ID has already been handled.
   */
  async isEventProcessed(eventId: string): Promise<boolean> {
    const existing = await this.processedEventModel
      .findOne({ eventId })
      .lean()
      .exec();
    return !!existing;
  }

  /**
   * Marks a Paddle event ID as handled so future retries are skipped.
   */
  async markEventProcessed(eventId: string, eventType: string): Promise<void> {
    try {
      await this.processedEventModel.create({
        eventId,
        eventType,
        processedAt: new Date(),
      });
    } catch (err: any) {
      // E11000 = duplicate key — already marked, safe to ignore
      if (err?.code !== 11000) throw err;
    }
  }

  /* =========================================================================
     Internal helpers
     ========================================================================= */

  private get frontendUrl(): string {
    return (
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000'
    );
  }

  /**
   * Fallback reset date: one calendar month from now.
   * Used only when Paddle doesn't supply current_billing_period.ends_at.
   */
  private nextMonth(): Date {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d;
  }

  /* =========================================================================
     Customer lookup helpers — work from the Customer collection
     ========================================================================= */

  /** Find Customer by any Paddle identifier. */
  private async findCustomerByPaddleIds(opts: {
    paddleCustomerId?: string;
    paddleSubscriptionId?: string;
  }): Promise<CustomerDocument | null> {
    const conditions: any[] = [];
    if (opts.paddleCustomerId)
      conditions.push({ paddleCustomerId: opts.paddleCustomerId });
    if (opts.paddleSubscriptionId)
      conditions.push({ paddleSubscriptionId: opts.paddleSubscriptionId });
    if (conditions.length === 0) return null;
    return this.customerModel
      .findOne(conditions.length === 1 ? conditions[0] : { $or: conditions })
      .exec();
  }

  /** Find User by any combination of identifiers. */
  private async resolveUser(opts: {
    userId?: string;
    userEmail?: string;
    paddleCustomerId?: string;
    paddleSubscriptionId?: string;
  }): Promise<UserDocument | null> {
    // 1. Try direct identifiers on User first (fast path)
    const userConditions: any[] = [];
    if (opts.userId && Types.ObjectId.isValid(opts.userId))
      userConditions.push({ _id: new Types.ObjectId(opts.userId) });
    if (opts.userEmail)
      userConditions.push({ email: opts.userEmail.toLowerCase().trim() });

    if (userConditions.length > 0) {
      const user = await this.userModel
        .findOne(
          userConditions.length === 1
            ? userConditions[0]
            : { $or: userConditions },
        )
        .exec();
      if (user) return user;
    }

    // 2. Fall back: look up via Customer collection
    const customer = await this.findCustomerByPaddleIds({
      paddleCustomerId: opts.paddleCustomerId,
      paddleSubscriptionId: opts.paddleSubscriptionId,
    });
    if (!customer) return null;
    return this.userModel.findById(customer.userId).exec();
  }

  /* =========================================================================
     Public: get or create Paddle customer
     ========================================================================= */

  /**
   * Ensures a Paddle customer exists for the given user.
   * Checks Customer collection → Paddle active/archived → creates.
   * Returns the Paddle customer ID string.
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

    // Resolve the User document
    const user =
      typeof emailOrUser !== 'string'
        ? emailOrUser
        : await this.userModel.findOne({ email }).exec();

    // 1. Customer collection first — fast path, no Paddle API call needed
    if (user) {
      const existingCustomer = await this.customerModel
        .findOne({ userId: user._id })
        .lean()
        .exec();
      if (existingCustomer?.paddleCustomerId) {
        return existingCustomer.paddleCustomerId;
      }
    }

    try {
      // 2. Query Paddle for customer by email (active + archived)
      const customerCollection = this.paddleService.paddle.customers.list({
        email: [email],
        status: ['active', 'archived'],
      });

      let existingPaddleCustomer: any = null;
      for await (const c of customerCollection) {
        if (c.email && c.email.toLowerCase().trim() === email) {
          existingPaddleCustomer = c;
          break;
        }
      }

      if (existingPaddleCustomer) {
        // 3. Save to Customer collection
        if (user) {
          await this.customerModel.findOneAndUpdate(
            { userId: user._id },
            {
              $set: {
                userId: user._id,
                paddleCustomerId: existingPaddleCustomer.id,
              },
            },
            { upsert: true, returnDocument: 'after' },
          );
        }
        this.logger.log(
          `Found existing Paddle customer ${existingPaddleCustomer.id} (status: ${existingPaddleCustomer.status}) for ${email}. Saved to Customer collection.`,
        );
        return existingPaddleCustomer.id;
      }

      // 4. Create a new Paddle customer
      const customData: Record<string, any> = {};
      if (user?._id) customData.blyntaUserId = String(user._id);

      const newCustomer = await this.paddleService.paddle.customers.create({
        email,
        name: userName,
        customData: Object.keys(customData).length > 0 ? customData : undefined,
      });

      if (user) {
        await this.customerModel.findOneAndUpdate(
          { userId: user._id },
          { $set: { userId: user._id, paddleCustomerId: newCustomer.id } },
          { upsert: true, returnDocument: 'after' },
        );
      }

      this.logger.log(
        `Created Paddle customer ${newCustomer.id} for user ${user?._id ?? ''} (${email})`,
      );
      return newCustomer.id;
    } catch (err: any) {
      // Fallback: race condition / conflict — re-query Paddle
      this.logger.warn(
        `Issue getting Paddle customer for ${email}: ${err?.message}. Re-querying Paddle...`,
      );
      try {
        const fallback = this.paddleService.paddle.customers.list({
          email: [email],
          status: ['active', 'archived'],
        });
        for await (const c of fallback) {
          if (c.email && c.email.toLowerCase().trim() === email) {
            if (user) {
              await this.customerModel.findOneAndUpdate(
                { userId: user._id },
                { $set: { userId: user._id, paddleCustomerId: c.id } },
                { upsert: true, returnDocument: 'after' },
              );
            }
            this.logger.log(`Recovered Paddle customer ${c.id} for ${email}`);
            return c.id;
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

  /* =========================================================================
     Public: checkout session
     ========================================================================= */

  async createCheckoutSession(
    user: UserDocument,
    dto: CreateCheckoutSessionDto,
  ) {
    if (user.plan === dto.plan) {
      throw new BadRequestException(`You are already on the ${dto.plan} plan.`);
    }

    const customerId = await this.getOrCreatePaddleCustomer(user);
    const priceId = this.paddleService.getPriceIdForPlan(dto.plan);
    const price = await this.paddleService.paddle.prices.get(priceId);
    if (
      price.status !== 'active' ||
      price.billingCycle?.interval !== 'month' ||
      price.billingCycle.frequency !== 1
    )
      throw new ServiceUnavailableException(
        'The configured subscription price must be active and monthly. Check Paddle price configuration.',
      );
    return this.checkout(user, `plan:${dto.plan}`, async () => {
      const current = await this.customerModel.findOne({ userId: user._id });
      if (
        current?.paddleSubscriptionId &&
        current.paddleSubscriptionStatus !== 'canceled'
      )
        throw new ConflictException(
          'Manage your existing subscription to change plans. A second subscription will not be created.',
        );
      return this.paddleService.paddle.transactions.create({
        customerId,
        items: [{ priceId, quantity: 1 }],
        customData: {
          blyntaUserId: String(user._id),
          requestedPlan: dto.plan,
        },
      });
    });
  }

  private checkoutPayload(transaction: {
    id: string;
    status: string;
    checkout?: { url?: string | null } | null;
  }) {
    if (!['draft', 'ready'].includes(transaction.status))
      throw new ConflictException(
        'This payment is already processing or completed. Wait for verification before starting another checkout.',
      );
    return {
      transactionId: transaction.id,
      environment: this.paddleService.environment,
      checkoutUrl: transaction.checkout?.url || undefined,
    };
  }

  async checkoutStatus(userId: string, transactionId: string) {
    const owner = await this.customerModel.findOne({ userId });
    const transaction =
      await this.paddleService.paddle.transactions.get(transactionId);
    if (!owner || transaction.customerId !== owner.paddleCustomerId)
      throw new NotFoundException('Checkout not found');
    const verified =
      transaction.status === 'completed' &&
      !!(await this.credits?.entries.exists({
        userId,
        key: `payment:${transactionId}`,
      }));
    return {
      transactionId,
      environment: this.paddleService.environment,
      status: transaction.status,
      verified,
    };
  }

  /** A short durable lease serializes checkout creation; retry reuses an unpaid transaction. */
  private async checkout(
    user: UserDocument,
    key: string,
    create: () => ReturnType<PaddleService['paddle']['transactions']['create']>,
  ) {
    const lease = randomUUID();
    const owner = await this.customerModel.findOneAndUpdate(
      {
        userId: user._id,
        $or: [
          { checkoutLeaseUntil: { $exists: false } },
          { checkoutLeaseUntil: null },
          { checkoutLeaseUntil: { $lt: new Date() } },
        ],
      },
      {
        $set: {
          checkoutLeaseToken: lease,
          checkoutLeaseUntil: new Date(Date.now() + 5 * 60_000),
        },
      },
      { returnDocument: 'after' },
    );
    if (!owner)
      throw new ConflictException(
        'Checkout is already being prepared. Please retry shortly.',
      );
    try {
      const pack = key.startsWith('pack:');
      if (
        !pack &&
        owner.paddleSubscriptionId &&
        owner.paddleSubscriptionStatus !== 'canceled'
      )
        throw new ConflictException(
          'Manage your existing subscription to change plans. A second subscription will not be created.',
        );
      const pendingId = pack
        ? owner.pendingCreditCheckoutId
        : owner.pendingCheckoutId;
      const pendingKey = pack
        ? owner.pendingCreditCheckoutKey
        : owner.pendingCheckoutKey;
      if (
        pendingId &&
        (pendingKey === key ||
          (key.startsWith('plan:') && pendingKey?.startsWith('plan:')))
      ) {
        const pending =
          await this.paddleService.paddle.transactions.get(pendingId);
        if (pending.customerId !== owner.paddleCustomerId)
          throw new ConflictException('Checkout customer mismatch');
        const resubscribing =
          !pack &&
          owner.paddleSubscriptionStatus === 'canceled' &&
          pending.status === 'completed';
        if (pendingKey !== key && ['draft', 'ready'].includes(pending.status))
          await this.paddleService.paddle.transactions.update(pending.id, {
            status: 'canceled',
          });
        else if (
          pendingKey !== key &&
          !resubscribing &&
          ['paid', 'completed', 'billed'].includes(pending.status)
        )
          return this.checkoutPayload(pending);
        if (
          pendingKey === key &&
          !resubscribing &&
          ['draft', 'ready', 'paid', 'completed', 'billed'].includes(
            pending.status,
          )
        ) {
          if (
            key.startsWith('pack:') &&
            pending.status === 'completed' &&
            (await this.credits?.entries.exists({
              key: `payment:${pending.id}`,
            }))
          ) {
            // A verified pack purchase may be followed by another intentional purchase.
          } else return this.checkoutPayload(pending);
        }
      }
      const transaction = await create();
      const payload = this.checkoutPayload(transaction);
      const saved = await this.customerModel.updateOne(
        { userId: user._id, checkoutLeaseToken: lease },
        {
          $set: pack
            ? {
                pendingCreditCheckoutId: transaction.id,
                pendingCreditCheckoutKey: key,
              }
            : { pendingCheckoutId: transaction.id, pendingCheckoutKey: key },
        },
      );
      if (!saved.matchedCount)
        throw new ConflictException(
          'Checkout preparation expired. Please retry.',
        );
      return payload;
    } catch (error) {
      if (
        error instanceof ConflictException ||
        error instanceof ServiceUnavailableException
      )
        throw error;
      this.logger.error({
        event: 'billing.checkout.failed',
        kind: key.startsWith('plan:') ? 'subscription' : 'credit-pack',
      });
      throw new ServiceUnavailableException(
        'Paddle checkout could not be prepared. Check the configured environment, price and payment-link domain, then retry.',
      );
    } finally {
      await this.customerModel.updateOne(
        { userId: user._id, checkoutLeaseToken: lease },
        { $unset: { checkoutLeaseToken: 1, checkoutLeaseUntil: 1 } },
      );
    }
  }

  async listCreditPacks() {
    return Promise.all(
      creditPacks(this.configService).map(async ({ priceId, ...pack }) => {
        if (!priceId || !this.credits?.enabled)
          return {
            ...pack,
            enabled: false,
            configurationError: !this.credits?.enabled
              ? 'Credit purchases are currently unavailable.'
              : pack.configurationError,
          };
        try {
          const price = await this.paddleService.paddle.prices.get(priceId);
          if (
            price.status !== 'active' ||
            price.billingCycle ||
            this.paddleService.mapPriceIdToPlan(priceId)
          )
            throw new Error('Invalid pack price');
          return { ...pack, enabled: true, price: price.unitPrice };
        } catch {
          return {
            ...pack,
            enabled: false,
            configurationError:
              'This credit pack price is unavailable. Check Paddle configuration.',
          };
        }
      }),
    );
  }

  async createCreditPackCheckout(user: UserDocument, packId: string) {
    if (!this.credits?.enabled)
      throw new ServiceUnavailableException(
        'BILLING_CREDITS_V2 must be enabled for credit purchases',
      );
    const pack = creditPacks(this.configService).find((p) => p.id === packId);
    if (!pack) throw new BadRequestException('Unknown credit pack');
    if (!pack.priceId)
      throw new ServiceUnavailableException(pack.configurationError!);
    const priceId = pack.priceId;
    const price = await this.paddleService.paddle.prices.get(priceId);
    if (price.status !== 'active' || price.billingCycle)
      throw new ServiceUnavailableException(
        'Credit pack Paddle price must be active and one-time',
      );
    if (this.paddleService.mapPriceIdToPlan(pack.priceId))
      throw new ServiceUnavailableException(
        'Credit pack price cannot be a subscription price',
      );
    const customerId = await this.getOrCreatePaddleCustomer(user);
    return this.checkout(user, `pack:${pack.id}`, () =>
      this.paddleService.paddle.transactions.create({
        customerId,
        items: [{ priceId, quantity: 1 }],
        customData: {
          blyntaUserId: String(user._id),
          purchaseKind: 'credit-pack',
          creditPackId: pack.id,
        },
      }),
    );
  }

  private async handleCreditPackPayment(
    transaction: CreditPayment,
    eventType?: string,
  ): Promise<boolean> {
    const custom = transaction?.customData || transaction?.custom_data || {};
    const items = transaction?.items || [];
    const packs = creditPacks(this.configService);
    const getPrice = (item: NonNullable<CreditPayment['items']>[number]) =>
      item?.price?.id || item?.priceId || item?.price_id;
    const pack = packs.find(
      (p) => p.priceId && p.priceId === getPrice(items[0]),
    );
    if (!pack && custom.purchaseKind !== 'credit-pack') return false;
    if (!pack)
      throw new ServiceUnavailableException(
        'Payment credit pack price is not configured',
      );
    if (eventType !== 'transaction.completed') return true;
    if (!this.credits?.enabled)
      throw new ServiceUnavailableException(
        'Credit purchases are paused; retry payment webhook',
      );
    if (
      !transaction.id ||
      transaction.subscriptionId ||
      transaction.subscription_id ||
      items.length !== 1 ||
      items[0].quantity !== 1 ||
      items[0].price?.billingCycle ||
      items[0].price?.billing_cycle
    )
      throw new BadRequestException(
        'Credit pack must contain exactly one non-recurring pack',
      );
    const user = await this.resolveUser({
      paddleCustomerId: transaction.customerId || transaction.customer_id,
    });
    if (!user)
      throw new BadRequestException(
        'Credit pack payment customer has no linked account',
      );
    if (custom.blyntaUserId && custom.blyntaUserId !== String(user._id))
      throw new BadRequestException('Credit pack payment owner mismatch');
    await this.credits.adjust(
      String(user._id),
      pack.credits,
      `payment:${transaction.id}`,
      `${pack.credits} purchased credits`,
      'grant',
      {
        source: 'credit-pack',
        paymentId: transaction.id,
        priceId: pack.priceId,
        packId: pack.id,
      },
    );
    return true;
  }

  async handlePaymentAdjustment(adjustment: CreditAdjustment) {
    if (adjustment?.status !== 'approved') return;
    const action = adjustment.action;
    if (action && ['chargeback_reverse', 'credit_reverse'].includes(action)) {
      if (!this.credits)
        throw new ServiceUnavailableException('Credit ledger unavailable');
      const originalId =
        adjustment.originalAdjustmentId || adjustment.original_adjustment_id;
      if (!originalId || !adjustment.id)
        throw new BadRequestException(
          'Reversal requires original adjustment ID',
        );
      await this.credits.restorePaymentAdjustment(originalId, adjustment.id);
      return;
    }
    if (!action || !['refund', 'chargeback', 'credit'].includes(action)) return;
    if (!this.credits)
      throw new ServiceUnavailableException('Credit ledger unavailable');
    const paymentId = adjustment.transactionId || adjustment.transaction_id;
    if (!paymentId || !adjustment.id)
      throw new BadRequestException(
        'Adjustment requires payment and adjustment IDs',
      );
    // Fetch authoritative totals. Never fabricate a missing historical payment grant.
    const transaction =
      await this.paddleService.paddle.transactions.get(paymentId);
    const payment = await this.credits.entries.findOne({
      key: `payment:${paymentId}`,
    });
    if (!payment) {
      const items = transaction.items || [];
      const knownPrice = items.some(
        (item) =>
          this.paddleService.mapPriceIdToPlan(item.price?.id || '') ||
          creditPacks(this.configService).some(
            (p) => p.priceId && p.priceId === item.price?.id,
          ),
      );
      if (knownPrice)
        throw new ServiceUnavailableException(
          'Payment grant not recorded; await the completed payment webhook or reconcile the legacy payment audit',
        );
      return; // An unrelated Paddle product has no credits to reverse.
    }
    const total = Number(transaction.details?.totals?.total);
    const adjusted = Number(adjustment.totals?.total);
    const fraction = adjustment.type === 'full' ? 1 : adjusted / total;
    if (
      !Number.isSafeInteger(total) ||
      total <= 0 ||
      (adjustment.type !== 'full' &&
        (!Number.isSafeInteger(adjusted) || adjusted <= 0))
    )
      throw new BadRequestException(
        'Verified payment adjustment totals missing',
      );
    await this.credits.reversePayment(
      paymentId,
      adjustment.id,
      Math.min(1, fraction),
      action,
    );
  }

  /* =========================================================================
     Public: customer portal
     ========================================================================= */

  async getCustomerPortalUrl(user: UserDocument): Promise<{ url: string }> {
    const customerId = await this.getOrCreatePaddleCustomer(user);

    // Get subscriptionId from Customer collection — no longer on User
    const customerDoc = await this.customerModel
      .findOne({ userId: user._id })
      .select('paddleSubscriptionId')
      .lean()
      .exec();
    const subscriptionId = customerDoc?.paddleSubscriptionId;

    try {
      const portalSession =
        await this.paddleService.paddle.customerPortalSessions.create(
          customerId,
          subscriptionId ? [subscriptionId] : [],
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
        `Failed to create customer portal session: ${err?.message ?? 'unknown error'}`,
      );
    }
  }

  /* =========================================================================
     Core: applyPaddleSubscription
     ========================================================================= */

  /**
   * Applies a subscription state change to the User and Customer documents.
   *
   * @param grantCredits  Pass true only when this is a genuine plan upgrade or
   *                      a renewal payment. Pass false for status-only changes
   *                      (e.g. schedule-cancel then resume with the same plan)
   *                      to prevent free credit refills via schedule/resume.
   *
   * @param billingPeriodEndsAt  Actual period end from Paddle's payload.
   *                             Used as creditsResetAt instead of nextMonth().
   *
   * @param paddleEventId  The Paddle webhook event ID — written to the audit log.
   * @param eventType      e.g. 'subscription.updated', 'transaction.completed'.
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
    billingPeriodEndsAt?: Date | null;
    userId?: string;
    userEmail?: string;
    grantCredits: boolean;
    paddleEventId?: string;
    eventType?: string;
    rawPayload?: Record<string, any>;
    paymentOccurredAt?: Date;
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
      billingPeriodEndsAt,
      userId,
      userEmail,
      grantCredits,
      paddleEventId,
      eventType,
      rawPayload,
    } = params;

    // --- Find user ---
    const user = await this.resolveUser({
      userId,
      userEmail,
      paddleCustomerId,
      paddleSubscriptionId,
    });

    if (!user) {
      this.logger.warn(
        `[applyPaddleSubscription] User not found. paddleCustomerId=${paddleCustomerId} paddleSubscriptionId=${paddleSubscriptionId} userId=${userId} email=${userEmail}`,
      );
      if (this.credits)
        throw new ServiceUnavailableException(
          'Payment account not linked yet; retry webhook',
        );
      return;
    }
    if (this.credits && paddleCustomerId) {
      const owner = await this.findCustomerByPaddleIds({ paddleCustomerId });
      if (owner && String(owner.userId) !== String(user._id))
        throw new BadRequestException('Subscription payment owner mismatch');
    }

    // --- Snapshot current state for audit log ---
    const previousPlan = user.plan as string;
    const customerDoc = await this.customerModel
      .findOne({ userId: user._id })
      .lean()
      .exec();
    const previousPriceId = customerDoc?.paddlePriceId;

    // --- Update User (only plan + credits — no Paddle IDs) ---
    const accounting = !!this.credits;
    const shouldGrant = accounting
      ? grantCredits && eventType === 'transaction.completed'
      : grantCredits;
    const userUpdate: Record<string, any> = { plan };
    let actualCreditsGranted = accounting
      ? 0
      : shouldGrant
        ? planCredits(this.configService)[plan]
        : 0;
    if (
      accounting &&
      shouldGrant &&
      !billingPeriodEndsAt &&
      paddleSubscriptionId
    ) {
      const subscription =
        await this.paddleService.paddle.subscriptions.get(paddleSubscriptionId);
      params.billingPeriodEndsAt = subscription.currentBillingPeriod?.endsAt
        ? new Date(subscription.currentBillingPeriod.endsAt)
        : undefined;
    }
    const verifiedBillingEnd = params.billingPeriodEndsAt;
    if (shouldGrant) {
      const resetAt =
        verifiedBillingEnd ?? (accounting ? null : this.nextMonth());
      if (accounting) {
        const transactionId = rawPayload?.id;
        if (!transactionId || eventType !== 'transaction.completed')
          throw new BadRequestException(
            'A completed payment is required for a credit grant',
          );
        const period = rawPayload?.billingPeriod || rawPayload?.billing_period;
        const endsAt =
          period?.endsAt ||
          period?.ends_at ||
          verifiedBillingEnd?.toISOString();
        if (!endsAt || !paddleSubscriptionId)
          throw new BadRequestException(
            'A verified subscription billing period is required for credit allocation',
          );
        const cycleKey = `cycle:${paddleSubscriptionId}:${new Date(endsAt).toISOString()}`;
        actualCreditsGranted = await this.credits!.grantSubscriptionCycle(
          String(user._id),
          planCredits(this.configService)[plan],
          cycleKey,
          transactionId,
          plan,
          params.paymentOccurredAt,
        );
      } else userUpdate.creditsBalance = planCredits(this.configService)[plan];
      userUpdate.creditsResetAt = resetAt;
    }
    await this.userModel
      .findByIdAndUpdate(user._id, { $set: userUpdate })
      .exec();

    // --- Update Customer collection (all Paddle-specific state) ---
    const customerUpdate: Record<string, any> = {
      paddleSubscriptionStatus: status,
      paddleScheduledChangeAction: scheduledChangeAction,
      paddleScheduledChangeAt: scheduledChangeAt,
    };
    if (paddleCustomerId) customerUpdate.paddleCustomerId = paddleCustomerId;
    if (paddleSubscriptionId)
      customerUpdate.paddleSubscriptionId = paddleSubscriptionId;
    if (productId) customerUpdate.paddleProductId = productId;
    if (priceId) customerUpdate.paddlePriceId = priceId;
    if (verifiedBillingEnd)
      customerUpdate.currentBillingPeriodEndsAt = verifiedBillingEnd;

    await this.customerModel.findOneAndUpdate(
      { userId: user._id },
      { $set: { userId: user._id, ...customerUpdate } },
      { upsert: true, returnDocument: 'after' },
    );

    this.logger.log(
      `[applyPaddleSubscription] User ${user._id} (${user.email}) → plan: ${plan}, status: ${status}, grantCredits: ${grantCredits}`,
    );

    // --- Write audit log row ---
    if (paddleEventId && paddleSubscriptionId) {
      try {
        await this.subscriptionEventModel.create({
          userId: user._id,
          paddleSubscriptionId,
          paddleEventId,
          eventType: eventType ?? 'unknown',
          previousPlan,
          newPlan: plan,
          previousPriceId,
          newPriceId: priceId,
          creditsGranted: actualCreditsGranted,
          rawPayload,
        });
      } catch (auditErr) {
        this.logger.warn(
          `[applyPaddleSubscription] Failed to write SubscriptionEvent audit row: ${auditErr}`,
        );
      }
    }

    // --- Notifications / email / activity (only when granting credits) ---
    if (!shouldGrant || actualCreditsGranted === 0) return;

    try {
      const subId =
        paddleSubscriptionId || `cust_${paddleCustomerId || String(user._id)}`;
      const upgradeDedupeKey = `billing:upgrade:${subId}`;

      await this.notificationsService.queueCreateIfNotExists({
        userId: user._id,
        type: NotificationType.SUCCESS,
        category: NotificationCategory.BILLING,
        title: `Upgraded to ${plan.toUpperCase()}`,
        message: `Your account has been upgraded to ${plan.toUpperCase()} with ${actualCreditsGranted} credits.`,
        actionUrl: '/billing',
        actionLabel: 'View plan',
        dedupeKey: upgradeDedupeKey,
      });

      if (user.email) {
        await this.mailService.queueSubscriptionActivatedEmail(
          user.email,
          plan,
          actualCreditsGranted,
          `sub-activated:${subId}`,
        );
      }

      await this.activitiesService.queueCreateIfNotExists({
        userId: user._id,
        type: ActivityType.BILLING_SUBSCRIPTION_CREATE,
        category: ActivityCategory.BILLING,
        title: `Subscribed to ${plan.toUpperCase()}`,
        description: `Upgraded to ${plan.toUpperCase()} plan with ${actualCreditsGranted} monthly credits.`,
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
          creditsGranted: actualCreditsGranted,
          paddleSubscriptionId: subId,
        },
      });

      await this.activitiesService.queueCreateIfNotExists({
        userId: user._id,
        type: ActivityType.CREDIT_PURCHASE,
        category: ActivityCategory.CREDIT,
        title: 'Credits added',
        description: `${actualCreditsGranted} credits added with ${plan.toUpperCase()} plan.`,
        activityUrl: '/billing',
        entityType: 'subscription',
        entityId: user._id,
        actorType: ActivityActorType.SYSTEM,
        isSystem: true,
        status: ActivityStatus.SUCCESS,
        severity: ActivitySeverity.SUCCESS,
        dedupeKey: `activity:billing:credits:${subId}`,
        metadata: { amount: actualCreditsGranted, plan },
      });
    } catch (err) {
      this.logger.warn(
        `[applyPaddleSubscription] Failed to dispatch notification/email/activity: ${err}`,
      );
    }
  }

  /* =========================================================================
     Public: revert to free tier
     ========================================================================= */

  /**
   * Reverts a user to the Free tier when their subscription is canceled/paused.
   */
  async revertSubscriptionToFree(params: {
    paddleSubscriptionId?: string;
    paddleCustomerId?: string;
    status?: string;
    paddleEventId?: string;
    eventType?: string;
    rawPayload?: Record<string, any>;
  }): Promise<void> {
    const {
      paddleSubscriptionId,
      paddleCustomerId,
      status = 'canceled',
      paddleEventId,
      eventType,
      rawPayload,
    } = params;

    const customer = await this.findCustomerByPaddleIds({
      paddleCustomerId,
      paddleSubscriptionId,
    });

    if (!customer) {
      this.logger.warn(
        `[revertSubscriptionToFree] No Customer found for paddleSubscriptionId=${paddleSubscriptionId} paddleCustomerId=${paddleCustomerId}`,
      );
      return;
    }

    const user = await this.userModel.findById(customer.userId).exec();
    if (!user) {
      this.logger.warn(
        `[revertSubscriptionToFree] No User found for customer.userId=${customer.userId}`,
      );
      return;
    }

    const previousPlan = user.plan as string;
    const previousPriceId = customer.paddlePriceId;

    // Update User — reset to free plan and refill free credits
    await this.userModel
      .findByIdAndUpdate(user._id, {
        $set: {
          plan: UserPlan.FREE,
          creditsResetAt: null,
        },
        $unset: { freeCreditGrantAt: 1 },
      })
      .exec();

    // Update Customer — reflect status, clear scheduled change
    await this.customerModel
      .findOneAndUpdate(
        { userId: user._id },
        {
          $set: {
            paddleSubscriptionStatus: status,
            paddleScheduledChangeAction: null,
            paddleScheduledChangeAt: null,
          },
        },
      )
      .exec();

    this.logger.log(
      `[revertSubscriptionToFree] Downgraded user ${user._id} (${user.email}) to Free (status: ${status})`,
    );

    // Audit log
    if (paddleEventId && paddleSubscriptionId) {
      try {
        await this.subscriptionEventModel.create({
          userId: user._id,
          paddleSubscriptionId,
          paddleEventId,
          eventType: eventType ?? 'subscription.canceled',
          previousPlan,
          newPlan: UserPlan.FREE,
          previousPriceId,
          newPriceId: undefined,
          creditsGranted: 0,
          rawPayload,
        });
      } catch (auditErr) {
        this.logger.warn(
          `[revertSubscriptionToFree] Failed to write audit row: ${auditErr}`,
        );
      }
    }

    const subId = paddleSubscriptionId || 'sub_revert';
    try {
      // Fixed: removed Date.now() so dedupeKey is stable for idempotency
      await this.notificationsService.queueCreateIfNotExists({
        userId: user._id,
        type: NotificationType.INFO,
        category: NotificationCategory.BILLING,
        title: 'Subscription ended',
        message: 'Your plan has reverted to Free tier.',
        actionUrl: '/billing',
        actionLabel: 'Manage plan',
        dedupeKey: `billing:revert:${subId}`,
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
        `[revertSubscriptionToFree] Failed to dispatch notification/activity: ${err}`,
      );
    }
  }

  /* =========================================================================
     Public: handleSubscriptionUpdated
     ========================================================================= */

  /**
   * Handles subscription lifecycle events.
   * Only grants credits when the plan or priceId actually changes.
   */
  async handleSubscriptionUpdated(
    subscription: any,
    paddleEventId?: string,
    originalEventType?: string,
  ): Promise<void> {
    const subscriptionId = subscription?.id;
    const customerId = subscription?.customerId || subscription?.customer_id;
    const status = subscription?.status;
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

    // Extract actual billing period end from Paddle payload
    const billingPeriodEndsAt = (() => {
      const raw =
        subscription?.currentBillingPeriod?.endsAt ||
        subscription?.current_billing_period?.ends_at;
      return raw ? new Date(raw) : null;
    })();

    const scheduledChange =
      subscription?.scheduledChange || subscription?.scheduled_change;
    const scheduledChangeAction = scheduledChange?.action ?? null;
    const scheduledChangeAt =
      scheduledChange?.effectiveAt || scheduledChange?.effective_at
        ? new Date(scheduledChange.effectiveAt || scheduledChange.effective_at)
        : null;

    let userEmail: string | undefined;

    // Enrich from Paddle customer if userId not on the subscription
    if (!userId && customerId) {
      try {
        const customer =
          await this.paddleService.paddle.customers.get(customerId);
        if (customer?.customData?.blyntaUserId) {
          userId = customer.customData.blyntaUserId;
        }
        if (customer?.email) userEmail = customer.email;
      } catch (err) {
        this.logger.debug(
          `Could not fetch customer ${customerId} from Paddle: ${err}`,
        );
      }
    }

    this.logger.log(
      `[handleSubscriptionUpdated] subId=${subscriptionId} customerId=${customerId} userId=${userId} status=${status} priceId=${priceId} scheduledAction=${scheduledChangeAction}`,
    );

    if (status === 'canceled' || status === 'paused') {
      await this.revertSubscriptionToFree({
        paddleSubscriptionId: subscriptionId,
        paddleCustomerId: customerId,
        status,
        paddleEventId,
        eventType: originalEventType,
        rawPayload: subscription,
      });
      return;
    }

    // Resolve plan from priceId
    let mappedPlan: UserPlan | null = null;
    if (priceId) {
      const planStr = this.paddleService.mapPriceIdToPlan(priceId);
      if (planStr && planStr !== 'free') mappedPlan = planStr as UserPlan;
    }
    if (!this.credits && !mappedPlan && customData?.requestedPlan) {
      mappedPlan =
        customData.requestedPlan === 'pro'
          ? UserPlan.PRO
          : customData.requestedPlan === 'business'
            ? UserPlan.BUSINESS
            : null;
    }

    if (!mappedPlan) {
      this.logger.warn(
        `[handleSubscriptionUpdated] Could not resolve plan for priceId=${priceId}. Updating Customer status only.`,
      );
      // Status-only update: write to Customer, not to User
      const customerDoc = await this.findCustomerByPaddleIds({
        paddleCustomerId: customerId,
        paddleSubscriptionId: subscriptionId,
      });
      if (customerDoc) {
        await this.customerModel
          .findByIdAndUpdate(customerDoc._id, {
            $set: {
              paddleSubscriptionStatus: status,
              paddleScheduledChangeAction: scheduledChangeAction,
              paddleScheduledChangeAt: scheduledChangeAt,
            },
          })
          .exec();
      }
      return;
    }

    // --- Determine if this is a real plan/price change ---
    // A "real" change warrants refilling credits.
    // Schedule-cancel-then-resume with the same plan/price is NOT a real change.
    const existingCustomer = await this.findCustomerByPaddleIds({
      paddleCustomerId: customerId,
      paddleSubscriptionId: subscriptionId,
    });
    const existingUser = existingCustomer
      ? await this.userModel
          .findById(existingCustomer.userId)
          .select('plan')
          .lean()
          .exec()
      : null;

    const isRealPlanChange =
      !existingUser ||
      !existingCustomer ||
      (existingUser.plan as string) !== (mappedPlan as string) ||
      existingCustomer.paddlePriceId !== priceId;

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
      billingPeriodEndsAt,
      grantCredits: this.credits ? false : isRealPlanChange,
      paddleEventId,
      eventType: originalEventType,
      rawPayload: subscription,
    });
  }

  /* =========================================================================
     Public: handleCustomerUpserted
     ========================================================================= */

  /**
   * Handles customer.created / customer.updated.
   * Upserts the Customer document (no longer touches User).
   */
  async handleCustomerUpserted(customer: any): Promise<void> {
    const customerId = customer?.id;
    const email = customer?.email;
    const customData = customer?.customData || customer?.custom_data || {};
    const userId = customData?.blyntaUserId || customData?.blynta_user_id;

    this.logger.log(
      `[handleCustomerUpserted] customerId=${customerId} email=${email} userId=${userId}`,
    );

    if (!customerId) return;

    let targetUserId: Types.ObjectId | null = null;

    if (userId && Types.ObjectId.isValid(userId)) {
      targetUserId = new Types.ObjectId(userId);
    } else if (email) {
      const user = await this.userModel
        .findOne({ email: email.toLowerCase().trim() })
        .select('_id')
        .lean()
        .exec();
      if (user) targetUserId = user._id as Types.ObjectId;
    }

    if (!targetUserId) {
      this.logger.warn(
        `[handleCustomerUpserted] No matching Blynta user for customerId=${customerId} email=${email}`,
      );
      return;
    }

    await this.customerModel.findOneAndUpdate(
      { userId: targetUserId },
      { $set: { userId: targetUserId, paddleCustomerId: customerId } },
      { upsert: true, returnDocument: 'after' },
    );

    this.logger.log(
      `[handleCustomerUpserted] Upserted Customer for userId=${targetUserId} paddleCustomerId=${customerId}`,
    );
  }

  /* =========================================================================
     Public: handleTransactionCompleted
     ========================================================================= */

  /**
   * Handles transaction.completed / transaction.paid.
   * A completed transaction always represents a real payment → always grant credits.
   */
  async handleTransactionCompleted(
    transaction: any,
    paddleEventId?: string,
    originalEventType?: string,
    occurredAt?: string,
  ): Promise<void> {
    if (await this.handleCreditPackPayment(transaction, originalEventType))
      return;
    if (this.credits && originalEventType !== 'transaction.completed') return;
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
        if (customer?.customData?.blyntaUserId)
          userId = customer.customData.blyntaUserId;
        if (customer?.email) userEmail = customer.email;
      } catch (err) {
        this.logger.debug(
          `Could not fetch customer ${customerId} from Paddle: ${err}`,
        );
      }
    }

    let targetPlan: UserPlan | null = null;
    if (priceId) {
      const mapped = this.paddleService.mapPriceIdToPlan(priceId);
      if (mapped && mapped !== 'free') targetPlan = mapped as UserPlan;
    }
    if (!this.credits && !targetPlan && customData?.requestedPlan) {
      targetPlan =
        customData.requestedPlan === 'pro'
          ? UserPlan.PRO
          : customData.requestedPlan === 'business'
            ? UserPlan.BUSINESS
            : null;
    }

    this.logger.log(
      `[handleTransactionCompleted] txId=${transactionId} subId=${subscriptionId} customerId=${customerId} userId=${userId} plan=${targetPlan}`,
    );

    const period = transaction?.billingPeriod || transaction?.billing_period;
    const verifiedPeriodEnd = period?.endsAt || period?.ends_at;
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
        billingPeriodEndsAt: verifiedPeriodEnd
          ? new Date(verifiedPeriodEnd)
          : undefined,
        // A real payment always grants credits — renewal or new subscription
        grantCredits: this.credits
          ? originalEventType === 'transaction.completed'
          : true,
        paddleEventId,
        eventType: originalEventType,
        rawPayload: transaction,
        paymentOccurredAt: occurredAt ? new Date(occurredAt) : undefined,
      });
    }
  }
}
