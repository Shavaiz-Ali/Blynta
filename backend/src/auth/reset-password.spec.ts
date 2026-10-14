import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ZodValidationPipe } from 'nestjs-zod';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import type { Server } from 'http';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthProviderConfigService } from './auth-provider-config.service';
import { AuthRateLimitGuard } from './auth-rate-limit.guard';
import { SsoBridgeGuard } from './sso-bridge.guard';
import { UsersService } from '../users/users.service';
import { ResponseInterceptor } from '../common/interceptors/response.interceptor';
import { AllExceptionsFilter } from '../common/filters/all-exceptions.filter';

// Provider discovery is unrelated to password recovery and has its own schema.
jest.mock('./auth-provider-config.service', () => ({
  AuthProviderConfigService: class {},
}));

function payload(response: request.Response) {
  return response.body as {
    success: boolean;
    data: { valid: boolean };
    error: { code: string };
  };
}

describe('Password reset HTTP flow', () => {
  const token = 'a'.repeat(64);
  let app: INestApplication;
  let state: {
    _id: string;
    passwordResetToken?: string;
    passwordResetExpiresAt?: Date;
    password?: string;
  };
  const revokeUser = jest.fn();
  const queueCreate = jest.fn();
  const find = jest.fn();
  let failLookup = false;

  beforeAll(async () => {
    const users = Object.assign(
      Object.create(UsersService.prototype) as UsersService,
      {
        userModel: {
          find,
          updateOne: (
            filter: Record<string, unknown>,
            update: {
              $set: object;
              $unset: Record<string, number>;
            },
          ) => {
            if (
              filter.passwordResetToken !== state.passwordResetToken ||
              !state.passwordResetExpiresAt ||
              state.passwordResetExpiresAt <= new Date()
            ) {
              return { modifiedCount: 0 };
            }
            Object.assign(state, update.$set);
            for (const key of Object.keys(update.$unset))
              Reflect.deleteProperty(state, key);
            return { modifiedCount: 1 };
          },
        },
      },
    );
    const service = Object.assign(
      Object.create(AuthService.prototype) as AuthService,
      {
        usersService: users,
        sso: { revokeUser },
        activitiesService: { queueCreate },
      },
    );
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: service },
        { provide: AuthProviderConfigService, useValue: {} },
      ],
    })
      .overrideGuard(AuthRateLimitGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(SsoBridgeGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ZodValidationPipe());
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    failLookup = false;
    state = {
      _id: 'test-user',
      passwordResetToken: await bcrypt.hash(token, 4),
      passwordResetExpiresAt: new Date(Date.now() + 60000),
    };
    find.mockImplementation(() => ({
      select: () => ({
        exec: () => {
          if (failLookup) throw new Error('Database unavailable');
          return Promise.resolve(
            state.passwordResetExpiresAt &&
              state.passwordResetExpiresAt > new Date()
              ? [{ ...state }]
              : [],
          );
        },
      }),
    }));
  });

  afterAll(async () => {
    await app?.close();
  });

  const validate = (value: string) =>
    request(app.getHttpServer() as Server)
      .post('/auth/validate-reset-token')
      .send({ token: value });
  const reset = () =>
    request(app.getHttpServer() as Server)
      .post('/auth/reset-password')
      .send({ token, newPassword: 'New-password-123' });

  it('validates without consuming the token or exposing credentials', async () => {
    const originalHash = state.passwordResetToken;
    for (let index = 0; index < 2; index++) {
      const response = await validate(token).expect(201);
      expect(payload(response).data).toEqual({ valid: true });
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.headers['referrer-policy']).toBe('no-referrer');
      expect(JSON.stringify(payload(response))).not.toContain(token);
      expect(JSON.stringify(payload(response))).not.toContain(originalHash);
    }
    expect(state.passwordResetToken).toBe(originalHash);
    expect(revokeUser).not.toHaveBeenCalled();
  });

  it('rejects expired links during validation and final submission', async () => {
    state.passwordResetExpiresAt = new Date(0);
    expect(payload(await validate(token)).data.valid).toBe(false);
    const response = await reset().expect(400);
    expect(payload(response).error.code).toBe('TOKEN_INVALID_OR_EXPIRED');
    expect(state.password).toBeUndefined();
  });

  it('rejects unknown, missing, malformed, and oversized tokens', async () => {
    expect(payload(await validate('b'.repeat(64))).data.valid).toBe(false);
    for (const value of ['', 'malformed', 'a'.repeat(72)]) {
      find.mockClear();
      expect(payload(await validate(value)).data.valid).toBe(false);
      expect(find).not.toHaveBeenCalled();
    }
    await request(app.getHttpServer() as Server)
      .post('/auth/validate-reset-token')
      .send({})
      .expect(400);
    await validate('a'.repeat(257)).expect(400);
  });

  it('consumes once, revokes sessions, and rejects reopening a used link', async () => {
    await reset().expect(201);
    expect(await bcrypt.compare('New-password-123', state.password!)).toBe(
      true,
    );
    expect(state.passwordResetToken).toBeUndefined();
    expect(state.passwordResetExpiresAt).toBeUndefined();
    expect(revokeUser).toHaveBeenCalledWith('test-user');
    expect(queueCreate).toHaveBeenCalledTimes(1);
    expect(payload(await validate(token)).data.valid).toBe(false);
    await reset().expect(400);
  });

  it('independently rejects a link that expires after pre-validation', async () => {
    expect(payload(await validate(token)).data.valid).toBe(true);
    state.passwordResetExpiresAt = new Date(0);
    await reset().expect(400);
    expect(revokeUser).not.toHaveBeenCalled();
  });

  it('allows only one simultaneous reset to consume the token', async () => {
    const responses = await Promise.all([reset(), reset()]);
    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 400,
    ]);
    expect(revokeUser).toHaveBeenCalledTimes(1);
  });

  it.each(['short1', '12345678', 'abcdefgh'])(
    'enforces password policy for %s',
    async (newPassword) => {
      await request(app.getHttpServer() as Server)
        .post('/auth/reset-password')
        .send({ token, newPassword })
        .expect(400);
      expect(state.passwordResetToken).toBeDefined();
    },
  );

  it('keeps server failure distinct from invalid tokens', async () => {
    failLookup = true;
    const response = await validate(token).expect(500);
    expect(payload(response).success).toBe(false);
    expect(payload(response).error.code).toBe('INTERNAL_ERROR');
  });
});
