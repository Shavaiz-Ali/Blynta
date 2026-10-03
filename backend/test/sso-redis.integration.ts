/** Tests real Redis atomicity in a unique namespace, with synthetic users only. */
import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { SsoService, digest } from '../src/auth/sso.service';
import { UsersService } from '../src/users/users.service';

async function run() {
  const environment = parseEnv(readFileSync('.env', 'utf8'));
  if (environment.NODE_ENV === 'production')
    throw new Error('Development Redis only');
  const redis = new Redis({
    host: environment.REDIS_HOST || 'localhost',
    port: Number(environment.REDIS_PORT || 6379),
    keyPrefix: `blynta-auth-test:${randomUUID()}:`,
    connectTimeout: 5000,
    maxRetriesPerRequest: 0,
    retryStrategy: () => null,
    lazyConnect: true,
  });
  redis.on('error', () => {});
  const keys: string[] = [];
  try {
    await redis.connect();
    const service = new SsoService(
      redis,
      new ConfigService({
        NODE_ENV: 'test',
        SSO_CLIENTS: JSON.stringify({
          fixture: ['http://localhost:3102/auth/callback'],
        }),
      }),
      {
        findById: () =>
          Promise.resolve({
            email: 'redis-fixture@example.test',
            role: 'user',
            isActive: true,
          }),
      } as unknown as UsersService,
      new JwtService({ secret: 'synthetic-redis-test-secret-only' }),
    );
    const root = await service.createIdentity(
      'synthetic-redis-user',
      undefined,
      Date.now() + 120000,
    );
    keys.push(`sso:session:${digest(root.sessionToken)}`);
    const verifier = 'v'.repeat(43);
    const request = {
      client_id: 'fixture',
      redirect_uri: 'http://localhost:3102/auth/callback',
      response_type: 'code',
      state: 's'.repeat(43),
      code_challenge_method: 'S256',
      code_challenge: digest(verifier),
    };
    const grant = await service.authorize(root.sessionToken, request);
    keys.push(`sso:code:${digest(grant.code)}`);
    assert.ok((await redis.ttl(keys[1])) <= 60);
    const exchange = {
      code: grant.code,
      client_id: 'fixture',
      redirect_uri: request.redirect_uri,
      code_verifier: verifier,
      grant_type: 'authorization_code',
    };
    const results = await Promise.allSettled([
      service.exchange(exchange),
      service.exchange(exchange),
    ]);
    assert.equal(
      results.filter((result) => result.status === 'fulfilled').length,
      1,
    );
    const success = results.find((result) => result.status === 'fulfilled');
    assert.ok(success?.status === 'fulfilled');
    keys.push(`sso:session:${digest(success.value.sessionToken)}`);
    await assert.rejects(service.exchange(exchange));
    const expired = await service.authorize(root.sessionToken, request);
    const expiredKey = `sso:code:${digest(expired.code)}`;
    keys.push(expiredKey);
    await redis.expire(expiredKey, 0);
    await assert.rejects(service.exchange({ ...exchange, code: expired.code }));
    await service.revoke(root.sessionToken);
    await assert.rejects(service.token(success.value.sessionToken));
    console.log(
      'PASS: real Redis TTL, atomic concurrent exchange, replay rejection and linked-session revocation',
    );
  } finally {
    if (redis.status === 'ready' && keys.length) await redis.del(...keys);
    redis.disconnect();
  }
}
run().catch(() => {
  console.error(
    'Real Redis check failed; no real user accounts were accessed.',
  );
  process.exitCode = 1;
});
