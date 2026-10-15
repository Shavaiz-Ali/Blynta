const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  equalSecrets,
  inspectCredential,
} = require('./diagnose-google-credential.cjs');
test('compares exact credential bytes without normalization or fingerprints in output', () => {
  assert.equal(equalSecrets('synthetic-key', 'synthetic-key'), true);
  assert.equal(equalSecrets('synthetic-key', 'synthetic-key '), false);
  assert.equal(equalSecrets('synthetic-key', 'different-key'), false);
  assert.equal(equalSecrets('synthetic-key', undefined), null);
});
test('diagnostic performs reads only and never exposes credential-bearing records', async () => {
  const id = '111111111111111111111111',
    providerId = '222222222222222222222222';
  const { ObjectId } = require('mongodb');
  const db = {
    collection: (name) => ({
      findOne: async () =>
        name === 'ai_provider_credentials'
          ? {
              _id: new ObjectId(id),
              providerId,
              ciphertext: 'private-ciphertext',
              enabled: true,
            }
          : { defaultCredentialId: id, adapter: 'google', enabled: true },
      find: () => ({
        toArray: async () => [{ modelId: 'configured-model', enabled: true }],
      }),
    }),
  };
  const vault = {
    decrypt: (_record, identity) => {
      assert.equal(identity, providerId + ':' + id);
      return 'synthetic-key';
    },
  };
  const result = await inspectCredential(
    db,
    { LLM_API_KEY: 'synthetic-key', GROQ_API_KEY: 'different-key' },
    id,
    vault,
  );
  assert.equal(result.matchesEffectiveHighlightEnvironmentKey, true);
  assert.equal(result.models[0].usesSelectedCredential, true);
  for (const sensitive of [
    'synthetic-key',
    'different-key',
    'private-ciphertext',
    'ciphertext',
  ])
    assert.equal(JSON.stringify(result).includes(sensitive), false);
  const failed = await inspectCredential(db, {}, id, {
    decrypt: () => {
      throw new Error('private crypto detail');
    },
  });
  assert.equal(failed.decrypts, false);
  assert.equal(JSON.stringify(failed).includes('private crypto detail'), false);
});
