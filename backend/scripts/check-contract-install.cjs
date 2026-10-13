const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

function checkContractInstall(backendRoot = path.resolve(__dirname, '..')) {
  const expected = path.join(backendRoot, 'vendor/blynta-types');
  for (const file of ['contracts.js', 'contracts.d.ts']) {
    if (!fs.existsSync(path.join(expected, file))) {
      throw new Error(
        'Backend contract artifacts are missing. Pull the complete commit and include backend/vendor/blynta-types in the deployment.',
      );
    }
  }
  const backendRequire = createRequire(path.join(backendRoot, 'package.json'));
  let installed;
  try {
    installed = path.dirname(backendRequire.resolve('@blynta/types/contracts'));
    backendRequire('@blynta/types/contracts');
  } catch {
    throw new Error(
      'The backend dependency @blynta/types/contracts is missing or unusable. Run npm ci inside backend and verify that it succeeds before building.',
    );
  }
  for (const file of ['contracts.js', 'contracts.d.ts']) {
    const installedFile = path.join(installed, file);
    if (
      !fs.existsSync(installedFile) ||
      fs.readFileSync(installedFile, 'utf8').replace(/\r\n/g, '\n') !==
        fs.readFileSync(path.join(expected, file), 'utf8').replace(/\r\n/g, '\n')
    ) {
      throw new Error(
        'The installed backend contracts are stale or incomplete. Run npm ci inside backend before building.',
      );
    }
  }
}

module.exports = { checkContractInstall };
if (require.main === module) {
  try {
    checkContractInstall();
    console.log('Backend contract installation verified.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
