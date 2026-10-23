// Inspect the built artifact, not just the TypeScript source. No server/DB connections.
require('reflect-metadata');
const assert = require('node:assert/strict');
const {
  MODULE_METADATA,
  PATH_METADATA,
  METHOD_METADATA,
} = require('@nestjs/common/constants');
const { RequestMethod } = require('@nestjs/common');
const { AppModule } = require('../dist/src/app.module.js');
const { BillingModule } = require('../dist/src/billing/billing.module.js');
const {
  BillingController,
} = require('../dist/src/billing/billing.controller.js');
const seen = new Set();
function visit(entry) {
  const type = entry?.forwardRef ? entry.forwardRef() : entry?.module || entry;
  if (!type || seen.has(type)) return;
  seen.add(type);
  for (const imported of Reflect.getMetadata(MODULE_METADATA.IMPORTS, type) ||
    [])
    visit(imported);
}
visit(AppModule);
assert.ok(
  seen.has(BillingModule),
  'Built BillingModule is not reachable from AppModule',
);
assert.ok(
  (
    Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, BillingModule) || []
  ).includes(BillingController),
  'Built BillingController is not registered',
);
assert.equal(Reflect.getMetadata(PATH_METADATA, BillingController), 'billing');
for (const [method, route] of [
  ['plans', 'plans'],
  ['creditPacks', 'credit-packs'],
  ['checkoutConfig', 'checkout-config'],
]) {
  assert.equal(
    Reflect.getMetadata(PATH_METADATA, BillingController.prototype[method]),
    route,
    `Missing built /billing/${route}`,
  );
  assert.equal(
    Reflect.getMetadata(METHOD_METADATA, BillingController.prototype[method]),
    RequestMethod.GET,
  );
}
console.log(
  'Built GET /billing/plans, /billing/credit-packs and /billing/checkout-config are registered. This does not verify the running deployment.',
);
