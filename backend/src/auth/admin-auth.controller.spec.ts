import { AdminAuthController } from './admin-auth.controller';
import { AuthService } from './auth.service';
import { SsoService, digest } from './sso.service';
import { MemoryRedis } from '../../test/support/memory-redis';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { JwtStrategy } from './jwt.strategy';
import { AdminGuard } from '../admin/guards/admin.guard';
import { ExecutionContext } from '@nestjs/common';
import Redis from 'ioredis';

describe('Independent Admin authentication boundary', () => {
  let redis: MemoryRedis;
  let sessions: SsoService;
  let controller: AdminAuthController;
  let role: string;
  const config = new ConfigService({
    JWT_SECRET: 'test-key',
    SSO_CLIENTS: JSON.stringify({
      'blynta-admin': ['https://admin.test/auth/callback'],
    }),
  });
  const users = {
    findById: jest.fn(() =>
      Promise.resolve({
        email: 'existing@test.invalid',
        role,
        isActive: true,
      }),
    ),
  };
  beforeEach(() => {
    role = 'admin';
    redis = new MemoryRedis();
    sessions = new SsoService(
      redis as unknown as Redis,
      config,
      users as unknown as UsersService,
      new JwtService({ secret: 'test-key' }),
    );
    controller = new AdminAuthController(
      {
        validateLogin: jest.fn(() =>
          Promise.resolve({ id: 'existing-user', role }),
        ),
      } as unknown as AuthService,
      sessions,
    );
  });
  const login = () =>
    controller.login({
      email: 'existing@test.invalid',
      password: 'test-password',
    });
  it('rejects ordinary credentials before storing any Admin session', async () => {
    role = 'user';
    await expect(login()).rejects.toThrow('administrator credentials');
    expect(redis.values.size).toBe(0);
  });
  it('uses the existing identity with a separate eight-hour Admin session', async () => {
    const admin = await login();
    expect(admin.id).toBe('existing-user');
    expect(admin.sessionKind).toBe('admin');
    expect(admin.expiresAt - Date.now()).toBeLessThanOrEqual(
      8 * 60 * 60 * 1000,
    );
    const record = JSON.parse(
      redis.get(`sso:session:${digest(admin.sessionToken)}`)!,
    ) as { root?: string };
    expect(record.root).toBeUndefined();
  });
  it('consumer global logout leaves Admin valid; Admin logout leaves consumers valid', async () => {
    const root = await sessions.createIdentity('existing-user');
    const child = await sessions.createIdentity(
      'existing-user',
      digest(root.sessionToken),
      root.expiresAt,
    );
    const admin = await login();
    await sessions.revoke(root.sessionToken, true);
    await expect(sessions.token(child.sessionToken)).rejects.toThrow();
    await expect(controller.session(admin)).resolves.toMatchObject({
      role: 'admin',
    });
    const nextRoot = await sessions.createIdentity('existing-user');
    await controller.logout(admin);
    await expect(controller.session(admin)).rejects.toThrow();
    await expect(sessions.token(nextRoot.sessionToken)).resolves.toMatchObject({
      id: 'existing-user',
    });
  });
  it('rejects consumer credentials at Admin session and APIs, even for an admin user', async () => {
    const consumer = await sessions.createIdentity('existing-user');
    await expect(controller.session(consumer)).rejects.toThrow();
    const current = await new JwtStrategy(
      config,
      users as unknown as UsersService,
      sessions,
    ).validate({
      sub: 'existing-user',
      email: 'existing@test.invalid',
      role: 'admin',
      sid: digest(consumer.sessionToken),
    });
    expect(() =>
      new AdminGuard().canActivate({
        switchToHttp: () => ({ getRequest: () => ({ user: current }) }),
      } as unknown as ExecutionContext),
    ).toThrow();
  });
  it('role removal immediately invalidates Admin session and issued API token', async () => {
    const admin = await login();
    role = 'user';
    await expect(controller.session(admin)).rejects.toThrow();
    await expect(
      new JwtStrategy(
        config,
        users as unknown as UsersService,
        sessions,
      ).validate({
        sub: 'existing-user',
        email: 'existing@test.invalid',
        role: 'admin',
        sid: digest(admin.sessionToken),
      }),
    ).rejects.toThrow();
  });
  it('rejects expired, revoked, malformed and cross-boundary session credentials', async () => {
    const admin = await login();
    await expect(sessions.token(admin.sessionToken)).rejects.toThrow();
    await expect(sessions.revoke(admin.sessionToken, true)).rejects.toThrow();
    await expect(
      controller.session({ sessionToken: 'malformed' }),
    ).rejects.toThrow();
    redis.values.get(`sso:session:${digest(admin.sessionToken)}`)!.expires = 0;
    await expect(controller.session(admin)).rejects.toThrow();
  });
  it('refuses Admin authorization even when obsolete client registration remains', () => {
    expect(() =>
      sessions.validateRequest({
        client_id: 'blynta-admin',
        redirect_uri: 'https://admin.test/auth/callback',
        response_type: 'code',
        code_challenge_method: 'S256',
        code_challenge: 'a'.repeat(43),
        state: 's'.repeat(43),
      }),
    ).toThrow();
  });
});
