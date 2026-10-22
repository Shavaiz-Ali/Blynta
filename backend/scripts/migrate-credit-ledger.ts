import { ConfigModule, ConfigService } from '@nestjs/config';
import { createConnection } from 'mongoose';
import { CreditsService } from '../src/billing/credits.service';
import {
  CreditEntrySchema,
  CreditOperationSchema,
  ProcessingUsageSchema,
} from '../src/billing/credit.schemas';
import { User, UserSchema } from '../src/users/schemas/user.schema';
import {
  Customer,
  CustomerSchema,
} from '../src/billing/schemas/customer.schema';
import {
  SubscriptionEvent,
  SubscriptionEventSchema,
} from '../src/billing/schemas/subscription-event.schema';

async function main() {
  await ConfigModule.forRoot();
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI is required');
  const connection = await createConnection(uri, {
    autoIndex: false,
    autoCreate: false,
  }).asPromise();
  try {
    const users = connection.model(User.name, UserSchema);
    const entries = connection.model('CreditEntry', CreditEntrySchema);
    const operations = connection.model(
      'CreditOperation',
      CreditOperationSchema,
    );
    const usage = connection.model('ProcessingUsage', ProcessingUsageSchema);
    const customers = connection.model(Customer.name, CustomerSchema);
    const subscriptionEvents = connection.model(
      SubscriptionEvent.name,
      SubscriptionEventSchema,
    );
    const historicalPayments = await subscriptionEvents.countDocuments({
      eventType: 'transaction.completed',
      creditsGranted: { $gt: 0 },
      'rawPayload.id': { $regex: '^txn_' },
    });
    const pending = await users.countDocuments({
      creditLedgerInitialized: { $ne: true },
    });
    const freeRenewalsToDisable = await users.countDocuments({
      freeCreditGrantAt: { $exists: true },
    });
    console.log(
      JSON.stringify({
        mode: process.argv.includes('--apply') ? 'apply' : 'dry-run',
        accountsWithoutOpening: pending,
        freeRenewalsToDisable,
        historicalPaymentAuditRows: historicalPayments,
      }),
    );
    if (!process.argv.includes('--apply')) return;
    const topology = await connection.db!.admin().command({ hello: 1 });
    if (!topology.setName && topology.msg !== 'isdbgrid')
      throw new Error(
        'Ledger migration requires a MongoDB replica set or sharded cluster',
      );
    await Promise.all([
      entries.createIndexes(),
      operations.createIndexes(),
      usage.createIndexes(),
    ]);
    // No balance/usage changes. The old monthly Free scheduler has been removed.
    await users.updateMany(
      { freeCreditGrantAt: { $exists: true } },
      { $unset: { freeCreditGrantAt: 1 } },
    );
    const service = new CreditsService(
      connection,
      users as any,
      entries,
      operations,
      usage,
      new ConfigService(),
      customers as any,
    );
    let migrated = 0;
    for await (const user of users
      .find({ creditLedgerInitialized: { $ne: true } })
      .select('_id')
      .cursor()) {
      await service.migrate(String(user._id));
      migrated++;
    }
    let paymentMarkers = 0;
    // Keep prior completed payment grants from being re-applied after processed-event TTL expiry.
    for await (const event of subscriptionEvents
      .find({
        eventType: 'transaction.completed',
        creditsGranted: { $gt: 0 },
        'rawPayload.id': { $regex: '^txn_' },
      })
      .sort({ _id: 1 })
      .cursor()) {
      if (!(await users.exists({ _id: event.userId }))) continue;
      const payload = event.rawPayload!;
      const paymentId = String(payload.id);
      const period = payload.billingPeriod || payload.billing_period;
      const endsAt = period?.endsAt || period?.ends_at;
      const cycleKey =
        endsAt && Number.isFinite(new Date(endsAt).getTime())
          ? `cycle:${event.paddleSubscriptionId}:${new Date(endsAt).toISOString()}`
          : undefined;
      await service.adoptLegacyPayment(
        String(event.userId),
        paymentId,
        event.creditsGranted!,
        cycleKey,
      );
      paymentMarkers++;
    }
    console.log(
      JSON.stringify({
        migrated,
        historicalPaymentsReviewed: paymentMarkers,
        policy: 'opening balances only; existing jobs retain legacy billing',
      }),
    );
  } finally {
    await connection.close();
  }
}
void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
