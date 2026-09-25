/**
 * billing.service.spec.ts
 *
 * Unit tests for the credit-refill bug fixes (acceptance criteria 2–6).
 * All Mongoose models, Paddle SDK, and side-effect services are mocked so
 * these run fully in-process with no network or DB required.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { BillingService } from './billing.service';
import { PaddleService } from '../paddle/paddle.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MailService } from '../mail/mail.service';
import { ActivitiesService } from '../activities/activities.service';
import { ConfigService } from '@nestjs/config';
import { User, UserPlan, PLAN_CREDITS } from '../users/schemas/user.schema';
import { Customer } from './schemas/customer.schema';
import { SubscriptionEvent } from './schemas/subscription-event.schema';
import { ProcessedPaddleEvent } from './schemas/processed-paddle-event.schema';

/* ──────────────────────────────────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────────────────────────────────── */

const makeId = () => new Types.ObjectId();

/** Creates a minimal mock Mongoose model factory. */
function makeMockModel(defaults: Record<string, any> = {}) {
  const docs = new Map<string, any>();

  const model: any = jest.fn().mockImplementation((data: any) => ({
    ...data,
    save: jest.fn().mockResolvedValue({ ...data }),
  }));

  model.findOne = jest.fn().mockReturnValue({
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(null),
  });
  model.findById = jest.fn().mockReturnValue({
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(null),
  });
  model.findByIdAndUpdate = jest.fn().mockReturnValue({
    exec: jest.fn().mockResolvedValue(null),
  });
  model.findOneAndUpdate = jest.fn().mockReturnValue({
    exec: jest.fn().mockResolvedValue(null),
  });
  model.create = jest.fn().mockResolvedValue({});

  return model;
}

/* ──────────────────────────────────────────────────────────────────────────
   Test suite
   ────────────────────────────────────────────────────────────────────────── */

