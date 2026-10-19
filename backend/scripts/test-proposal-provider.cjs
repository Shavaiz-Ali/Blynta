// Controlled graph + real LangChain/Google adapter test. Synthetic HTTP only.
require('reflect-metadata');
const assert = require('node:assert/strict');
const {
  GoogleAdapter,
} = require('../dist/src/ai-registry/google-adapter.service');
const {
  ProviderAdapterRegistry,
} = require('../dist/src/ai-registry/provider-adapter.registry');
const {
  EditingGraph,
} = require('../dist/src/ai-editor/agent/editing-graph.service');
const { examplePlan } = require('../dist/src/ai-editor/edit-plan.fixture');
const {
  AllExceptionsFilter,
} = require('../dist/src/common/filters/all-exceptions.filter');
const id = '111111111111111111111111';
const secret = 'synthetic-key-not-for-logging';
const intent = {
  phrases: [],
  clarification: '',
  unsupported: '',
  assets: [{ kind: 'emoji', query: '😀' }],
};
const patch = {
  baseRevision: 1,
  changes: [
    {
      action: 'add',
      operation: {
        id: 'emoji',
        type: 'emoji_overlay',
        start: 0,
        end: 3,
        params: {
          assetId: 'synthetic-png',
          emoji: '😀',
          x: 0.5,
          y: 0.5,
          width: 0.15,
        },
      },
    },
  ],
};
const answer = {
  outcome: 'proposal',
  summary: 'Center the emoji',
  patchJson: JSON.stringify(patch),
  unavailableCapabilities: [],
};
async function run(secondResponse, failUsage = false) {
  const requests = [],
    diagnostics = [];
  const provider = {
    adapter: 'google',
    baseUrl: 'https://generativelanguage.googleapis.com',
    apiVersion: 'v1beta',
  };
  const model = {
    _id: id,
    providerId: id,
    modelId: 'gemini-synthetic',
    settings: { maxOutputTokens: 4096, timeoutMs: 2000, maxRetries: 0 },
  };
  const transport = {
    fetch: async (_provider, request) => {
      const body = await request.json();
      requests.push({
        body,
        url: request.url,
        key: request.headers.get('x-goog-api-key'),
      });
      if (requests.length >= 2 && secondResponse) {
        const overridden = secondResponse(requests.length);
        if (overridden) return overridden;
      }
      const args = requests.length === 1 ? intent : answer;
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                role: 'model',
                parts: [{ functionCall: { name: 'extract', args } }],
              },
              finishReason: 'STOP',
            },
          ],
          usageMetadata: {
            promptTokenCount: 30,
            candidatesTokenCount: 50,
            totalTokenCount: 80,
          },
        }),
        { headers: { 'content-type': 'application/json' } },
      );
    },
  };
  let usageCalls = 0;
  const registry = {
    resolveUserModel: async () => ({ model, provider, secret }),
    recordUsage: async () => {
      if (++usageCalls === 2 && failUsage)
        throw new Error('Synthetic persistence failure');
    },
  };
  const tools = {
    scoped: () => ({
      context: { invoke: async () => ({ revision: 1, outputDuration: 3 }) },
      plan: { invoke: async () => examplePlan() },
      assets: { invoke: async () => [] },
      resolveAsset: async () => ({ assetId: 'synthetic-png' }),
      validate: { invoke: async () => ({ valid: true }) },
    }),
  };
  const graph = new EditingGraph(
    tools,
    registry,
    new ProviderAdapterRegistry(new GoogleAdapter(transport)),
  );
  try {
    const result = await graph.run({
      userId: id,
      clipId: id,
      planId: id,
      prompt: 'Center an emoji for the whole clip',
      history: [],
      executionId: 'synthetic-execution',
      signal: AbortSignal.timeout(10000),
      onTool: async () => {},
      onDiagnostic: async (event) => diagnostics.push(event),
    });
    return { result, requests, diagnostics };
  } catch (error) {
    return { error, requests, diagnostics };
  }
}
async function main() {
  require('@nestjs/common').Logger.overrideLogger(false);
  const success = await run();
  assert.equal(success.error, undefined);
  assert.equal(success.result.status, 'pending');
  assert.equal(success.requests.length, 2);
  assert.equal(success.requests[0].url, success.requests[1].url);
  assert.equal(success.requests[0].key, success.requests[1].key);
  assert.deepEqual(
    success.requests[0].body.generationConfig,
    success.requests[1].body.generationConfig,
  );
  assert.equal(
    success.requests[1].body.tools[0].functionDeclarations[0].parameters
      .properties.patchJson.type,
    'string',
  );
  assert.equal(success.result.patch.changes[0].operation.params.x, 0.5);
  assert.equal(
    success.diagnostics.find((d) => d.event === 'asset_resolution')
      .resolvedAssetCount,
    1,
  );
  const schemas = success.requests.map(
    (r) => r.body.tools[0].functionDeclarations[0].parameters,
  );
  assert.deepEqual(Object.keys(schemas[0].properties).sort(), [
    'assets',
    'clarification',
    'phrases',
    'unsupported',
  ]);
  assert.deepEqual(Object.keys(schemas[1].properties).sort(), [
    'outcome',
    'patchJson',
    'summary',
    'unavailableCapabilities',
  ]);
  assert.equal(schemas[1].properties.patchJson.type, 'string');
  const started = success.diagnostics.filter(
    (d) => d.event === 'model_started',
  );
  assert.equal(started.length, 2);
  assert.equal(started[1].structuredOutputMethod, 'functionCalling');
  assert.equal(started[1].credentialChanged, false);
  assert.ok(started[1].promptBytes > started[0].promptBytes);
  const response = (status, body) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  for (const [status, expected, retryable] of [
    [400, 'AI_REQUEST_FAILED', false],
    [401, 'AI_AUTH_FAILED', false],
    [403, 'AI_AUTH_FAILED', false],
    [429, 'AI_QUOTA_OR_RATE_LIMIT', true],
    [503, 'AI_PROVIDER_FAILED', true],
  ]) {
    const failed = await run(() =>
      response(status, {
        error: {
          code: status,
          status:
            status === 400
              ? 'INVALID_ARGUMENT'
              : status === 401
                ? 'UNAUTHENTICATED'
                : status === 403
                  ? 'PERMISSION_DENIED'
                  : status === 429
                    ? 'RESOURCE_EXHAUSTED'
                    : 'UNAVAILABLE',
          message: `Private provider echo ${secret} Center an emoji for the whole clip`,
        },
      }),
    );
    assert.ok(failed.error);
    const diagnostic = failed.diagnostics.find(
      (d) => d.event === 'model_failed',
    );
    assert.equal(diagnostic.node, 'generate_patch');
    assert.equal(diagnostic.failure.code, expected);
    assert.equal(diagnostic.failure.upstreamStatus, status);
    assert.equal(diagnostic.failure.origin, 'provider_http');
    assert.equal(diagnostic.failure.retryable, retryable);
    assert.ok(diagnostic.durationMs >= 0);
    assert.equal(failed.error.getResponse().code, expected);
    let envelope;
    const httpResponse = {
      status: () => httpResponse,
      json: (value) => {
        envelope = value;
      },
    };
    new AllExceptionsFilter().catch(failed.error, {
      switchToHttp: () => ({
        getResponse: () => httpResponse,
        getRequest: () => ({ url: '/clips/synthetic/ai-edit/propose' }),
      }),
    });
    assert.equal(envelope.error.code, expected);
    assert.equal(envelope.error.details[0].upstreamStatus, status);
    assert.equal(failed.requests.length, retryable ? 3 : 2); // Bounded graph retry; SDK retries remain disabled.
    for (const sensitive of [
      secret,
      'Private provider echo',
      'Center an emoji for the whole clip',
    ])
      assert.equal(
        JSON.stringify(failed.diagnostics).includes(sensitive),
        false,
      );
  }
  const recovered = await run((call) =>
    call === 2
      ? response(503, { error: { code: 503, status: 'UNAVAILABLE' } })
      : undefined,
  );
  assert.equal(recovered.error, undefined);
  assert.equal(recovered.result.status, 'pending');
  assert.equal(recovered.requests.length, 3);
  assert.equal(
    recovered.diagnostics.filter((d) => d.event === 'asset_resolution').length,
    1,
  );
  assert.equal(
    recovered.diagnostics.filter((d) => d.event === 'model_retry').length,
    1,
  );
  const malformed = await run(() =>
    response(200, {
      candidates: [
        {
          content: {
            role: 'model',
            parts: [
              {
                functionCall: {
                  name: 'extract',
                  args: { outcome: 'proposal' },
                },
              },
            ],
          },
          finishReason: 'STOP',
        },
      ],
    }),
  );
  assert.equal(
    malformed.error.getResponse().code,
    'AI_STRUCTURED_OUTPUT_INVALID',
  );
  assert.equal(
    malformed.diagnostics.find((d) => d.event === 'model_failed').failure
      .origin,
    'provider_response',
  );
  const capped = await run(() =>
    response(200, {
      candidates: [
        { content: { role: 'model', parts: [] }, finishReason: 'MAX_TOKENS' },
      ],
    }),
  );
  assert.equal(capped.error.getResponse().code, 'AI_OUTPUT_TOKEN_LIMIT');
  const timedOut = await run(() => {
    const error = new Error(secret);
    error.name = 'TimeoutError';
    throw error;
  });
  assert.equal(timedOut.error.getResponse().code, 'AI_TIMEOUT');
  assert.equal(
    timedOut.diagnostics.find((d) => d.event === 'model_failed').failure.origin,
    'transport',
  );
  assert.equal((await run()).result.status, 'pending'); // New execution can succeed after failures.
  const appFailure = await run(undefined, true);
  assert.equal(appFailure.error.getResponse().code, 'AI_EXECUTION_FAILED');
  assert.equal(
    appFailure.diagnostics.find((d) => d.event === 'model_failed').failure
      .origin,
    'execution',
  );
  console.log(
    'Controlled interpret -> resolve_assets(1) -> generate_patch passed; HTTP failure, malformed output, token limit, timeout, redaction and new-execution retry checks passed with the real LangChain adapter and synthetic HTTP.',
  );
}
module.exports = { run };
if (require.main === module)
  main().catch(() => {
    console.error(
      'Controlled proposal test failed; no upstream services were called.',
    );
    process.exitCode = 1;
  });
