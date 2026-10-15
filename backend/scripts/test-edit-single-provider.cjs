// Explicit authorization required. One HTTP provider request; DB reads only.
require('reflect-metadata');
const mongoose = require('mongoose');
const { randomUUID } = require('node:crypto');
const { ConfigService } = require('@nestjs/config');
const { registryModels } = require('../dist/src/ai-registry/registry.schemas');
const { UserSchema } = require('../dist/src/users/schemas/user.schema');
const { CredentialVault } = require('../dist/src/ai-registry/credential-vault.service');
const { GoogleAdapter } = require('../dist/src/ai-registry/google-adapter.service');
const { ProviderTransport } = require('../dist/src/ai-registry/provider-transport.service');
const { ProviderAdapterRegistry } = require('../dist/src/ai-registry/provider-adapter.registry');
const { ModelRegistry } = require('../dist/src/ai-registry/model-registry.service');
const { EditingGraph } = require('../dist/src/ai-editor/agent/editing-graph.service');
const { EditPlanValidatorService } = require('../dist/src/ai-editor/edit-plan-validator.service');
const { planSchema } = require('../dist/src/ai-editor/edit-plan.contract');
const { mergeEditPatch } = require('../dist/src/ai-editor/agent/edit-patch');
let testStep = 'initialization', sentRequests = 0;
async function main() {
  if (process.env.AI_EDIT_LIVE_AUTHORIZED !== 'true') throw new Error('AUTHORIZATION_REQUIRED');
  const proposalId = process.argv[2];
  if (!/^[a-f\d]{24}$/.test(proposalId || '')) throw new Error('INVALID_PROPOSAL_ID');
  const report = { instruction: 'Lower the original audio volume to 50%.', timeoutMs: 15000, outputTokenLimit: 1024,
    providerRequests: 0, stages: [], modelResponses: [], diagnostics: [], usageRecordedInMemoryOnly: [],
    syntheticInterpretation: true, databaseWrites: 0, rendered: false, uploaded: false, deployed: false };
  const connection = mongoose.createConnection(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000, autoCreate: false, autoIndex: false });
  try {
    await connection.asPromise();
    testStep = 'lookup_proposal';
    const target = await connection.db.collection('ai_edit_proposals').findOne({ _id: new mongoose.Types.ObjectId(proposalId) }, { projection: { userId: 1, modelId: 1 }, maxTimeMS: 5000 });
    if (!target || target.modelId !== '6acdf04c3208db09578cb0ca') throw new Error('MODEL_MISMATCH');
    const models = Object.fromEntries(registryModels.map(({ name, schema }) => [name, connection.model(name, schema)]));
    const transport = new ProviderTransport();
    const fetch = transport.fetch.bind(transport);
    transport.fetch = async (...args) => {
      if (report.providerRequests >= 1) throw new Error('PROVIDER_BUDGET_EXHAUSTED');
      report.providerRequests++;
      sentRequests++;
      const response = await fetch(...args); report.httpStatus = response.status; return response;
    };
    const adapter = new GoogleAdapter(transport);
    const structured = adapter.structured.bind(adapter);
    let graphCalls = 0;
    adapter.structured = async (model, secret, schema, system, input, signal, provider) => {
      if (++graphCalls === 1) return { parsed: schema.parse({ phrases: [], clarification: '', unsupported: '', assets: [] }) };
      if (graphCalls > 2) throw new Error('CORRECTION_DISABLED_FOR_SINGLE_REQUEST_TEST');
      const boundedModel = { ...model.toObject(), settings: { ...model.settings, maxOutputTokens: Math.min(1024, model.settings.maxOutputTokens), timeoutMs: 15000, maxRetries: 0 } };
      const response = await structured(boundedModel, secret, schema, system, input, AbortSignal.any([signal, AbortSignal.timeout(15000)]), provider);
      report.modelResponses.push({ outcome: response.parsed.outcome, unavailableCapabilities: response.parsed.unavailableCapabilities,
        patch: response.parsed.patchJson ? (() => { try { return JSON.parse(response.parsed.patchJson); } catch { return 'INVALID_JSON'; } })() : null });
      return response;
    };
    const adapters = new ProviderAdapterRegistry(adapter);
    const registry = new ModelRegistry(models.AIProvider, models.AICredential, models.AIModel, models.AIRouting, models.AIUsage, connection.model('User', UserSchema), new CredentialVault(new ConfigService(process.env)), adapters);
    testStep = 'account_entitlement';
    const requestedModel = await registry.entitlement(target.userId) === 'free' ? undefined : target.modelId;
    testStep = 'resolve_saved_registry_and_credential';
    const route = await registry.resolveUserModel(target.userId, requestedModel, 'edit_planning');
    if (String(route.model._id) !== target.modelId) throw new Error('MODEL_MISMATCH');
    report.configuredModelId = target.modelId;
    if (process.env.AI_EDIT_LIVE_PREFLIGHT_ONLY === 'true') { console.log(JSON.stringify({ preflight: 'passed', providerRequests: sentRequests })); return; }
    const readOnlyRegistry = { resolveUserModel: registry.resolveUserModel.bind(registry), recordUsage: async (usage) => { report.usageRecordedInMemoryOnly.push({ call: usage.call, status: usage.status }); } };
    const plan = planSchema.parse({ schemaVersion: 1, timestampSystem: 'output_seconds', video: { segments: [{ id: 'main', type: 'video', sourceStart: 0, sourceEnd: 58 }] }, audio: { original: {}, tracks: [] }, operations: [] });
    const validator = new EditPlanValidatorService({ find: () => { throw new Error('ASSETS_DISABLED'); } }, {});
    const invoke = (fn) => ({ invoke: async (...args) => fn(...args) });
    const tools = { scoped: () => ({ context: invoke(() => ({ revision: 1, outputDuration: 58, sourceDuration: 58 })),
      plan: invoke(() => plan), assets: invoke(() => []), search: invoke(() => { throw new Error('TRANSCRIPT_DISABLED'); }),
      resolveAsset: async () => { throw new Error('ASSETS_DISABLED'); },
      validate: invoke(async (patch) => { const merged = mergeEditPatch(plan, 1, patch); await validator.validate(target.userId, merged.plan, 58); report.zodAndTimelineValid = true; return { valid: true }; }),
    }) };
    try {
      const result = await new EditingGraph(tools, readOnlyRegistry, adapters).run({ userId: target.userId, clipId: '222222222222222222222222', planId: '111111111111111111111111', modelId: requestedModel,
        executionId: randomUUID(), prompt: report.instruction, history: [], signal: AbortSignal.timeout(25000),
        onTool: async () => {}, onStage: async (stage) => { report.stages.push(stage); }, onDiagnostic: async (event) => { report.diagnostics.push(event); } });
      report.finalClassification = result.status;
      report.validSupportedOperation = result.patch?.changes.some((c) => c.action === 'update_original_audio' && c.controls.gain === .5) === true;
    } catch (error) {
      const response = typeof error?.getResponse === 'function' ? error.getResponse() : {};
      report.finalClassification = 'failed'; report.errorCode = response?.code || 'LIVE_EXECUTION_FAILED';
    }
  } finally { await connection.close(); }
  console.log(JSON.stringify(report, null, 2));
}
main().catch((error) => {
  const reasons = ['AI credential encryption key is unavailable', 'AI credential could not be decrypted', 'AI credential could not be authenticated', 'Active account required', 'AI model is not available for your plan', 'AI model requires a successful test with its current credential', 'AI credential is unavailable', 'MODEL_MISMATCH'];
  console.log(JSON.stringify({ preflight: 'failed', step: testStep, providerRequests: sentRequests, reason: reasons.includes(error?.message) ? error.message : 'REGISTRY_PREFLIGHT_FAILED', errorType: error?.constructor?.name === 'ServiceUnavailableException' ? 'ServiceUnavailableException' : 'PreflightError' })); process.exitCode = 1;
});
