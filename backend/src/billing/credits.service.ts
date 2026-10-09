import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  OnModuleInit,
  Optional,
  Inject,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { ClientSession, Connection, Model, Types } from 'mongoose';
import {
  User,
  UserDocument,
  PLAN_CREDITS,
  UserPlan,
} from '../users/schemas/user.schema';
import {
  CreditEntry,
  CreditOperation,
  ProcessingUsage,
} from './credit.schemas';
import { INITIAL_PRICING, PricingSnapshot, clipPrice } from './credit-pricing';
import { Customer, CustomerDocument } from './schemas/customer.schema';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';
import { randomUUID } from 'node:crypto';
import { usageExecution } from './usage-context';

@Injectable()
export class CreditsService implements OnModuleInit {
  private readonly logger = new Logger(CreditsService.name);
  constructor(
    @InjectConnection() private connection: Connection,
    @InjectModel(User.name) private users: Model<UserDocument>,
    @InjectModel('CreditEntry') readonly entries: Model<CreditEntry>,
    @InjectModel('CreditOperation') readonly operations: Model<CreditOperation>,
    @InjectModel('ProcessingUsage') readonly usage: Model<ProcessingUsage>,
    private config: ConfigService,
    @InjectModel(Customer.name) private customers: Model<CustomerDocument>,
    @Optional() @Inject(REDIS_CLIENT) private telemetryRedis?: Redis,
  ) {}
  get enabled() {
    return this.config.get('BILLING_CREDITS_V2', 'false') === 'true';
  }
  async onModuleInit() {
    if (!this.enabled) return;
    const topology = await this.connection.db!.admin().command({ hello: 1 });
    if (!topology.setName && topology.msg !== 'isdbgrid')
      throw new Error(
        'BILLING_CREDITS_V2 requires MongoDB transactions (replica set or sharded cluster)',
      );
    for (const [model, field] of [
      [this.entries, 'key'],
      [this.operations, 'operationId'],
    ] as const) {
      const indexes = await model.collection.indexes();
      if (!indexes.some((index) => index.unique && index.key[field] === 1))
        throw new Error(
          `Billing unique index missing: ${field}. Run migrate:credit-ledger -- --apply before enabling billing.`,
        );
    }
    const usageIndexes = await this.usage.collection.indexes();
    if (
      !usageIndexes.some(
        (index) =>
          index.unique &&
          index.key.operationId === 1 &&
          index.key.attemptId === 1 &&
          index.key.stage === 1,
      )
    )
      throw new Error(
        'Billing usage index missing. Run migrate:credit-ledger -- --apply before enabling billing.',
      );
    this.pricing();
  }
  pricing(): PricingSnapshot {
    const raw = this.config.get<string>('BILLING_PRICING_JSON');
    const p = raw
      ? (JSON.parse(raw) as PricingSnapshot)
      : { ...INITIAL_PRICING };
    if (
      !p.version ||
      ![
        p.sourceSeconds,
        p.outputSeconds,
        p.studioSeconds,
        p.studioModifier,
        p.aiCredits,
      ].every((n) => Number.isFinite(n) && n > 0)
    )
      throw new ServiceUnavailableException('Billing pricing is invalid');
    if (
      typeof p.version !== 'string' ||
      p.version.length > 80 ||
      !Number.isSafeInteger(p.aiCredits)
    )
      throw new ServiceUnavailableException(
        'Billing pricing version or AI rate is invalid',
      );
    return p;
  }
  private amount(n: number) {
    if (!Number.isSafeInteger(n) || n < 0)
      throw new BadRequestException('Invalid credit amount');
  }
  /** Both the cached balance and immutable ledger commit, or neither does. Requires replica set. */
  async transaction<T>(
    work: (session: ClientSession) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const session = await this.connection.startSession();
      try {
        return await session.withTransaction(() => work(session));
      } catch (error) {
        if ((error as { code?: number }).code === 11000 && attempt < 2)
          continue;
        this.logger.error({
          event: 'billing.transaction.failed',
          error: String(error),
        });
        throw error;
      } finally {
        await session.endSession();
      }
    }
    throw new ConflictException('Please retry billing operation');
  }
  async opening(userId: string, session: ClientSession) {
    const user = await this.users.findById(userId).session(session);
    if (!user) throw new NotFoundException('Account not found');
    if (user.creditLedgerInitialized) return user;
    this.amount(user.creditsBalance);
    await this.entries.create(
      [
        {
          userId,
          key: `opening:${userId}`,
          operationId: `opening:${userId}`,
          product: 'account',
          type: 'opening',
          amount: user.creditsBalance,
          availableDelta: user.creditsBalance,
          reservedDelta: 0,
          availableAfter: user.creditsBalance,
          reservedAfter: 0,
          description: 'Opening balance — preserved existing credits',
        },
      ],
      { session },
    );
    user.creditLedgerInitialized = true;
    user.creditsReserved = 0;
    if (user.plan === UserPlan.FREE && !user.freeCreditGrantAt) {
      const next =
        user.creditsResetAt && user.creditsResetAt > new Date()
          ? new Date(user.creditsResetAt)
          : new Date();
      if (next <= new Date()) next.setUTCMonth(next.getUTCMonth() + 1);
      user.freeCreditGrantAt = next;
    }
    await user.save({ session });
    return user;
  }
  async migrate(userId: string) {
    return this.transaction((s) => this.opening(userId, s));
  }
  private async entry(
    session: ClientSession,
    op: CreditOperation,
    type: CreditEntry['type'],
    amount: number,
    availableDelta: number,
    reservedDelta: number,
    key: string,
    description: string,
  ) {
    const user = await this.users.findOneAndUpdate(
      {
        _id: op.userId,
        creditsBalance: { $gte: Math.max(0, -availableDelta) },
        creditsReserved: { $gte: Math.max(0, -reservedDelta) },
      },
      {
        $inc: {
          creditsBalance: availableDelta,
          creditsReserved: reservedDelta,
          totalCreditsUsed: type === 'charge' ? amount : 0,
        },
      },
      { session, new: true },
    );
    if (!user) {
      const account = await this.users.findById(op.userId).session(session);
      throw new ConflictException({
        code: 'INSUFFICIENT_CREDITS',
        message: 'Insufficient available credits',
        required: Math.max(0, -availableDelta),
        available: account?.creditsBalance ?? 0,
      });
    }
    this.amount(user.creditsBalance);
    this.amount(user.creditsReserved);
    await this.entries.create(
      [
        {
          userId: op.userId,
          key,
          operationId: op.operationId,
          relatedId: op.relatedId,
          product: op.product,
          type,
          amount,
          availableDelta,
          reservedDelta,
          availableAfter: user.creditsBalance,
          reservedAfter: user.creditsReserved,
          pricingVersion: op.pricing.version,
          description,
        },
      ],
      { session },
    );
  }
  async reserve(
    input: Pick<
      CreditOperation,
      | 'userId'
      | 'operationId'
      | 'product'
      | 'relatedId'
      | 'sourceSeconds'
      | 'maxOutputSeconds'
      | 'fingerprint'
    > & {
      amount: number;
      pricing?: PricingSnapshot;
      kind?: CreditOperation['kind'];
    },
  ) {
    this.amount(input.amount);
    return this.transaction(async (session) => {
      const account = await this.opening(input.userId, session);
      if (account.isActive === false)
        throw new ConflictException('Account is not active');
      const old = await this.operations
        .findOne({ operationId: input.operationId })
        .session(session);
      if (old) {
        if (
          old.userId !== input.userId ||
          old.fingerprint !== input.fingerprint
        )
          throw new ConflictException(
            'Operation ID has already been used for different work',
          );
        return old;
      }
      const [op] = await this.operations.create(
        [
          {
            ...input,
            authorized: input.amount,
            held: input.amount,
            pricing: input.pricing || this.pricing(),
          },
        ],
        { session },
      );
      await this.entry(
        session,
        op,
        'reserve',
        input.amount,
        -input.amount,
        input.amount,
        `reserve:${input.operationId}:0`,
        'Credits held for processing',
      );
      return op;
    });
  }
  /** Retry authorizes only the remainder of the ORIGINAL budget. Source/output charges are cumulative. */
  async reopen(operationId: string) {
    return this.transaction((session) =>
      this.reopenInSession(operationId, session),
    );
  }
  async retry<T>(
    operationId: string,
    activate: (session: ClientSession) => Promise<T>,
  ): Promise<T> {
    return this.transaction(async (session) => {
      await this.reopenInSession(operationId, session);
      return activate(session);
    });
  }
  private async reopenInSession(operationId: string, session: ClientSession) {
    const op = await this.operations.findOne({ operationId }).session(session);
    if (!op) throw new NotFoundException('Credit operation not found');
    if (op.status === 'reserved') return op;
    op.generation += 1;
    if (op.kind === 'studio-ai') {
      op.executionStartedAt = undefined;
      op.executionToken = undefined;
    }
    op.held = op.authorized - op.charged;
    await this.entry(
      session,
      op,
      'reserve',
      op.held,
      -op.held,
      op.held,
      `reserve:${operationId}:${op.generation}`,
      'Credits held for retry within original budget',
    );
    op.status = 'reserved';
    await op.save({ session });
    return op;
  }
  async settle(
    operationId: string,
    cumulativeCharge: number,
    deliveredOutputs?: { id: string; seconds: number }[],
    fence?: {
      generation: number;
      executionToken?: string;
      missingResult?: boolean;
    },
  ) {
    this.amount(cumulativeCharge);
    return this.transaction(async (session) => {
      const op = await this.operations
        .findOne({ operationId })
        .session(session);
      if (!op) throw new NotFoundException('Credit operation not found');
      if (op.status === 'settled') return op;
      if (
        fence &&
        (op.generation !== fence.generation ||
          op.executionToken !== fence.executionToken ||
          (fence.missingResult && op.result !== undefined))
      )
        return op;
      if (op.product === 'ai-clips') {
        const job = await this.connection
          .collection('jobs')
          .findOne({ _id: new Types.ObjectId(op.relatedId) }, { session });
        if (
          job &&
          (!['completed', 'failed', 'cancelled'].includes(String(job.status)) ||
            (Array.isArray(job.activeExecutions) &&
              job.activeExecutions.length > 0))
        )
          return op;
      }
      if (cumulativeCharge > op.authorized || cumulativeCharge < op.charged)
        throw new ConflictException(
          'Settlement exceeds authorization or reverses prior delivered work',
        );
      const charge = cumulativeCharge - op.charged;
      if (charge > op.held)
        throw new ConflictException('Settlement exceeds held credits');
      if (charge)
        await this.entry(
          session,
          op,
          'charge',
          charge,
          0,
          -charge,
          `charge:${operationId}:${op.generation}`,
          'Delivered work charged',
        );
      const release = op.held - charge;
      if (release)
        await this.entry(
          session,
          op,
          'release',
          release,
          release,
          -release,
          `release:${operationId}:${op.generation}`,
          'Unused hold released (not a credit grant)',
        );
      if (deliveredOutputs) op.deliveredOutputs = deliveredOutputs;
      op.charged = cumulativeCharge;
      op.held = 0;
      op.status = 'settled';
      await op.save({ session });
      return op;
    });
  }
  async adjust(
    userId: string,
    amount: number,
    key: string,
    description: string,
    type: 'grant' | 'adjustment' | 'refund' = 'grant',
    metadata: Record<string, unknown> = {},
  ) {
    this.amount(Math.abs(amount));
    return this.transaction(async (session) => {
      await this.opening(userId, session);
      const existing = await this.entries.findOne({ key }).session(session);
      if (existing) {
        if (existing.userId !== userId || existing.availableDelta !== amount)
          throw new ConflictException('Credit key conflict');
        return existing;
      }
      const user = await this.users.findOneAndUpdate(
        { _id: userId, creditsBalance: { $gte: Math.max(0, -amount) } },
        { $inc: { creditsBalance: amount } },
        { session, new: true },
      );
      if (!user)
        throw new ConflictException(
          'Adjustment would make available credits negative',
        );
      this.amount(user.creditsBalance);
      const [entry] = await this.entries.create(
        [
          {
            userId,
            key,
            operationId: key,
            product: 'account',
            type,
            amount: Math.abs(amount),
            availableDelta: amount,
            reservedDelta: 0,
            availableAfter: user.creditsBalance,
            reservedAfter: user.creditsReserved,
            description,
            metadata,
          },
        ],
        { session },
      );
      return entry;
    });
  }
  async grantSubscriptionCycle(
    userId: string,
    allocation: number,
    cycleKey: string,
    paymentId: string,
    plan: string,
  ) {
    this.amount(allocation);
    return this.transaction(async (session) => {
      const user = await this.opening(userId, session);
      const key = `payment:${paymentId}`;
      if (await this.entries.exists({ key }).session(session)) return 0;
      const [cycle] = await this.entries
        .aggregate<{ amount: number }>([
          { $match: { userId, type: 'grant', 'metadata.cycleKey': cycleKey } },
          { $group: { _id: null, amount: { $sum: '$amount' } } },
        ])
        .session(session);
      // Paid upgrade tops up the cycle allocation. Downgrade never confiscates credits.
      const amount = Math.max(0, allocation - (cycle?.amount || 0));
      user.creditsBalance += amount;
      this.amount(user.creditsBalance);
      await user.save({ session });
      await this.entries.create(
        [
          {
            userId,
            key,
            operationId: cycleKey,
            product: 'account',
            type: 'grant',
            amount,
            availableDelta: amount,
            reservedDelta: 0,
            availableAfter: user.creditsBalance,
            reservedAfter: user.creditsReserved,
            description: amount
              ? 'Subscription cycle credit allocation'
              : 'Subscription payment — cycle allocation already granted',
            metadata: { cycleKey, paymentId, plan, allocation },
          },
        ],
        { session },
      );
      return amount;
    });
  }
  async refund(
    userId: string,
    chargeId: string,
    amount: number,
    key: string,
    reason: string,
    adminId: string,
  ) {
    this.amount(amount);
    if (amount === 0) throw new BadRequestException('Refund must be positive');
    return this.transaction(async (session) => {
      const user = await this.opening(userId, session);
      const existing = await this.entries.findOne({ key }).session(session);
      if (existing) {
        if (
          existing.userId !== userId ||
          existing.amount !== amount ||
          existing.metadata?.chargeId !== chargeId
        )
          throw new ConflictException('Refund key conflict');
        return existing;
      }
      const charge = await this.entries
        .findOne({ _id: chargeId, userId, type: 'charge' })
        .session(session);
      if (!charge) throw new NotFoundException('Original charge not found');
      const [refunded] = await this.entries
        .aggregate<{ amount: number }>([
          { $match: { userId, type: 'refund', 'metadata.chargeId': chargeId } },
          { $group: { _id: null, amount: { $sum: '$amount' } } },
        ])
        .session(session);
      if ((refunded?.amount || 0) + amount > charge.amount)
        throw new ConflictException('Refund exceeds original charge');
      user.creditsBalance += amount;
      this.amount(user.creditsBalance);
      await user.save({ session });
      const [entry] = await this.entries.create(
        [
          {
            userId,
            key,
            operationId: charge.operationId,
            relatedId: charge.relatedId,
            product: charge.product,
            type: 'refund',
            amount,
            availableDelta: amount,
            reservedDelta: 0,
            availableAfter: user.creditsBalance,
            reservedAfter: user.creditsReserved,
            pricingVersion: charge.pricingVersion,
            description: reason,
            metadata: { chargeId, adminId },
          },
        ],
        { session },
      );
      return entry;
    });
  }
  async balance(userId: string) {
    let user = await this.users.findById(userId);
    if (!user) throw new NotFoundException('Account not found');
    if (this.enabled && !user.creditLedgerInitialized)
      user = await this.migrate(userId);
    const customer = await this.customers.findOne({ userId: user._id }).lean();
    const renewal =
      user.plan === UserPlan.FREE
        ? user.freeCreditGrantAt
        : customer?.currentBillingPeriodEndsAt;
    const pricing = this.pricing();
    return {
      enabled: this.enabled,
      available: user.creditsBalance,
      reserved: user.creditsReserved || 0,
      nextRenewal: renewal && renewal > new Date() ? renewal : null,
      subscriptionStatus: customer?.paddleSubscriptionStatus || null,
      plan: user.plan,
      monthlyCredits: PLAN_CREDITS[user.plan],
      pricing,
      clipExample: clipPrice(30 * 60, 3 * 60, pricing),
      entitlements: {
        aiClips: true,
        studio: true,
        studioResolutions: ['720p', '1080p'],
        advancedClipOptions: user.plan !== UserPlan.FREE,
        brandTemplates: false,
        teamFeatures: false,
      },
    };
  }
  async estimate(
    userId: string,
    sourceSeconds: number,
    maxOutputSeconds: number,
  ) {
    const b = await this.balance(userId);
    return {
      ...clipPrice(sourceSeconds, maxOutputSeconds, b.pricing),
      available: b.available,
      enabled: b.enabled,
      pricingVersion: b.pricing.version,
      sourceSeconds,
      maxOutputSeconds,
    };
  }
  async grantFreeCycle(userId: string) {
    return this.transaction(async (session) => {
      const user = await this.opening(userId, session);
      const at = user.freeCreditGrantAt;
      if (user.plan !== UserPlan.FREE || !at || at > new Date()) return;
      const key = `free-cycle:${userId}:${at.toISOString()}`;
      const exists = await this.entries.exists({ key }).session(session);
      if (!exists) {
        user.creditsBalance += PLAN_CREDITS.free;
        this.amount(user.creditsBalance);
        await this.entries.create(
          [
            {
              userId,
              key,
              operationId: key,
              product: 'account',
              type: 'grant',
              amount: PLAN_CREDITS.free,
              availableDelta: PLAN_CREDITS.free,
              reservedDelta: 0,
              availableAfter: user.creditsBalance,
              reservedAfter: user.creditsReserved,
              description: 'Monthly Free plan credits',
            },
          ],
          { session },
        );
      }
      const next = new Date(at);
      do {
        next.setUTCMonth(next.getUTCMonth() + 1);
      } while (next <= new Date());
      user.freeCreditGrantAt = next;
      await user.save({ session });
    });
  }
  async history(
    userId: string,
    page: number,
    limit: number,
    product?: CreditEntry['product'],
    type?: CreditEntry['type'],
  ) {
    const filter = {
      userId,
      ...(product ? { product } : {}),
      ...(type ? { type } : {}),
    };
    const [rows, total] = await Promise.all([
      this.entries
        .find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select('-metadata -key -__v')
        .lean(),
      this.entries.countDocuments(filter),
    ]);
    return { rows, total, page, totalPages: Math.ceil(total / limit) };
  }
  async assertSourceBudget(operationId: string, duration: number) {
    const op = await this.operations.findOne({ operationId });
    if (!op || op.status !== 'reserved')
      throw new ConflictException('No active credit authorization');
    if (
      !Number.isFinite(duration) ||
      duration <= 0 ||
      duration > op.sourceSeconds
    )
      throw new ConflictException(
        'Source exceeds approved duration. Increase your budget and submit again.',
      );
  }
  async executeAi<T>(operationId: string, work: () => Promise<T>): Promise<T> {
    const op = await this.operations.findOne({ operationId });
    if (!op) throw new NotFoundException('AI authorization not found');
    if (op.result !== undefined) {
      await this.settle(operationId, op.authorized);
      return op.result as T;
    }
    if (op.status === 'settled' && op.charged === 0)
      await this.reopen(operationId);
    const executionToken = randomUUID();
    const claimed = await this.operations.findOneAndUpdate(
      { operationId, status: 'reserved', executionStartedAt: null },
      { $set: { executionStartedAt: new Date(), executionToken } },
      { new: true },
    );
    if (!claimed)
      throw new ConflictException(
        'AI request already running or ended. Review a new request.',
      );
    const fence = { generation: claimed.generation, executionToken };
    let result: T;
    try {
      result = await this.capture(operationId, `ai-${Date.now()}`, work);
    } catch (error) {
      await this.settle(operationId, 0, undefined, fence);
      throw error;
    }
    // Durable result precedes charge. Reconciliation can finish settlement after API restart.
    const published = await this.operations.findOneAndUpdate(
      {
        operationId,
        status: 'reserved',
        generation: fence.generation,
        executionToken,
      },
      { $set: { result } },
      { new: true, runValidators: true },
    );
    if (!published)
      throw new ConflictException(
        'AI execution authorization expired. Review and retry.',
      );
    await this.settle(operationId, claimed.authorized, undefined, fence);
    return result;
  }
  async record(
    operationId: string,
    attemptId: string,
    stage: string,
    metrics: Record<string, unknown>,
  ) {
    await this.usage.updateOne(
      { operationId, attemptId, stage },
      {
        $setOnInsert: {
          operationId,
          attemptId,
          stage,
          recordedAt: new Date(),
        },
        $set: { metrics },
      },
      { upsert: true, runValidators: true },
    );
  }
  async capture<T>(
    operationId: string,
    attemptId: string,
    work: () => Promise<T>,
  ): Promise<T> {
    const samples: import('./usage-context').UsageSample[] = [];
    const start = Date.now();
    const pending = new Set<Promise<void>>();
    const persist = async (sample: import('./usage-context').UsageSample) => {
      const id = `${operationId}:${attemptId}:${sample.id}`;
      const payload = {
        operationId,
        attemptId: `${attemptId}-${sample.id}`,
        stage: sample.stage,
        metrics: sample.metrics,
      };
      try {
        // Redis is a retry outbox, not a source of customer accounting truth.
        if (this.telemetryRedis) {
          try {
            await this.telemetryRedis.hset(
              'billing:usage:pending',
              id,
              JSON.stringify(payload),
            );
          } catch (error) {
            this.logger.error({
              event: 'billing.usage.outbox.failed',
              operationId,
              error: String(error),
            });
          }
        }
        await this.record(
          payload.operationId,
          payload.attemptId,
          payload.stage,
          payload.metrics,
        );
        // Keep the sample until the final enriched write; recovery can persist raw measurements after a hard kill.
      } catch (error) {
        this.logger.error({
          event: 'billing.usage.persist.failed',
          operationId,
          error: String(error),
        });
      }
    };
    try {
      return await usageExecution.run({ samples, pending, persist }, work);
    } finally {
      await Promise.allSettled([...pending]);
      try {
        const op = await this.operations.findOne({ operationId });
        const costs = JSON.parse(
          this.config.get<string>('BILLING_COST_RATES_JSON', '{}'),
        ) as Record<
          string,
          {
            inputPerMillion?: number;
            outputPerMillion?: number;
            audioPerMinute?: number;
            cpuPerHour?: number;
          }
        >;
        let estimatedCost = 0;
        let measuredCosts = 0;
        for (const sample of samples) {
          const m = sample.metrics;
          const rate =
            costs[`${String(m.provider)}/${String(m.model)}`] ||
            costs[sample.stage];
          const usage = m.usage as
            { inputTokens?: number; outputTokens?: number } | undefined;
          let cost: number | null = null;
          if (
            sample.stage === 'llm' &&
            rate?.inputPerMillion !== undefined &&
            rate?.outputPerMillion !== undefined &&
            usage?.inputTokens !== undefined &&
            usage.outputTokens !== undefined
          )
            cost =
              (usage.inputTokens * rate.inputPerMillion +
                usage.outputTokens * rate.outputPerMillion) /
              1e6;
          if (
            sample.stage === 'transcription' &&
            rate?.audioPerMinute !== undefined &&
            typeof m.audioDurationSeconds === 'number'
          )
            cost = (m.audioDurationSeconds / 60) * rate.audioPerMinute;
          if (
            sample.stage === 'ffmpeg' &&
            rate?.cpuPerHour !== undefined &&
            typeof m.cpuSeconds === 'number'
          )
            cost = (m.cpuSeconds / 3600) * rate.cpuPerHour;
          if (cost !== null) {
            estimatedCost += cost;
            measuredCosts++;
          }
          try {
            await this.record(
              operationId,
              `${attemptId}-${sample.id}`,
              sample.stage,
              {
                ...m,
                ...(sample.stage === 'transcription'
                  ? { authorizedAudioSeconds: op?.sourceSeconds }
                  : {}),
                estimatedCostUsd: cost,
              },
            );
            if (this.telemetryRedis)
              await this.telemetryRedis.hdel(
                'billing:usage:pending',
                `${operationId}:${attemptId}:${sample.id}`,
              );
          } catch (error) {
            this.logger.error({
              event: 'billing.usage.persist.failed',
              operationId,
              error: String(error),
            });
          }
        }
        const warningUsd = Number(
          this.config.get('BILLING_COST_WARNING_USD', '0'),
        );
        if (warningUsd > 0 && estimatedCost > warningUsd)
          this.logger.warn({
            event: 'billing.processing-cost.high',
            operationId,
            attemptId,
            knownEstimatedCostUsd: estimatedCost,
          });
        await this.record(operationId, attemptId, 'attempt', {
          wallSeconds: (Date.now() - start) / 1000,
          knownEstimatedCostUsd: estimatedCost,
          measuredCosts,
          sampleCount: samples.length,
        });
      } catch (error) {
        this.logger.error({
          event: 'billing.usage.persist.failed',
          operationId,
          error: String(error),
        });
      }
    }
  }
  private telemetryCursor = '0';
  async recoverUsage() {
    if (!this.telemetryRedis) return;
    const [cursor, pairs] = await this.telemetryRedis.hscan(
      'billing:usage:pending',
      this.telemetryCursor,
      'COUNT',
      100,
    );
    this.telemetryCursor = cursor;
    for (let i = 0; i < pairs.length; i += 2) {
      try {
        const sample = JSON.parse(pairs[i + 1]) as {
          operationId: string;
          attemptId: string;
          stage: string;
          metrics: Record<string, unknown>;
        };
        // Insert-only replay preserves a concurrently enriched metrics record.
        await this.usage.updateOne(
          {
            operationId: sample.operationId,
            attemptId: sample.attemptId,
            stage: sample.stage,
          },
          { $setOnInsert: { ...sample, recordedAt: new Date() } },
          { upsert: true, runValidators: true },
        );
        await this.telemetryRedis.hdel('billing:usage:pending', pairs[i]);
      } catch (error) {
        this.logger.error({
          event: 'billing.usage.recovery.failed',
          error: String(error),
        });
      }
    }
  }
  async audit(userId: string) {
    const current = await this.balance(userId);
    const result = await this.transaction(async (session) => {
      const [row] = await this.entries
        .aggregate<{ available: number; reserved: number }>([
          { $match: { userId } },
          {
            $group: {
              _id: null,
              available: { $sum: '$availableDelta' },
              reserved: { $sum: '$reservedDelta' },
            },
          },
        ])
        .session(session);
      const user = await this.users.findById(userId).session(session);
      if (!user) throw new NotFoundException('Account not found');
      const balance = {
        ...current,
        available: user.creditsBalance,
        reserved: user.creditsReserved || 0,
      };
      this.amount(balance.available);
      this.amount(balance.reserved);
      const consistent = row
        ? row.available === balance.available &&
          row.reserved === balance.reserved
        : !user.creditLedgerInitialized;
      return { consistent, ledger: row || null, balance };
    });
    if (!result.consistent)
      this.logger.error({
        event: 'billing.ledger.inconsistent',
        userId,
        ...result,
      });
    return result;
  }
}
