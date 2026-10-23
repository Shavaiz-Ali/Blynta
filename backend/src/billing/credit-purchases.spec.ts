import { ConfigService } from '@nestjs/config';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';

function fixture(
  settings: Record<string, unknown> = {
    PADDLE_PRICE_ID_CREDITS_25: 'pri_pack',
  },
) {
  const user = {
    _id: '507f1f77bcf86cd799439011',
    email: 'buyer@example.invalid',
  };
  const query = (value: any): any => {
    const p: any = Promise.resolve(value);
    p.exec = () => p;
    p.lean = () => p;
    return p;
  };
  const users: any = { findById: jest.fn(() => query(user)) };
  const owner: any = { userId: user._id, paddleCustomerId: 'ctm_buyer' };
  const customers: any = {
    findOne: jest.fn(() => query(owner)),
    findOneAndUpdate: jest.fn((_filter, update) => {
      if (owner.checkoutLeaseUntil && owner.checkoutLeaseUntil > new Date())
        return query(null);
      Object.assign(owner, update.$set);
      return query({ ...owner });
    }),
    updateOne: jest.fn((filter, update) => {
      if (filter.checkoutLeaseToken !== owner.checkoutLeaseToken)
        return query({ matchedCount: 0 });
      Object.assign(owner, update.$set);
      Object.keys(update.$unset || {}).forEach((key) => delete owner[key]);
      return query({ matchedCount: 1 });
    }),
  };
  const paddle: any = {
    environment: 'sandbox',
    getPriceIdForPlan: (plan) => `pri_${plan}`,
    getWebhookSecret: () => 'secret',
    mapPriceIdToPlan: jest.fn(() => null),
    paddle: {
      prices: {
        get: jest.fn(async () => ({ status: 'active', billingCycle: null })),
      },
      transactions: {
        create: jest.fn(async () => ({
          id: 'txn_01234567890123456789012345',
          status: 'draft',
          customerId: 'ctm_buyer',
          checkout: { url: 'https://checkout.paddle.com/configured' },
        })),
        get: jest.fn(async (id) => ({
          id,
          status: 'draft',
          customerId: 'ctm_buyer',
          checkout: { url: 'https://checkout.paddle.com/configured' },
          details: { totals: { total: '1000' } },
        })),
        update: jest.fn(async () => ({})),
      },
      webhooks: { unmarshal: jest.fn() },
    },
  };
  const credits: any = {
    enabled: true,
    adjust: jest.fn(),
    reversePayment: jest.fn(),
    restorePaymentAdjustment: jest.fn(),
    entries: {
      findOne: jest.fn(async () => ({ amount: 25 })),
      exists: jest.fn(async () => true),
    },
  };
  const service = new BillingService(
    paddle,
    new ConfigService(settings),
    {} as any,
    {} as any,
    {} as any,
    users,
    customers,
    {} as any,
    {} as any,
    credits,
  );
  const transaction = {
    id: 'txn_pack',
    customerId: 'ctm_buyer',
    items: [{ price: { id: 'pri_pack' }, quantity: 1 }],
    customData: { blyntaUserId: user._id, purchaseKind: 'credit-pack' },
  };
  return { service, credits, paddle, user, transaction, owner, customers };
}

