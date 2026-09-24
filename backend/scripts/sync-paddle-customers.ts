import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { Paddle, Environment } from '@paddle/paddle-node-sdk';
import { UserSchema } from '../src/users/schemas/user.schema';

dotenv.config();

interface SyncSummary {
  totalPaddleCustomers: number;
  activePaddleCustomers: number;
  archivedPaddleCustomers: number;
  usersUpdated: number;
  usersAlreadySynced: number;
  idMismatchesUpdated: number;
  unmatchedPaddleCustomers: number;
  errors: number;
}

async function syncPaddleCustomers() {
  console.log('='.repeat(60));
  console.log('🔄 STARTING PADDLE CUSTOMER RECONCILIATION SCRIPT');
  console.log('='.repeat(60));

  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error('MONGO_URI is not defined in .env');
  }

  const apiKey = process.env.PADDLE_API_KEY;
  if (!apiKey) {
    throw new Error('PADDLE_API_KEY is not defined in .env');
  }

  const env = process.env.PADDLE_ENV || 'sandbox';
  const paddleEnvironment =
    env.toLowerCase() === 'production'
      ? Environment.production
      : Environment.sandbox;

  console.log(`📡 Connecting to MongoDB...`);
  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB.');

  console.log(`💳 Initializing Paddle SDK (${env} environment)...`);
  const paddle = new Paddle(apiKey, {
    environment: paddleEnvironment,
  });

  const UserModel = mongoose.model('User', UserSchema);

  const summary: SyncSummary = {
    totalPaddleCustomers: 0,
    activePaddleCustomers: 0,
    archivedPaddleCustomers: 0,
    usersUpdated: 0,
    usersAlreadySynced: 0,
    idMismatchesUpdated: 0,
    unmatchedPaddleCustomers: 0,
    errors: 0,
  };

  console.log(
    `\n🔍 Fetching Paddle customers with status: ['active', 'archived']...\n`,
  );

  try {
    const customerCollection = paddle.customers.list({
      status: ['active', 'archived'],
    });

    for await (const customer of customerCollection) {
      summary.totalPaddleCustomers++;
      if (customer.status === 'archived') {
        summary.archivedPaddleCustomers++;
      } else {
        summary.activePaddleCustomers++;
      }

      const email = customer.email?.toLowerCase().trim();
      const customerId = customer.id;
      const status = customer.status;

      if (!email) {
        console.warn(
          `⚠️ [NO EMAIL] Customer ${customerId} has no email address. Skipping.`,
        );
        summary.unmatchedPaddleCustomers++;
        continue;
      }

      try {
        const user = await UserModel.findOne({ email });

        if (user) {
          if (!user.paddleCustomerId) {
            user.paddleCustomerId = customerId;
            await user.save();
            summary.usersUpdated++;
            console.log(
              `✨ [UPDATED] User ${email} (DB ID: ${user._id}) -> Set paddleCustomerId = ${customerId} (Paddle status: ${status})`,
            );
          } else if (user.paddleCustomerId === customerId) {
            summary.usersAlreadySynced++;
            console.log(
              `✓ [SYNCED] User ${email} (DB ID: ${user._id}) already synced with ${customerId}`,
            );
          } else {
            // DB had a different paddleCustomerId; update to latest found
            const oldId = user.paddleCustomerId;
            user.paddleCustomerId = customerId;
            await user.save();
            summary.idMismatchesUpdated++;
            console.log(
              `🔄 [REPLACED] User ${email} had ID ${oldId}, updated to current Paddle ID ${customerId}`,
            );
          }
        } else {
          summary.unmatchedPaddleCustomers++;
          console.log(
            `ℹ️ [NO DB MATCH] Paddle customer ${customerId} (${email}, status: ${status}) does not exist in DB.`,
          );
        }
      } catch (err: any) {
        summary.errors++;
        console.error(
          `❌ [ERROR] Processing Paddle customer ${customerId} (${email}):`,
          err?.message,
        );
      }
    }
  } catch (err: any) {
    console.error('❌ Fatal error iterating Paddle customers:', err?.message);
    throw err;
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 RECONCILIATION SUMMARY');
  console.log('='.repeat(60));
  console.log(
    `Total Paddle customers processed:     ${summary.totalPaddleCustomers}`,
  );
  console.log(
    `  - Active customers:                 ${summary.activePaddleCustomers}`,
  );
  console.log(
    `  - Archived customers:               ${summary.archivedPaddleCustomers}`,
  );
  console.log(
    `Users updated with paddleCustomerId:  ${summary.usersUpdated}`,
  );
  console.log(
    `Users already synced:                 ${summary.usersAlreadySynced}`,
  );
  if (summary.idMismatchesUpdated > 0) {
    console.log(
      `User ID mismatches re-assigned:      ${summary.idMismatchesUpdated}`,
    );
  }
  console.log(
    `Paddle customers without DB user:     ${summary.unmatchedPaddleCustomers}`,
  );
  if (summary.errors > 0) {
    console.log(
      `Errors encountered:                   ${summary.errors}`,
    );
  }
  console.log('='.repeat(60));

  await mongoose.disconnect();
  console.log('🔌 Disconnected from MongoDB. Done!\n');
}

syncPaddleCustomers()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('💥 Sync script execution failed:', err);
    process.exit(1);
  });
