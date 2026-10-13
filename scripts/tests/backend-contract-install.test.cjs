const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { checkContractInstall } = require('../../backend/scripts/check-contract-install.cjs');
const source = path.resolve(__dirname, '../../backend/vendor/blynta-types');

function fixture(t, installed = true) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blynta-contract-check-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'package.json'), '{}');
  fs.cpSync(source, path.join(root, 'vendor/blynta-types'), { recursive: true });
  if (installed)
    fs.cpSync(source, path.join(root, 'node_modules/@blynta/types'), { recursive: true });
  return root;
}

test('accepts a complete standalone backend install', (t) => {
  assert.doesNotThrow(() => checkContractInstall(fixture(t)));
});
test('reports the required npm ci when the dependency is missing', (t) => {
  assert.throws(() => checkContractInstall(fixture(t, false)), /Run npm ci inside backend/);
});
test('rejects a stale installed contract before TypeScript compilation', (t) => {
  const root = fixture(t);
  fs.appendFileSync(path.join(root, 'node_modules/@blynta/types/contracts.d.ts'), '\n// stale\n');
  assert.throws(() => checkContractInstall(root), /stale or incomplete/);
});
test('reports an incomplete deployment archive', (t) => {
  const root = fixture(t);
  fs.unlinkSync(path.join(root, 'vendor/blynta-types/contracts.d.ts'));
  assert.throws(() => checkContractInstall(root), /Pull the complete commit/);
});