describe('Paddle credit purchases', () => {
  test('the read-only plan catalogue uses Paddle prices and backend allocations', async () => {
    const f = fixture({
      BILLING_PRO_CREDITS: 75,
      BILLING_BUSINESS_CREDITS: 250,
    });
    f.paddle.paddle.prices.get.mockImplementation(async (id: string) => ({
      status: 'active',
      billingCycle: { interval: 'month', frequency: 1 },
      unitPrice: {
        amount: id === 'pri_pro' ? '2200' : '5700',
        currencyCode: 'EUR',
      },
    }));
    const plans = await f.service.listPlans();
    expect(plans).toEqual([
      {
        id: 'free',
        credits: 30,
        enabled: true,
        price: { amount: '0', currencyCode: 'USD' },
      },
      {
        id: 'pro',
        credits: 75,
        enabled: true,
        price: { amount: '2200', currencyCode: 'EUR' },
      },
      {
        id: 'business',
        credits: 250,
        enabled: true,
        price: { amount: '5700', currencyCode: 'EUR' },
      },
    ]);
    expect(f.paddle.paddle.transactions.create).not.toHaveBeenCalled();
    expect(f.credits.adjust).not.toHaveBeenCalled();
  });
  test.each([
    { status: 'archived', billingCycle: { interval: 'month', frequency: 1 } },
    { status: 'active', billingCycle: null },
    { status: 'active', billingCycle: { interval: 'year', frequency: 1 } },
    { status: 'active', billingCycle: { interval: 'month', frequency: 2 } },
  ])(
    'unavailable or mismatched subscription prices are not advertised: %j',
    async (price) => {
      const f = fixture();
      f.paddle.paddle.prices.get.mockResolvedValue(price);
      const plans = await f.service.listPlans();
      expect(
        plans.slice(1).every((plan) => !plan.enabled && !('price' in plan)),
      ).toBe(true);
    },
  );
  test('a Paddle catalogue failure disables paid plans without inventing a price', async () => {
    const f = fixture();
    f.paddle.paddle.prices.get.mockRejectedValue(
      new Error('Paddle unavailable'),
    );
    const plans = await f.service.listPlans();
    expect(plans[0].enabled).toBe(true);
    expect(
      plans.slice(1).every((plan) => !plan.enabled && !('price' in plan)),
    ).toBe(true);
  });
  test('subscription checkout returns a transaction/environment and reuses it on retry', async () => {
    const f = fixture();
    jest
      .spyOn(f.service, 'getOrCreatePaddleCustomer')
      .mockResolvedValue('ctm_buyer');
    f.paddle.paddle.prices.get.mockResolvedValue({
      status: 'active',
      billingCycle: { interval: 'month', frequency: 1 },
    });
    const first = await f.service.createCheckoutSession(f.user as any, {
      plan: 'pro',
    });
    const second = await f.service.createCheckoutSession(f.user as any, {
      plan: 'pro',
    });
    expect(first).toMatchObject({
      transactionId: 'txn_01234567890123456789012345',
      environment: 'sandbox',
    });
    expect(second).toEqual(first);
    expect(f.paddle.paddle.transactions.create).toHaveBeenCalledTimes(1);
  });
  test('concurrent upgrade requests create at most one transaction', async () => {
    const f = fixture();
    jest
      .spyOn(f.service, 'getOrCreatePaddleCustomer')
      .mockResolvedValue('ctm_buyer');
    f.paddle.paddle.prices.get.mockResolvedValue({
      status: 'active',
      billingCycle: { interval: 'month', frequency: 1 },
    });
    const results = await Promise.allSettled([
      f.service.createCheckoutSession(f.user as any, { plan: 'pro' }),
      f.service.createCheckoutSession(f.user as any, { plan: 'pro' }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(f.paddle.paddle.transactions.create).toHaveBeenCalledTimes(1);
  });
  test('changing the unpaid plan cancels its prior transaction before creating another', async () => {
    const f = fixture();
    jest
      .spyOn(f.service, 'getOrCreatePaddleCustomer')
      .mockResolvedValue('ctm_buyer');
    f.owner.pendingCheckoutId = 'txn_previous';
    f.owner.pendingCheckoutKey = 'plan:pro';
    f.paddle.paddle.prices.get.mockResolvedValue({
      status: 'active',
      billingCycle: { interval: 'month', frequency: 1 },
    });
    await f.service.createCheckoutSession(f.user as any, { plan: 'business' });
    expect(f.paddle.paddle.transactions.update).toHaveBeenCalledWith(
      'txn_previous',
      { status: 'canceled' },
    );
    expect(
      f.paddle.paddle.transactions.update.mock.invocationCallOrder[0],
    ).toBeLessThan(
      f.paddle.paddle.transactions.create.mock.invocationCallOrder[0],
    );
    expect(f.owner.pendingCheckoutKey).toBe('plan:business');
  });
  test('a credit-pack checkout preserves the pending subscription and never grants on creation', async () => {
    const f = fixture();
    jest
      .spyOn(f.service, 'getOrCreatePaddleCustomer')
      .mockResolvedValue('ctm_buyer');
    f.owner.pendingCheckoutId = 'txn_subscription';
    f.owner.pendingCheckoutKey = 'plan:pro';
    await f.service.createCreditPackCheckout(f.user as any, '25');
    expect(f.owner.pendingCheckoutId).toBe('txn_subscription');
    expect(f.owner.pendingCreditCheckoutKey).toBe('pack:25');
    expect(f.credits.adjust).not.toHaveBeenCalled();
  });
  test('a paid account cannot create a second subscription and failures release the checkout lease', async () => {
    const f = fixture();
    jest
      .spyOn(f.service, 'getOrCreatePaddleCustomer')
      .mockResolvedValue('ctm_buyer');
    f.owner.paddleSubscriptionId = 'sub_existing';
    f.owner.paddleSubscriptionStatus = 'active';
    f.owner.pendingCheckoutId = 'txn_old_unpaid';
    f.owner.pendingCheckoutKey = 'plan:business';
    f.paddle.paddle.prices.get.mockResolvedValue({
      status: 'active',
      billingCycle: { interval: 'month', frequency: 1 },
    });
    await expect(
      f.service.createCheckoutSession(f.user as any, { plan: 'business' }),
    ).rejects.toThrow('existing subscription');
    expect(f.paddle.paddle.transactions.create).not.toHaveBeenCalled();
    expect(f.owner.checkoutLeaseToken).toBeUndefined();
  });
  test('a canceled subscription can subscribe again without reopening its completed payment', async () => {
    const f = fixture();
    jest
      .spyOn(f.service, 'getOrCreatePaddleCustomer')
      .mockResolvedValue('ctm_buyer');
    f.owner.paddleSubscriptionId = 'sub_canceled';
    f.owner.paddleSubscriptionStatus = 'canceled';
    f.owner.pendingCheckoutId = 'txn_old_completed';
    f.owner.pendingCheckoutKey = 'plan:pro';
    f.paddle.paddle.transactions.get.mockResolvedValue({
      id: 'txn_old_completed',
      status: 'completed',
      customerId: 'ctm_buyer',
    });
    f.paddle.paddle.prices.get.mockResolvedValue({
      status: 'active',
      billingCycle: { interval: 'month', frequency: 1 },
    });
    const result = await f.service.createCheckoutSession(f.user as any, {
      plan: 'pro',
    });
    expect(result.transactionId).not.toBe('txn_old_completed');
    expect(f.paddle.paddle.transactions.create).toHaveBeenCalledTimes(1);
  });
  test('checkout status is owned and only reports success after the ledger grant', async () => {
    const f = fixture();
    f.paddle.paddle.transactions.get.mockResolvedValue({
      status: 'completed',
      customerId: 'ctm_buyer',
    });
    f.credits.entries.exists.mockResolvedValue(false);
    expect(
      (await f.service.checkoutStatus(f.user._id, 'txn_test')).verified,
    ).toBe(false);
    f.credits.entries.exists.mockResolvedValue(true);
    expect(
      (await f.service.checkoutStatus(f.user._id, 'txn_test')).verified,
    ).toBe(true);
    f.paddle.paddle.transactions.get.mockResolvedValue({
      status: 'completed',
      customerId: 'ctm_another',
    });
    await expect(
      f.service.checkoutStatus(f.user._id, 'txn_test'),
    ).rejects.toThrow('not found');
  });
  test('an adjustment arriving before its grant retries without replaying or fabricating credits', async () => {
    const f = fixture();
    f.credits.entries.findOne.mockResolvedValue(null);
    f.paddle.paddle.transactions.get.mockResolvedValue({
      items: [{ price: { id: 'pri_pack' } }],
    });
    await expect(
      f.service.handlePaymentAdjustment({
        id: 'adj_early',
        transactionId: 'txn_pack',
        status: 'approved',
        type: 'full',
        action: 'refund',
      }),
    ).rejects.toThrow('await the completed payment webhook');
    expect(f.credits.adjust).not.toHaveBeenCalled();
    expect(f.credits.reversePayment).not.toHaveBeenCalled();
  });
  test('checkout uses the configured server price and a linked customer', async () => {
    const f = fixture();
    jest
      .spyOn(f.service, 'getOrCreatePaddleCustomer')
      .mockResolvedValue('ctm_buyer');
    expect(
      await f.service.createCreditPackCheckout(f.user as any, '25'),
    ).toHaveProperty('checkoutUrl');
    expect(f.paddle.paddle.transactions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 'ctm_buyer',
        items: [{ priceId: 'pri_pack', quantity: 1 }],
      }),
    );
    expect(f.credits.adjust).not.toHaveBeenCalled();
  });
  test('missing product configuration cannot create checkout or grant credits', async () => {
    const f = fixture({});
    await expect(
      f.service.createCreditPackCheckout(f.user as any, '25'),
    ).rejects.toThrow('PADDLE_PRICE_ID_CREDITS_25');
    expect(f.paddle.paddle.transactions.create).not.toHaveBeenCalled();
  });
  test('a recurring price cannot masquerade as a credit pack', async () => {
    const f = fixture();
    f.paddle.paddle.prices.get.mockResolvedValue({
      status: 'active',
      billingCycle: { interval: 'month' },
    });
    await expect(
      f.service.createCreditPackCheckout(f.user as any, '25'),
    ).rejects.toThrow('one-time');
  });
  test('only completed payment grants a price-mapped pack to the payment customer', async () => {
    const f = fixture();
    await f.service.handleTransactionCompleted(
      f.transaction,
      'evt_paid',
      'transaction.paid',
    );
    expect(f.credits.adjust).not.toHaveBeenCalled();
    await f.service.handleTransactionCompleted(
      f.transaction,
      'evt_completed',
      'transaction.completed',
    );
    expect(f.credits.adjust).toHaveBeenCalledWith(
      f.user._id,
      25,
      'payment:txn_pack',
      expect.any(String),
      'grant',
      expect.objectContaining({ source: 'credit-pack', paymentId: 'txn_pack' }),
    );
  });
  test('unknown pack prices and forged ownership fail closed', async () => {
    const f = fixture();
    await expect(
      f.service.handleTransactionCompleted(
        {
          ...f.transaction,
          items: [{ price: { id: 'pri_unknown' }, quantity: 1 }],
        },
        'evt',
        'transaction.completed',
      ),
    ).rejects.toThrow('not configured');
    f.transaction.customData.blyntaUserId = 'different-owner';
    await expect(
      f.service.handleTransactionCompleted(
        f.transaction,
        'evt',
        'transaction.completed',
      ),
    ).rejects.toThrow('owner mismatch');
    expect(f.credits.adjust).not.toHaveBeenCalled();
  });
  test('a refund needs approval and verified Paddle totals for partial reversal', async () => {
    const f = fixture();
    const adjustment = {
      id: 'adj_refund',
      transactionId: 'txn_pack',
      status: 'pending_approval',
      type: 'partial',
      action: 'refund',
      totals: { total: '400' },
    };
    await f.service.handlePaymentAdjustment(adjustment);
    expect(f.credits.reversePayment).not.toHaveBeenCalled();
    await f.service.handlePaymentAdjustment({
      ...adjustment,
      status: 'approved',
    });
    expect(f.paddle.paddle.transactions.get).toHaveBeenCalledWith('txn_pack');
    expect(f.credits.reversePayment).toHaveBeenCalledWith(
      'txn_pack',
      'adj_refund',
      0.4,
      'refund',
    );
  });
  test('chargeback reversals refer to the original adjustment', async () => {
    const f = fixture();
    await f.service.handlePaymentAdjustment({
      status: 'approved',
      action: 'chargeback_reverse',
      originalAdjustmentId: 'adj_original',
      id: 'adj_reverse',
    });
    expect(f.credits.restorePaymentAdjustment).toHaveBeenCalledWith(
      'adj_original',
      'adj_reverse',
    );
  });
  test('custom data cannot turn an unknown price into a subscription grant', async () => {
    const f = fixture();
    const apply = jest
      .spyOn(f.service, 'applyPaddleSubscription')
      .mockResolvedValue();
    await f.service.handleTransactionCompleted(
      {
        id: 'txn_unknown',
        customData: { requestedPlan: 'business', blyntaUserId: f.user._id },
        items: [{ price: { id: 'pri_unknown' } }],
      },
      'evt',
      'transaction.completed',
    );
    expect(apply).not.toHaveBeenCalled();
  });
  test('webhooks reject reconstructed JSON or invalid signatures without touching credits', async () => {
    const f = fixture();
    const controller = new BillingController(f.service, {} as any, f.paddle);
    const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await controller.paddleWebhook(
      { body: { event_type: 'transaction.completed' }, headers: {} } as any,
      'signature',
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(f.paddle.paddle.webhooks.unmarshal).not.toHaveBeenCalled();
    f.paddle.paddle.webhooks.unmarshal.mockRejectedValue(
      new Error('Invalid signature'),
    );
    await controller.paddleWebhook(
      { body: Buffer.from('{"signed":true}'), headers: {} } as any,
      'signature',
      res,
    );
    expect(f.paddle.paddle.webhooks.unmarshal).toHaveBeenCalledWith(
      '{"signed":true}',
      'secret',
      'signature',
    );
    expect(f.credits.adjust).not.toHaveBeenCalled();
  });
});
