import 'reflect-metadata';
import { config } from 'dotenv';
import mongoose from 'mongoose';
import { ProviderSchema } from '../src/ai-registry/registry.schemas';
import {
  ADAPTER_POLICY,
  providerEndpoint,
} from '../src/ai-registry/provider-policy';
/** Dry run by default. Explicit --apply adds only missing Google endpoint fields. */
async function main() {
  config({ quiet: true });
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required');
  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
    autoIndex: false,
    autoCreate: false,
  });
  try {
    const providers = mongoose.model('AIProvider', ProviderSchema);
    let eligible = 0,
      changed = 0;
    for await (const provider of providers
      .find({ adapter: 'google' })
      .lean()
      .cursor()) {
      // Validate explicit endpoints before any write; never overwrite an operator value.
      providerEndpoint(provider);
      const fields = {
        baseUrl: ADAPTER_POLICY.google.baseUrl,
        apiVersion: ADAPTER_POLICY.google.apiVersion,
        revision: 1,
      };
      for (const [key, value] of Object.entries(fields)) {
        if (provider[key] !== undefined) continue;
        eligible++;
        if (process.argv.includes('--apply')) {
          const result = await providers.updateOne(
            { _id: provider._id, [key]: { $exists: false } },
            { $set: { [key]: value } },
          );
          changed += result.modifiedCount;
        }
      }
    }
    console.log(
      JSON.stringify({
        dryRun: !process.argv.includes('--apply'),
        eligibleFields: eligible,
        changedFields: changed,
      }),
    );
  } finally {
    await mongoose.disconnect();
  }
}
main().catch(() => {
  console.error(
    'Provider backfill failed. No secrets or connection details are logged.',
  );
  process.exitCode = 1;
});
