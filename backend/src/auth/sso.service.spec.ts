import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { SsoService, digest } from './sso.service';
import { UsersService } from '../users/users.service';
import { JwtStrategy } from './jwt.strategy';
import { AuthRateLimitGuard } from './auth-rate-limit.guard';
import { SsoBridgeGuard } from './sso-bridge.guard';
import { AdminGuard } from '../admin/guards/admin.guard';
import Redis from 'ioredis';
import { ExecutionContext } from '@nestjs/common';

import { MemoryRedis } from '../../test/support/memory-redis';

describe('Blynta centralized identity security', () => {
  let redis: MemoryRedis;
  let service: SsoService;
  let config: ConfigService;
  const user = {
    _id: 'existing-user',
    email: 'existing@example.test',
    role: 'user',
    isActive: true,
  };
  const users = { findById: jest.fn(() => Promise.resolve(user)) };
  const verifier = 'a'.repeat(43);
  const request = {
    client_id: 'studio',
    redirect_uri: 'http://localhost:3002/auth/callback',
    response_type: 'code',
    state: 's'.repeat(43),
    code_challenge_method: 'S256',
    code_challenge: digest(verifier),
  };
  beforeEach(() => {
    redis = new MemoryRedis();
    user.role = 'user';
    user.isActive = true;
    config = new ConfigService({
      JWT_SECRET: 'test-only-key',
      NODE_ENV: 'test',
      SSO_BRIDGE_SECRET: 'test-bridge',
      SSO_CLIENTS: JSON.stringify({
        studio: [request.redirect_uri],
        main: ['http://localhost:3000/auth/callback'],
        admin: ['http://localhost:3001/auth/callback'],
      }),
    });
    service = new SsoService(
      redis as unknown as Redis,
      config,
      users as unknown as UsersService,
      new JwtService({ secret: 'test-only-key' }),
    );
  });
  async function grant() {
    const identity = await service.createIdentity('existing-user');
    const authorization = await service.authorize(
      identity.sessionToken,
      request,
    );
    return {
      identity,
      authorization,
      exchange: {
        code: authorization.code,
        client_id: request.client_id,
        redirect_uri: request.redirect_uri,
        code_verifier: verifier,
        grant_type: 'authorization_code',
      },
    };
  }

  it.each([
    ['studio', request.redirect_uri],
    ['main', 'http://localhost:3000/auth/callback'],
    ['admin', 'http://localhost:3001/auth/callback'],
  ])('hands the existing identity to %s', async (client_id, redirect_uri) => {
    const identity = await service.createIdentity('existing-user');
    const authorization = await service.authorize(identity.sessionToken, {
      ...request,
      client_id,
      redirect_uri,
    });
    const result = await service.exchange({
      code: authorization.code,
      client_id,
      redirect_uri,
      code_verifier: verifier,
      grant_type: 'authorization_code',
    });
    expect(result.id).toBe('existing-user');
    expect(result.role).toBe('user');
    const jwt = new JwtService({ secret: 'test-only-key' }).verify<{
      exp: number;
      iat: number;
      sid: string;
    }>(result.accessToken);
    expect(jwt.exp - jwt.iat).toBe(300);
    expect(jwt.sid).toBe(digest(result.sessionToken));
    expect(redis.values.has(`sso:session:${result.sessionToken}`)).toBe(false);
  });
  it('rejects reuse and atomically rejects concurrent exchanges', async () => {
    const { exchange } = await grant();
    const results = await Promise.allSettled([
      service.exchange(exchange),
      service.exchange(exchange),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    await expect(service.exchange(exchange)).rejects.toThrow('Invalid grant');
  });
  it('rejects expired codes', async () => {
    const { exchange } = await grant();
    redis.values.get(`sso:code:${digest(exchange.code)}`)!.expires = 0;
    await expect(service.exchange(exchange)).rejects.toThrow('Invalid grant');
  });
  it('rejects a wrong verifier, client or callback', async () => {
    const { exchange } = await grant();
    for (const changes of [
      { code_verifier: '' },
      { code_verifier: 'b'.repeat(43) },
      { client_id: 'main' },
      { redirect_uri: exchange.redirect_uri + '/evil' },
    ])
      await expect(
        service.exchange({ ...exchange, ...changes }),
      ).rejects.toThrow('Invalid grant');
  });
  it.each([
    'https://evil.test/auth/callback',
    'http://localhost:3002/auth/callback/evil',
    'http://localhost:3002/auth/callback?extra=1',
  ])('rejects unregistered callback %s', (redirect_uri) => {
    expect(() =>
      service.validateRequest({ ...request, redirect_uri }),
    ).toThrow();
  });
  it('requires PKCE S256 and high-entropy state', () => {
    for (const changes of [
      { code_challenge_method: 'plain' },
      { state: '' },
      { code_challenge: '' },
      { response_type: 'token' },
      { client_id: 'unknown-client' },
      { client_id: '__proto__' },
    ])
      expect(() =>
        service.validateRequest({ ...request, ...changes }),
      ).toThrow();
  });
  it('reuses the central identity for another product without credentials', async () => {
    const { identity } = await grant();
    const second = await service.authorize(identity.sessionToken, {
      ...request,
      client_id: 'main',
      redirect_uri: 'http://localhost:3000/auth/callback',
    });
    expect(second.code).toHaveLength(43);
  });
  it('revokes only the product on product logout', async () => {
    const { exchange, identity } = await grant();
    const product = await service.exchange(exchange);
    await service.revoke(product.sessionToken);
    await expect(service.token(product.sessionToken)).rejects.toThrow();
    await expect(service.token(identity.sessionToken)).resolves.toMatchObject({
      id: 'existing-user',
    });
  });
  it('revokes all linked products on central logout', async () => {
    const { exchange, identity } = await grant();
    const product = await service.exchange(exchange);
    await service.revoke(identity.sessionToken);
    await expect(service.token(product.sessionToken)).rejects.toThrow();
    await expect(
      service.validateSessionHash(
        digest(product.sessionToken),
        'existing-user',
      ),
    ).rejects.toThrow();
  });
  it('rejects an expired identity or inactive user', async () => {
    const { identity } = await grant();
    redis.values.get(`sso:session:${digest(identity.sessionToken)}`)!.expires =
      0;
    await expect(service.token(identity.sessionToken)).rejects.toThrow();
    const valid = await service.createIdentity('existing-user');
    user.isActive = false;
    await expect(service.token(valid.sessionToken)).rejects.toThrow();
  });
  it('invalidates sessions after password reset', async () => {
    const { exchange } = await grant();
    const product = await service.exchange(exchange);
    await service.revokeUser('existing-user');
    await expect(service.token(product.sessionToken)).rejects.toThrow();
  });
  it('reads current role from the database and keeps AdminGuard authoritative', async () => {
    const { exchange } = await grant();
    const product = await service.exchange(exchange);
    const strategy = new JwtStrategy(
      config,
      users as unknown as UsersService,
      service,
    );
    const payload = {
      sub: 'existing-user',
      role: 'admin',
      email: user.email,
      sid: digest(product.sessionToken),
    };
    const current = await strategy.validate(payload);
    expect(current.role).toBe('user');
    expect(() =>
      new AdminGuard().canActivate({
        switchToHttp: () => ({ getRequest: () => ({ user: current }) }),
      } as unknown as ExecutionContext),
    ).toThrow();
  });
  it('rejects untrusted social identity submissions', () => {
    const guard = new SsoBridgeGuard(config);
    for (const value of [undefined, 'wrong-bridge'])
      expect(() =>
        guard.canActivate({
          switchToHttp: () => ({
            getRequest: () => ({ headers: { 'x-blynta-auth-bridge': value } }),
          }),
        } as unknown as ExecutionContext),
      ).toThrow();
  });
  it('rejects unlinked legacy JWTs unless rollout explicitly allows them', async () => {
    const strategy = new JwtStrategy(
      config,
      users as unknown as UsersService,
      service,
    );
    const payload = { sub: 'existing-user', email: user.email, role: 'user' };
    await expect(strategy.validate(payload)).rejects.toThrow('Session-backed');
    const rollout = new ConfigService({
      JWT_SECRET: 'test-only-key',
      ALLOW_LEGACY_AUTH_TOKENS: 'true',
    });
    await expect(
      new JwtStrategy(
        rollout,
        users as unknown as UsersService,
        service,
      ).validate(payload),
    ).resolves.toMatchObject({ role: 'user' });
  });
  it('rate-limits repeated account attempts', async () => {
    const guard = new AuthRateLimitGuard(redis as unknown as Redis);
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          ip: '127.0.0.1',
          path: '/auth/login',
          body: { email: 'existing@example.test' },
        }),
      }),
    } as unknown as ExecutionContext;
    for (let i = 0; i < 10; i++) await guard.canActivate(context);
    await expect(guard.canActivate(context)).rejects.toThrow(
      'Too many attempts',
    );
  });
});
