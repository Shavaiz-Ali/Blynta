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
    const pending = await users.countDocuments({
      creditLedgerInitialized: { $ne: true },
    });
    console.log(
      JSON.stringify({
        mode: process.argv.includes('--apply') ? 'apply' : 'dry-run',
        accountsWithoutOpening: pending,
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
    console.log(
      JSON.stringify({
        migrated,
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
