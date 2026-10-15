// Read-only, scoped investigation. Load configuration with node --env-file=.env.
// Never output credentials, user prompts, asset metadata, or raw tool results.
const mongoose = require('mongoose');
const { readFileSync } = require('node:fs');
const { execFileSync } = require('node:child_process');
const { join } = require('node:path');
async function main() {
  const id = process.argv[2];
  if (!/^[a-f\d]{24}$/i.test(id || '')) throw new Error('INVALID_PROPOSAL_ID');
  const report = { observedAt: new Date().toISOString(), localRevision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() };
  try { report.localBuild = JSON.parse(readFileSync(join(__dirname, '../dist/build-info.json'), 'utf8')); } catch { report.localBuild = null; }
  try {
    const { createHash } = require('node:crypto');
    const { editingCapabilities } = require('../dist/src/ai-editor/agent/edit-capabilities');
    report.compiledCapabilities = { hash: createHash('sha256').update(JSON.stringify(editingCapabilities)).digest('hex'), operationTypes: editingCapabilities.operations,
      emojiGenerationAvailable: editingCapabilities.assets.deterministicEmoji.includes('😂'), imageGeneration: editingCapabilities.assets.imageGeneration,
      patchContractInInitialCapabilities: !!editingCapabilities.patchContract,
      originalAudioInInitialCapabilities: !!editingCapabilities.originalAudioContract };
  } catch { report.compiledCapabilities = null; }
  const origin = process.env.AI_DIAGNOSTIC_ORIGIN;
  if (origin) {
    const url = new URL(origin);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('INVALID_DIAGNOSTIC_ORIGIN');
    report.health = [];
    for (let i = 0; i < 3; i++) {
      try {
        const response = await fetch(new URL('/health', url), { redirect: 'error', signal: AbortSignal.timeout(15000) });
        const body = await response.json();
        const build = body.data?.build ?? body.build;
        report.health.push({ status: response.status, build: build ? { revision: build.revision, sourceDirty: build.sourceDirty, builtAt: build.builtAt, artifactHash: build.artifactHash } : null });
      } catch { report.health.push({ error: 'HEALTH_UNAVAILABLE' }); }
    }
  }
  if (!process.env.MONGO_URI) { report.database = 'NOT_CONFIGURED'; console.log(JSON.stringify(report, null, 2)); return; }
  const connection = mongoose.createConnection(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000, connectTimeoutMS: 10000, autoIndex: false, autoCreate: false });
  try {
    await connection.asPromise();
    const db = connection.db;
    const proposal = await db.collection('ai_edit_proposals').findOne({ _id: new mongoose.Types.ObjectId(id) }, { maxTimeMS: 5000 });
    report.database = proposal ? 'EXACT_PROPOSAL_FOUND' : 'PROPOSAL_NOT_FOUND_IN_CONFIGURED_DATABASE';
    if (proposal) {
      const peers = await db.collection('ai_edit_proposals').find({ userId: proposal.userId, sessionId: proposal.sessionId }, { projection: { status: 1, baseRevision: 1, executionId: 1, modelId: 1, createdAt: 1, errorCode: 1 }, maxTimeMS: 5000 }).limit(20).toArray();
      report.proposals = peers;
      const usage = await db.collection('ai_model_usage').find({ executionId: { $in: peers.map((p) => p.executionId) } }, { projection: { _id: 0, executionId: 1, call: 1, status: 1, errorCode: 1, createdAt: 1, latencyMs: 1, modelId: 1 }, maxTimeMS: 5000 }).limit(60).toArray();
      report.usage = usage;
      report.tools = [];
      const messages = await db.collection('ai_agent_messages').find({ userId: proposal.userId, executionId: proposal.executionId, role: 'tool' }, { projection: { content: 1, createdAt: 1 }, maxTimeMS: 5000 }).sort({ createdAt: 1 }).limit(20).toArray();
      for (const message of messages) {
        try {
          const data = JSON.parse(message.content);
          const tool = { name: data.name, createdAt: message.createdAt };
          if (data.name === 'get_clip_context') tool.context = { revision: data.result.revision, outputDuration: data.result.outputDuration, sourceDuration: data.result.sourceDuration };
          if (data.name === 'resolve_asset') tool.resolution = { hasAssetId: typeof data.result?.assetId === 'string', mimeType: data.result?.mimeType, width: data.result?.width, height: data.result?.height, needsInput: !!data.result?.clarification };
          report.tools.push(tool);
        } catch { report.tools.push({ name: 'TRUNCATED_TOOL_RECORD', createdAt: message.createdAt }); }
      }
      report.storedTrace = { diagnosticsPresent: !!proposal.diagnostics, rawStructuredModelOutputPersisted: false };
      report.storedTrace.reportedSummaryMatch = [
        'Multiple distinct operations (zoom addition and original audio adjustment) in a single request are not supported; please submit them one at a time.',
        'Adding an emoji at the dead center for the whole clip is not supported.',
        'Adding an emoji overlay for the entire video duration is not supported.',
      ].includes(proposal.summary);
      const model = await db.collection('ai_models').findOne({ _id: new mongoose.Types.ObjectId(proposal.modelId) }, { projection: { capabilities: 1, tasks: 1, settings: 1, enabled: 1, updatedAt: 1 }, maxTimeMS: 5000 });
      report.model = model;
    }
  } catch { report.database = 'DATABASE_UNAVAILABLE'; }
  finally { await connection.close().catch(() => {}); }
  console.log(JSON.stringify(report, null, 2));
}
main().catch(() => { console.error('TRACE_FAILED: details suppressed'); process.exitCode = 1; });