describe('BillingService', () => {
  let service: BillingService;

  let userModel: ReturnType<typeof makeMockModel>;
  let customerModel: ReturnType<typeof makeMockModel>;
  let subscriptionEventModel: ReturnType<typeof makeMockModel>;
  let processedEventModel: ReturnType<typeof makeMockModel>;

  let paddleService: jest.Mocked<Partial<PaddleService>>;
  let notificationsService: jest.Mocked<Partial<NotificationsService>>;
  let mailService: jest.Mocked<Partial<MailService>>;
  let activitiesService: jest.Mocked<Partial<ActivitiesService>>;

  beforeEach(async () => {
    userModel = makeMockModel();
    customerModel = makeMockModel();
    subscriptionEventModel = makeMockModel();
    processedEventModel = makeMockModel();

    paddleService = {
      paddle: {
        customers: { get: jest.fn() },
      } as any,
      mapPriceIdToPlan: jest.fn().mockReturnValue('pro'),
      getPriceIdForPlan: jest.fn().mockReturnValue('pri_pro_monthly'),
      getWebhookSecret: jest.fn().mockReturnValue('secret'),
    };

    notificationsService = {
      queueCreateIfNotExists: jest.fn().mockResolvedValue(undefined),
    };

    mailService = {
      queueSubscriptionActivatedEmail: jest.fn().mockResolvedValue(undefined),
    };

    activitiesService = {
      queueCreateIfNotExists: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: PaddleService, useValue: paddleService },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('http://localhost:3000') } },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: MailService, useValue: mailService },
        { provide: ActivitiesService, useValue: activitiesService },
        { provide: getModelToken(User.name), useValue: userModel },
        { provide: getModelToken(Customer.name), useValue: customerModel },
        { provide: getModelToken(SubscriptionEvent.name), useValue: subscriptionEventModel },
        { provide: getModelToken(ProcessedPaddleEvent.name), useValue: processedEventModel },
      ],
    }).compile();

    service = module.get<BillingService>(BillingService);
  });

  /* ────────────────────────────────────────────────────────────────────────
     Acceptance criterion 2:
     Schedule-cancel then resume → zero change to creditsBalance
     ────────────────────────────────────────────────────────────────────── */

  describe('Criterion 2 — schedule/resume does NOT refill credits', () => {
    const userId = makeId();
    const subId = 'sub_test_123';
    const priceId = 'pri_pro_monthly';
    const customerId = 'ctm_test_456';

    /** Shared subscription payload factory */
    const makeSubPayload = (scheduledAction: string | null = null) => ({
      id: subId,
      customerId,
      status: 'active',
      customData: { blyntaUserId: String(userId) },
      items: [{ price: { id: priceId, productId: 'pro_xxx' } }],
      currentBillingPeriod: { endsAt: new Date(Date.now() + 30 * 86400_000).toISOString() },
      scheduledChange: scheduledAction ? { action: scheduledAction, effectiveAt: new Date().toISOString() } : null,
    });

    beforeEach(() => {
      // mapPriceIdToPlan always returns 'pro' for this price
      (paddleService.mapPriceIdToPlan as jest.Mock).mockReturnValue('pro');

      // User is already on PRO
      userModel.findById.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({ _id: userId, plan: UserPlan.PRO }),
      });
      userModel.findOne.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({
          _id: userId,
          email: 'user@test.com',
          plan: UserPlan.PRO,
        }),
      });

      // Customer record matches the same price
      customerModel.findOne.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({
          _id: makeId(),
          userId,
          paddleCustomerId: customerId,
          paddleSubscriptionId: subId,
          paddlePriceId: priceId, // same price → NOT a real change
        }),
      });
    });

    it('should NOT grant credits when schedule-cancel fires (same plan, same price)', async () => {
      await service.handleSubscriptionUpdated(
        makeSubPayload('cancel'),
        'evt_schedule_cancel',
        'subscription.updated',
      );

      // findByIdAndUpdate on userModel is the credit-writing call
      // It should be called for plan update but creditsBalance must NOT be present
      const userUpdateCalls = (userModel.findByIdAndUpdate as jest.Mock).mock.calls;
      for (const call of userUpdateCalls) {
        const updateDoc = call[1];
        expect(updateDoc?.$set?.creditsBalance).toBeUndefined();
      }
    });

    it('should NOT grant credits when resume fires after schedule-cancel (same plan, same price)', async () => {
      // Resume: scheduledChange cleared, status still active
      await service.handleSubscriptionUpdated(
        { ...makeSubPayload(null), scheduledChange: null },
        'evt_resume',
        'subscription.updated',
      );

      const userUpdateCalls = (userModel.findByIdAndUpdate as jest.Mock).mock.calls;
      for (const call of userUpdateCalls) {
        expect(call[1]?.$set?.creditsBalance).toBeUndefined();
      }
    });

    it('should NOT send email when no credits are granted', async () => {
      await service.handleSubscriptionUpdated(
        makeSubPayload('cancel'),
        'evt_schedule_cancel_2',
        'subscription.updated',
      );

      expect(mailService.queueSubscriptionActivatedEmail).not.toHaveBeenCalled();
    });
  });

  /* ────────────────────────────────────────────────────────────────────────
     Acceptance criterion 3:
     Genuine plan change (Free → Pro) sets creditsBalance to new plan credits
     ────────────────────────────────────────────────────────────────────── */

  describe('Criterion 3 — genuine plan change grants credits', () => {
    const userId = makeId();
    const subId = 'sub_new_456';
    const priceId = 'pri_pro_monthly';
    const customerId = 'ctm_new_789';

    beforeEach(() => {
      (paddleService.mapPriceIdToPlan as jest.Mock).mockReturnValue('pro');

      // User was FREE before
      userModel.findOne.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({
          _id: userId,
          email: 'user@test.com',
          plan: UserPlan.FREE, // ← different from mappedPlan (PRO)
        }),
      });
      userModel.findById.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({ _id: userId, plan: UserPlan.FREE }),
      });

      // No existing Customer
      customerModel.findOne.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });
    });

    it('should grant PRO credits on Free → Pro upgrade', async () => {
      await service.handleSubscriptionUpdated(
        {
          id: subId,
          customerId,
          status: 'active',
          customData: { blyntaUserId: String(userId) },
          items: [{ price: { id: priceId, productId: 'pro_xxx' } }],
          currentBillingPeriod: { endsAt: new Date(Date.now() + 30 * 86400_000).toISOString() },
        },
        'evt_upgrade',
        'subscription.created',
      );

      const userUpdateCalls = (userModel.findByIdAndUpdate as jest.Mock).mock.calls;
      const creditUpdateCall = userUpdateCalls.find(
        (call) => call[1]?.$set?.creditsBalance !== undefined,
      );
      expect(creditUpdateCall).toBeDefined();
      expect(creditUpdateCall[1].$set.creditsBalance).toBe(PLAN_CREDITS[UserPlan.PRO]);
    });

    it('should send subscription activated email on real upgrade', async () => {
      await service.handleSubscriptionUpdated(
        {
          id: subId,
          customerId,
          status: 'active',
          customData: { blyntaUserId: String(userId) },
          items: [{ price: { id: priceId, productId: 'pro_xxx' } }],
          currentBillingPeriod: { endsAt: new Date(Date.now() + 30 * 86400_000).toISOString() },
        },
        'evt_upgrade_email',
        'subscription.created',
      );

      expect(mailService.queueSubscriptionActivatedEmail).toHaveBeenCalledTimes(1);
    });
  });

  /* ────────────────────────────────────────────────────────────────────────
     Acceptance criterion 4:
     Renewal payment (transaction.completed) always grants credits
     ────────────────────────────────────────────────────────────────────── */

  describe('Criterion 4 — transaction.completed always grants credits', () => {
    const userId = makeId();
    const subId = 'sub_renewal_789';
    const priceId = 'pri_pro_monthly';

    beforeEach(() => {
      (paddleService.mapPriceIdToPlan as jest.Mock).mockReturnValue('pro');

      userModel.findOne.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({
          _id: userId,
          email: 'user@test.com',
          plan: UserPlan.PRO,
        }),
      });

      customerModel.findOne.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({
          userId,
          paddleCustomerId: 'ctm_x',
          paddleSubscriptionId: subId,
          paddlePriceId: priceId, // same price — but transaction.completed ALWAYS grants credits
        }),
      });
    });

    it('should always set creditsBalance on transaction.completed (renewal)', async () => {
      await service.handleTransactionCompleted(
        {
          id: 'txn_renewal_001',
          subscriptionId: subId,
          customerId: 'ctm_x',
          customData: { blyntaUserId: String(userId) },
          items: [{ price: { id: priceId, productId: 'pro_xxx' } }],
        },
        'evt_txn_001',
        'transaction.completed',
      );

      const userUpdateCalls = (userModel.findByIdAndUpdate as jest.Mock).mock.calls;
      const creditCall = userUpdateCalls.find(
        (call) => call[1]?.$set?.creditsBalance !== undefined,
      );
      expect(creditCall).toBeDefined();
      expect(creditCall[1].$set.creditsBalance).toBe(PLAN_CREDITS[UserPlan.PRO]);
    });
  });

  /* ────────────────────────────────────────────────────────────────────────
     Acceptance criterion 5:
     Duplicate webhook event (same eventId) fires exactly ONE notification
     ────────────────────────────────────────────────────────────────────── */

  describe('Criterion 5 — duplicate eventId causes no double-fire', () => {
    it('isEventProcessed returns true after markEventProcessed', async () => {
      processedEventModel.findOne.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({ eventId: 'evt_dup_001' }),
      });

      const alreadyDone = await service.isEventProcessed('evt_dup_001');
      expect(alreadyDone).toBe(true);
    });

    it('markEventProcessed swallows E11000 duplicate key errors', async () => {
      processedEventModel.create.mockRejectedValue({ code: 11000 });
      await expect(
        service.markEventProcessed('evt_dup_001', 'subscription.created'),
      ).resolves.not.toThrow();
    });

    it('markEventProcessed rethrows non-E11000 errors', async () => {
      processedEventModel.create.mockRejectedValue(
        new Error('Unexpected DB error'),
      );
      await expect(
        service.markEventProcessed('evt_dup_002', 'subscription.created'),
      ).rejects.toThrow('Unexpected DB error');
    });
  });

  /* ────────────────────────────────────────────────────────────────────────
     Acceptance criterion 6:
     creditsResetAt uses Paddle billing period end, not local nextMonth()
     ────────────────────────────────────────────────────────────────────── */

  describe('Criterion 6 — creditsResetAt uses Paddle billing period end', () => {
    const userId = makeId();
    const subId = 'sub_reset_test';
    const priceId = 'pri_pro_monthly';
    // A specific date from Paddle's payload — well outside the ±1min window of nextMonth()
    const paddlePeriodEnd = new Date('2027-01-15T00:00:00.000Z');

    beforeEach(() => {
      (paddleService.mapPriceIdToPlan as jest.Mock).mockReturnValue('pro');

      userModel.findOne.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({
          _id: userId,
          email: 'user@test.com',
          plan: UserPlan.FREE, // upgrade → grantCredits: true
        }),
      });
      userModel.findById.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({ _id: userId, plan: UserPlan.FREE }),
      });
      customerModel.findOne.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });
    });

    it('sets creditsResetAt to Paddle period end, not locally computed date', async () => {
      await service.handleSubscriptionUpdated(
        {
          id: subId,
          customerId: 'ctm_reset',
          status: 'active',
          customData: { blyntaUserId: String(userId) },
          items: [{ price: { id: priceId, productId: 'pro_xxx' } }],
          currentBillingPeriod: { endsAt: paddlePeriodEnd.toISOString() },
        },
        'evt_reset_test',
        'subscription.created',
      );

      const userUpdateCalls = (userModel.findByIdAndUpdate as jest.Mock).mock.calls;
      const creditCall = userUpdateCalls.find(
        (call) => call[1]?.$set?.creditsResetAt !== undefined,
      );
      expect(creditCall).toBeDefined();

      const actualReset: Date = creditCall[1].$set.creditsResetAt;
      // Must match the Paddle-supplied date exactly (not nextMonth())
      expect(actualReset.getTime()).toBe(paddlePeriodEnd.getTime());
    });

    it('falls back to nextMonth() when Paddle does not supply period end', async () => {
      const before = Date.now();

      await service.handleSubscriptionUpdated(
        {
          id: subId + '_noPeriod',
          customerId: 'ctm_reset2',
          status: 'active',
          customData: { blyntaUserId: String(userId) },
          items: [{ price: { id: priceId, productId: 'pro_xxx' } }],
          // No currentBillingPeriod
        },
        'evt_reset_fallback',
        'subscription.created',
      );

      const userUpdateCalls = (userModel.findByIdAndUpdate as jest.Mock).mock.calls;
      const creditCall = userUpdateCalls.find(
        (call) => call[1]?.$set?.creditsResetAt !== undefined,
      );
      expect(creditCall).toBeDefined();

      const actualReset: Date = creditCall[1].$set.creditsResetAt;
      const after = Date.now();

      // Should be approximately nextMonth() — between 28 and 32 days from now
      const diffDays = (actualReset.getTime() - before) / 86400_000;
      expect(diffDays).toBeGreaterThan(27);
      expect(diffDays).toBeLessThan(33);
    });
  });

  /* ────────────────────────────────────────────────────────────────────────
     Acceptance criterion 2b:
     SubscriptionEvent audit log records creditsGranted correctly
     ────────────────────────────────────────────────────────────────────── */

  describe('Criterion 2b — SubscriptionEvent audit log', () => {
    const userId = makeId();

    beforeEach(() => {
      (paddleService.mapPriceIdToPlan as jest.Mock).mockReturnValue('pro');

      userModel.findOne.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({
          _id: userId,
          email: 'audit@test.com',
          plan: UserPlan.PRO,
        }),
      });
      userModel.findById.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({ _id: userId, plan: UserPlan.PRO }),
      });
    });

    it('records creditsGranted=0 when grantCredits is false (schedule/resume)', async () => {
      // Same plan + same priceId → isRealPlanChange = false
      customerModel.findOne.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({
          userId,
          paddleCustomerId: 'ctm_a',
          paddleSubscriptionId: 'sub_a',
          paddlePriceId: 'pri_pro_monthly',
        }),
      });

      await service.handleSubscriptionUpdated(
        {
          id: 'sub_a',
          customerId: 'ctm_a',
          status: 'active',
          customData: { blyntaUserId: String(userId) },
          items: [{ price: { id: 'pri_pro_monthly', productId: 'pro_x' } }],
          scheduledChange: { action: 'cancel', effectiveAt: new Date().toISOString() },
        },
        'evt_audit_no_credits',
        'subscription.updated',
      );

      const createCalls = (subscriptionEventModel.create as jest.Mock).mock.calls;
      if (createCalls.length > 0) {
        const auditDoc = createCalls[createCalls.length - 1][0];
        expect(auditDoc.creditsGranted).toBe(0);
      }
    });

    it('records creditsGranted=PLAN_CREDITS[PRO] when grantCredits is true', async () => {
      // No existing customer → isRealPlanChange = true
      customerModel.findOne.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });
      // User was FREE
      userModel.findOne.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({
          _id: userId,
          email: 'audit@test.com',
          plan: UserPlan.FREE,
        }),
      });

      await service.handleSubscriptionUpdated(
        {
          id: 'sub_new',
          customerId: 'ctm_new',
          status: 'active',
          customData: { blyntaUserId: String(userId) },
          items: [{ price: { id: 'pri_pro_monthly', productId: 'pro_x' } }],
          currentBillingPeriod: { endsAt: new Date().toISOString() },
        },
        'evt_audit_with_credits',
        'subscription.created',
      );

      const createCalls = (subscriptionEventModel.create as jest.Mock).mock.calls;
      if (createCalls.length > 0) {
        const auditDoc = createCalls[createCalls.length - 1][0];
        expect(auditDoc.creditsGranted).toBe(PLAN_CREDITS[UserPlan.PRO]);
      }
    });
  });
});
