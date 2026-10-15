const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const ts = require(require.resolve('typescript', { paths: [path.join(root, 'backend')] }));

test('admin API preserves actionable validation failures and target model metadata', async () => {
  const source = fs.readFileSync(path.join(root, 'apps/admin/features/admin-ai/api.ts'), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  let response;
  const requests = [];
  const exported = {};
  vm.runInNewContext(code, {
    exports: exported,
    require(name) {
      if (name === '@blynta/types/contracts') return require('../../packages/types/src/generated/contracts.js');
      if (name === '@/config/axiosClient') return { axiosClient: { request: async (request) => { requests.push(request); return { data: response }; } } };
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  for (const [code, message] of [
    ['AI_MODEL_UNAVAILABLE', 'The configured model or API version is unavailable.'],
    ['AI_QUOTA_OR_RATE_LIMIT', 'Provider rate limited the request.'],
    ['AI_TIMEOUT', 'Provider request timed out.'],
    ['AI_PROVIDER_FAILED', 'Provider is temporarily unavailable.'],
  ]) {
    response = { valid: false, code, message, modelId: 'gemini-3.5-flash-lite' };
    const result = await exported.aiAdminApi.write('post', 'credentials/id/validate');
    assert.equal(result, response);
    assert.equal(result.message, message);
    assert.equal(requests.at(-1).url, '/admin/ai/credentials/id/validate');
  }
});
