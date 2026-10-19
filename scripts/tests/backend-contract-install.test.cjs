const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
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

test('renderer npm ci preserves the vendored dependency layout in build and production installs', (t) => {
  const backend = path.resolve(__dirname, '../../backend');
  const manifest = JSON.parse(fs.readFileSync(path.join(backend, 'package.json'), 'utf8'));
  const lock = JSON.parse(fs.readFileSync(path.join(backend, 'package-lock.json'), 'utf8'));
  const root = fixture(t, false);
  // Isolate the real local dependency and lock entry: this regression needs no registry access.
  const dependency = { '@blynta/types': manifest.dependencies['@blynta/types'] };
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: manifest.name, version: manifest.version, dependencies: dependency }));
  fs.writeFileSync(path.join(root, 'package-lock.json'), JSON.stringify({
    name: lock.name, version: lock.version, lockfileVersion: lock.lockfileVersion, requires: true,
    packages: {
      '': { name: manifest.name, version: manifest.version, dependencies: dependency },
      'node_modules/@blynta/types': lock.packages['node_modules/@blynta/types'],
    },
  }));
  const before = fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8');
  const env = { ...process.env };
  for (const key of Object.keys(env))
    if (/^npm_config_install_links$/i.test(key)) delete env[key];
  // Ignore machine-specific npm configuration so the missing project config is reproducible.
  fs.writeFileSync(path.join(root, 'empty-user.npmrc'), '');
  fs.writeFileSync(path.join(root, 'empty-global.npmrc'), '');
  env.npm_config_userconfig = path.join(root, 'empty-user.npmrc');
  env.npm_config_globalconfig = path.join(root, 'empty-global.npmrc');
  // Invoke npm's JS entry point on Windows without cmd.exe argument concatenation.
  const windows = process.platform === 'win32';
  const npmArgs = windows ? [path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js')] : [];
  const ci = (...extra) => spawnSync(windows ? process.execPath : 'npm', [...npmArgs, 'ci', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', ...extra], {
    cwd: root, env, encoding: 'utf8', timeout: 30000,
  });
  const missingConfig = ci();
  assert.notEqual(missingConfig.status, 0);
  assert.match(missingConfig.stderr, /Missing: @blynta\/types@0\.1\.0 from lock file/);
  fs.copyFileSync(path.join(backend, '.npmrc'), path.join(root, '.npmrc'));
  for (const args of [[], ['--omit=dev']]) {
    const installed = ci(...args);
    assert.equal(installed.status, 0, installed.stderr || String(installed.error));
    assert.doesNotThrow(() => checkContractInstall(root));
    assert.equal(fs.lstatSync(path.join(root, 'node_modules/@blynta/types')).isSymbolicLink(), false);
    assert.equal(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'), before);
  }
  // The root Docker context must include the config, and both install stages must copy it.
  const dockerfile = fs.readFileSync(path.join(backend, 'Dockerfile.renderer'), 'utf8');
  assert.equal(dockerfile.match(/^COPY backend\/package\.json backend\/package-lock\.json backend\/\.npmrc \.\/$/gm)?.length, 2);
  assert.match(fs.readFileSync(path.join(backend, 'Dockerfile.renderer.dockerignore'), 'utf8'), /^!backend\/\.npmrc$/m);
});
