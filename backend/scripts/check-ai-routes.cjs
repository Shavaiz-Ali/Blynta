// Fail the build if the compiled controller is missing or unreachable from AppModule.
require('reflect-metadata');
const assert = require('node:assert/strict');
const {
  MODULE_METADATA,
  PATH_METADATA,
  METHOD_METADATA,
} = require('@nestjs/common/constants');
const { RequestMethod } = require('@nestjs/common');

function checkAIRoutes() {
  const { AppModule } = require('../dist/src/app.module.js');
  const {
    AIRegistryModule,
  } = require('../dist/src/ai-registry/ai-registry.module.js');
  const {
    AdminAIController,
  } = require('../dist/src/ai-registry/registry.controllers.js');
  const seen = new Set();
  function visit(value) {
    const type = value?.forwardRef
      ? value.forwardRef()
      : value?.module || value;
    if (!type || seen.has(type)) return;
    seen.add(type);
    for (const entry of Reflect.getMetadata(MODULE_METADATA.IMPORTS, type) ||
      [])
      visit(entry);
  }
  visit(AppModule);
  assert.ok(
    seen.has(AIRegistryModule),
    'Compiled AIRegistryModule is not reachable from AppModule',
  );
  assert.ok(
    (
      Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, AIRegistryModule) || []
    ).includes(AdminAIController),
    'Compiled AI registry controller is not registered',
  );
  assert.equal(
    Reflect.getMetadata(PATH_METADATA, AdminAIController),
    'admin/ai',
  );
  assert.equal(
    Reflect.getMetadata(PATH_METADATA, AdminAIController.prototype.adapters),
    'adapters',
  );
  assert.equal(
    Reflect.getMetadata(METHOD_METADATA, AdminAIController.prototype.adapters),
    RequestMethod.GET,
  );
}
module.exports = { checkAIRoutes };
if (require.main === module) {
  checkAIRoutes();
  console.log(
    'Compiled GET /admin/ai/adapters registration verified (not a production deployment check).',
  );
}
