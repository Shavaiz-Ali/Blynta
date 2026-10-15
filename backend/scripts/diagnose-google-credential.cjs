// Read-only diagnostic: no Nest bootstrap, workers, provider requests or DB writes.
const { createHash, timingSafeEqual } = require('node:crypto');
function equalSecrets(a, b) {
  if (typeof a !== 'string' || !a || typeof b !== 'string' || !b) return null;
  const digest = (value) => createHash('sha256').update(value, 'utf8').digest();
  return timingSafeEqual(digest(a), digest(b));
}
async function inspectCredential(db, env, id, vault) {
  const { ObjectId } = require('mongodb');
  if (!/^[a-f\d]{24}$/i.test(id)) throw new Error('Invalid identifier');
  const credential = await db
    .collection('ai_provider_credentials')
    .findOne({ _id: new ObjectId(id) });
  if (!credential) return { found: false };
  const provider = await db
    .collection('ai_providers')
    .findOne({ _id: new ObjectId(credential.providerId) });
  const result = {
    found: true,
    providerFound: !!provider,
    adapter: provider?.adapter,
    credentialEnabled: credential.enabled === true,
    providerEnabled: provider?.enabled === true,
    scope:
      'This diagnostic process environment; not proof of an already-running worker environment.',
  };
  let secret;
  try {
    secret = vault.decrypt(
      credential,
      `${credential.providerId}:${String(credential._id)}`,
    );
  } catch {
    return { ...result, decrypts: false };
  }
  const source = env.LLM_API_KEY
    ? 'LLM_API_KEY'
    : env.GROQ_API_KEY
      ? 'GROQ_API_KEY'
      : 'none';
  const models = await db
    .collection('ai_models')
    .find(
      { providerId: credential.providerId, archived: { $ne: true } },
      { projection: { modelId: 1, credentialId: 1, enabled: 1, tasks: 1 } },
    )
    .toArray();
  return {
    ...result,
    decrypts: true,
    environmentCredentialSource: source,
    matchesEffectiveHighlightEnvironmentKey: equalSecrets(
      secret,
      env.LLM_API_KEY || env.GROQ_API_KEY,
    ),
    matchesLLMAPIKey: equalSecrets(secret, env.LLM_API_KEY),
    providerDefaultMatches:
      String(provider?.defaultCredentialId) === String(credential._id),
    models: models.map((model) => ({
      modelId: model.modelId,
      enabled: model.enabled === true,
      tasks: model.tasks,
      usesSelectedCredential:
        String(model.credentialId || provider?.defaultCredentialId) ===
        String(credential._id),
    })),
  };
}
async function main() {
  const path = require('node:path');
  require('dotenv').config({
    path: path.resolve(__dirname, '../.env'),
    quiet: true,
  });
  require('reflect-metadata');
  const { MongoClient } = require('mongodb');
  const { ConfigService } = require('@nestjs/config');
  const {
    CredentialVault,
  } = require('../dist/src/ai-registry/credential-vault.service.js');
  if (!process.env.MONGO_URI) throw new Error('Missing database configuration');
  const client = new MongoClient(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
    maxPoolSize: 1,
  });
  try {
    await client.connect();
    const result = await inspectCredential(
      client.db(),
      process.env,
      process.argv[2] || '',
      new CredentialVault(new ConfigService(process.env)),
    );
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await client.close();
  }
}
module.exports = { equalSecrets, inspectCredential };
if (require.main === module)
  main().catch(() => {
    // Errors can contain connection URIs or cryptographic internals. Never print them.
    console.error(
      'Diagnostic could not complete. Check the ID, local build, database access and encryption configuration. No credentials were changed.',
    );
    process.exitCode = 1;
  });
