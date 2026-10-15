// Real SDK serialization with a synthetic transport. Never calls an upstream service.
require('reflect-metadata');
const assert = require('node:assert/strict');
const {
  GoogleAdapter,
} = require('../dist/src/ai-registry/google-adapter.service.js');
async function main() {
  const requests = [];
  let upstreamFailure;
  let successBody;
  const transport = {
    fetch: async (_provider, request) => {
      requests.push({
        url: request.url,
        key: request.headers.get('x-goog-api-key'),
        body: request.body ? await request.json() : undefined,
      });
      if (upstreamFailure)
        return new Response(JSON.stringify({ error: upstreamFailure }), {
          status: upstreamFailure.code,
          headers: { 'content-type': 'application/json' },
        });
      return new Response(
        JSON.stringify(
          successBody ?? {
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
          },
        ),
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
  const validation = await adapter.validateCredential(
    provider,
    'synthetic-secret',
    AbortSignal.timeout(1000),
    model,
  );
  assert.equal(validation.valid, true);
  assert.equal(requests[1].url, requests[0].url);
  assert.equal(requests[1].key, requests[0].key);
  assert.equal(requests[1].body.generationConfig.maxOutputTokens, 128);
  const chat = adapter.create(model, 'synthetic-secret', provider);
  assert.equal(
    await chat.buildUrlGemini(),
    'https://generativelanguage.googleapis.com/v1/models/gemini-synthetic:generateContent',
  );
  await chat.apiClient.fetch(
    new Request(await chat.buildUrlGemini(), { method: 'POST', body: '{}' }),
  );
  assert.equal(requests[2].key, 'synthetic-secret');
  successBody = {
    candidates: [{ finishReason: 'MAX_TOKENS' }],
    usageMetadata: {
      promptTokenCount: 4,
      thoughtsTokenCount: 124,
      totalTokenCount: 128,
    },
  };
  assert.equal(
    (
      await adapter.validateCredential(
        provider,
        'synthetic-secret',
        AbortSignal.timeout(1000),
        model,
      )
    ).valid,
    true,
  );
  for (const payload of [{ models: [] }, {}, { candidates: [] }]) {
    successBody = payload;
    const empty = await adapter.validateCredential(
      provider,
      'synthetic-secret',
      AbortSignal.timeout(1000),
      model,
    );
    assert.equal(empty.valid, false);
    assert.notEqual(empty.code, 'AI_AUTH_OR_ACCESS_FAILED');
    assert.notEqual(empty.code, 'AI_NETWORK_FAILED');
  }
  for (const [status, reason, expectedCode] of [
    [400, 'API_KEY_INVALID', 'AI_AUTH_OR_ACCESS_FAILED'],
    [400, undefined, 'AI_REQUEST_FAILED'],
    [403, 'IAM_PERMISSION_DENIED', 'AI_AUTH_OR_ACCESS_FAILED'],
    [404, undefined, 'AI_MODEL_UNAVAILABLE'],
    [429, undefined, 'AI_QUOTA_OR_RATE_LIMIT'],
    [503, undefined, 'AI_PROVIDER_FAILED'],
  ]) {
    upstreamFailure = {
      code: status,
      message: 'Synthetic failure containing synthetic-secret',
      status:
        status === 400
          ? 'INVALID_ARGUMENT'
          : status === 403
            ? 'PERMISSION_DENIED'
            : status === 404
              ? 'NOT_FOUND'
              : status === 429
                ? 'RESOURCE_EXHAUSTED'
                : 'UNAVAILABLE',
      details: reason
        ? [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason }]
        : [],
    };
    const result = await adapter.validateCredential(
      provider,
      'synthetic-secret',
      AbortSignal.timeout(1000),
      model,
    );
    assert.equal(result.valid, false);
    assert.equal(result.code, expectedCode);
    assert.equal(result.upstreamStatus, status);
    assert.equal(result.upstreamReason, reason);
    assert.equal(JSON.stringify(result).includes('synthetic-secret'), false);
  }
  console.log(
    'Google SDK, credential generation probe and LangChain use the same configured model endpoint/authentication with synthetic transport',
  );
}
main().catch((error) => {
  console.error(error instanceof Error ? error.name : 'Adapter test failed');
  process.exitCode = 1;
});
