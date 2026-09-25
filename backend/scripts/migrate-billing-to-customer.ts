/**
 * migrate-billing-to-customer.ts
 *
 * One-time migration: copies paddle* fields from User documents into the new
 * Customer collection, without deleting the old User fields yet (safer — do
 * a follow-up cleanup migration after verifying the new path works in prod).
 *
 * Run with:
 *   npx ts-node -r tsconfig-paths/register scripts/migrate-billing-to-customer.ts
 */

import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { UserSchema } from '../src/users/schemas/user.schema';
import { CustomerSchema } from '../src/billing/schemas/customer.schema';

dotenv.config();

interface MigrationSummary {
  totalUsers: number;
  migrated: number;
  alreadyExisted: number;
  skippedNoPaddleId: number;
  errors: number;
}

async function migrate() {
  console.log('='.repeat(60));
  console.log('🔄  BILLING → CUSTOMER MIGRATION');
  console.log('='.repeat(60));

  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) throw new Error('MONGO_URI is not set in .env');

  console.log('📡  Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('✅  Connected.\n');

  // We need to read the OLD paddle* fields that were removed from the TypeScript
  // User class but still exist in the database documents. Cast to `any` so TS
  // doesn't reject field names that are no longer declared on the User class.
  const LegacyUserSchema = UserSchema.clone() as any;
  LegacyUserSchema.add({
    paddleCustomerId: { type: String, default: null },
    paddleSubscriptionId: { type: String },
    paddleProductId: { type: String },
    paddlePriceId: { type: String },
    paddleSubscriptionStatus: { type: String },
    paddleScheduledChangeAction: { type: String },
    paddleScheduledChangeAt: { type: Date },
  });

  // Use getModelForClass-style registration that avoids duplicate model errors
  const UserModel: any = mongoose.models['User']
    ? mongoose.model('User')
    : mongoose.model('User', LegacyUserSchema);


  const CustomerModel = mongoose.models['Customer']
    ? (mongoose.model('Customer') as any)
    : mongoose.model('Customer', CustomerSchema);

  const summary: MigrationSummary = {
    totalUsers: 0,
    migrated: 0,
    alreadyExisted: 0,
    skippedNoPaddleId: 0,
    errors: 0,
  };

  // Stream all users to avoid loading everything into memory
  const cursor = UserModel.find({}).cursor();

  for await (const user of cursor) {
    summary.totalUsers++;
    const paddleCustomerId: string | null | undefined = (user as any)
      .paddleCustomerId;

    if (!paddleCustomerId) {
      summary.skippedNoPaddleId++;
      continue;
    }

    try {
      const existing = await CustomerModel.findOne({ userId: user._id });
      if (existing) {
        summary.alreadyExisted++;
        console.log(
          `  ✓  [SKIP]     User ${user.email} already has a Customer document.`,
        );
        continue;
      }

      await CustomerModel.create({
        userId: user._id,
        paddleCustomerId,
        paddleSubscriptionId: (user as any).paddleSubscriptionId || undefined,
        paddleProductId: (user as any).paddleProductId || undefined,
        paddlePriceId: (user as any).paddlePriceId || undefined,
        paddleSubscriptionStatus:
          (user as any).paddleSubscriptionStatus || undefined,
        paddleScheduledChangeAction:
          (user as any).paddleScheduledChangeAction ?? null,
        paddleScheduledChangeAt:
          (user as any).paddleScheduledChangeAt ?? null,
      });

      summary.migrated++;
      console.log(
        `  ✨  [MIGRATED] User ${user.email} (${user._id}) → paddleCustomerId=${paddleCustomerId}`,
      );
    } catch (err: any) {
      summary.errors++;
      console.error(
        `  ❌  [ERROR]    User ${user.email} (${user._id}): ${err?.message}`,
      );
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊  MIGRATION SUMMARY');
  console.log('='.repeat(60));
  console.log(`  Total users processed:         ${summary.totalUsers}`);
  console.log(`  Migrated to Customer:          ${summary.migrated}`);
  console.log(`  Already had Customer doc:      ${summary.alreadyExisted}`);
  console.log(`  Skipped (no paddleCustomerId): ${summary.skippedNoPaddleId}`);
  if (summary.errors > 0) {
    console.log(`  Errors:                        ${summary.errors}`);
  }
  console.log('='.repeat(60));
  console.log(
    '\n⚠️   NOTE: Old paddle* fields on User are KEPT intentionally.',
  );
  console.log(
    '    After verifying the new path works in production, run a',
  );
  console.log('    follow-up migration to unset them via $unset.\n');

  await mongoose.disconnect();
  console.log('🔌  Disconnected. Done!\n');
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('💥  Migration failed:', err);
    process.exit(1);
  });
