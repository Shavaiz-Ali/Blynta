// Real SDK serialization with a synthetic transport. Never calls an upstream service.
require('reflect-metadata');
const assert = require('node:assert/strict');
const {
  GoogleAdapter,
} = require('../dist/src/ai-registry/google-adapter.service.js');
async function main() {
  const requests = [];
  const transport = {
    fetch: async (_provider, request) => {
      requests.push({
        url: request.url,
        key: request.headers.get('x-goog-api-key'),
        body: request.body ? await request.json() : undefined,
      });
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: { role: 'model', parts: [{ text: '{"ok":true}' }] },
              finishReason: 'STOP',
            },
          ],
          usageMetadata: {
            promptTokenCount: 4,
            candidatesTokenCount: 2,
            totalTokenCount: 6,
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    },
  };
  const adapter = new GoogleAdapter(transport);
  const provider = {
    adapter: 'google',
    baseUrl: 'https://generativelanguage.googleapis.com',
    apiVersion: 'v1',
    enabled: true,
  };
  const model = {
    modelId: 'gemini-synthetic',
    settings: { maxRetries: 0, maxOutputTokens: 128 },
  };
  const languageModel = await adapter.languageModel(
    model,
    provider,
    'synthetic-secret',
  );
  await languageModel.doGenerate({
    prompt: [
      { role: 'user', content: [{ type: 'text', text: 'Return ok true' }] },
    ],
    maxOutputTokens: 128,
  });
  assert.match(
    requests[0].url,
    /^https:\/\/generativelanguage\.googleapis\.com\/v1\/models\/gemini-synthetic:generateContent$/,
  );
  assert.equal(requests[0].key, 'synthetic-secret');
  const chat = adapter.create(model, 'synthetic-secret', provider);
  assert.equal(
    await chat.buildUrlGemini(),
    'https://generativelanguage.googleapis.com/v1/models/gemini-synthetic:generateContent',
  );
  await chat.apiClient.fetch(
    new Request(await chat.buildUrlGemini(), { method: 'POST', body: '{}' }),
  );
  assert.equal(requests[1].key, 'synthetic-secret');
  console.log(
    'Real Google SDK and LangChain configured endpoint/authentication checks passed with synthetic transport',
  );
}
main().catch((error) => {
  console.error(error instanceof Error ? error.name : 'Adapter test failed');
  process.exitCode = 1;
});
