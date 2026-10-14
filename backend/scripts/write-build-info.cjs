const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { checkAIRoutes } = require('./check-ai-routes.cjs');
const root = path.resolve(__dirname, '..');
checkAIRoutes();
const revision = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: root,
  encoding: 'utf8',
}).trim();
if (!/^[a-f0-9]{40}$/.test(revision))
  throw new Error('Build revision is not a Git commit');
const sourceDirty =
  execFileSync(
    'git',
    [
      'status',
      '--porcelain',
      '--untracked-files=normal',
      '--',
      'src',
      'scripts',
      'package.json',
      'vendor',
    ],
    { cwd: root, encoding: 'utf8' },
  ).trim().length > 0;
const digest = createHash('sha256');
function hash(dir) {
  for (const entry of fs
    .readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) hash(file);
    else if (file.endsWith('.js'))
      digest
        .update(path.relative(root, file).replaceAll('\\', '/'))
        .update(fs.readFileSync(file));
  }
}
hash(path.join(root, 'dist/src'));
const build = {
  revision,
  sourceDirty,
  builtAt: new Date().toISOString(),
  artifactHash: digest.digest('hex'),
};
fs.writeFileSync(
  path.join(root, 'dist/build-info.json'),
  JSON.stringify(build, null, 2) + '\n',
);
console.log(
  JSON.stringify({
    message: 'Compiled AI route verified; backend build stamped',
    ...build,
  }),
);
