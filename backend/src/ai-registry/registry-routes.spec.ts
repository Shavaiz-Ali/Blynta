import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { INestApplication, RequestMethod } from '@nestjs/common';
import {
  MODULE_METADATA,
  PATH_METADATA,
  METHOD_METADATA,
} from '@nestjs/common/constants';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AdminAIController } from './registry.controllers';
import { AIRegistryModule } from './ai-registry.module';
import { AdminAIService } from './admin-ai.service';
import { AIRateLimitGuard } from './ai-rate-limit.guard';
import { AdminGuard } from '../admin/guards/admin.guard';
import { JwtStrategy } from '../auth/jwt.strategy';
import { UsersService } from '../users/users.service';
import { SsoService } from '../auth/sso.service';
import { UserRole } from '../users/schemas/user.schema';
import { ResponseInterceptor } from '../common/interceptors/response.interceptor';
import { API_ENDPOINTS } from '@blynta/types/contracts';
import { AppController } from '../app.controller';
import { AppService } from '../app.service';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';

describe('Authenticated AI adapter route registration', () => {
  let app: INestApplication<App>;
  const jwt = new JwtService({ secret: 'synthetic-test-signing-secret' });
  const service = {
    adapterOptions: jest.fn(() => ({
      items: [{ adapter: 'google', implemented: true }],
    })),
    validateCredential: jest.fn(() => Promise.resolve({ valid: true })),
  };
  beforeAll(async () => {
    const fixture = await Test.createTestingModule({
      controllers: [AdminAIController, AppController],
      providers: [
        JwtStrategy,
        AdminGuard,
        {
          provide: AppService,
          useValue: {
            getHealth: () => ({
              status: 'ok',
              build: {
                revision: 'a'.repeat(40),
                artifactHash: 'b'.repeat(64),
                sourceDirty: false,
              },
            }),
          },
        },
        {
          provide: ConfigService,
          useValue: new ConfigService({
            JWT_SECRET: 'synthetic-test-signing-secret',
          }),
        },
        { provide: AdminAIService, useValue: service },
        {
          provide: UsersService,
          useValue: {
            findById: (id: string) =>
              Promise.resolve({
                isActive: true,
                role: id === 'admin' ? UserRole.ADMIN : UserRole.USER,
                email: 'test@example.test',
              }),
          },
        },
        {
          provide: SsoService,
          useValue: {
            validateSessionHash: (sid: string) =>
              Promise.resolve(sid === 'admin-session' ? 'admin' : 'consumer'),
          },
        },
      ],
    })
      .overrideGuard(AIRateLimitGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = fixture.createNestApplication();
    app.useGlobalInterceptors(new ResponseInterceptor());
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
  });
  const token = (sub: string, sid: string) =>
    jwt.sign({ sub, sid, email: 'test@example.test' }, { expiresIn: '1m' });

  it('registers GET /admin/ai/adapters in the module and shared API contract', () => {
    const handler = Object.getOwnPropertyDescriptor(
      AdminAIController.prototype,
      'adapters',
    )?.value as object;
    expect(
      Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, AIRegistryModule),
    ).toContain(AdminAIController);
    expect(Reflect.getMetadata(PATH_METADATA, AdminAIController)).toBe(
      'admin/ai',
    );
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe('adapters');
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(
      RequestMethod.GET,
    );
    expect(API_ENDPOINTS.aiAdmin.adapters).toBe('/admin/ai/adapters');
  });
  it('returns 200 and adapter options for a verified session-backed admin JWT', async () => {
    const response = await request(app.getHttpServer())
      .get(API_ENDPOINTS.aiAdmin.adapters)
      .set('Authorization', `Bearer ${token('admin', 'admin-session')}`)
      .expect(200);
    expect(response.body).toMatchObject({
      success: true,
      data: { items: [{ adapter: 'google', implemented: true }] },
    });
  });
  it('returns 401 rather than 404 without authentication', async () => {
    await request(app.getHttpServer())
      .get(API_ENDPOINTS.aiAdmin.adapters)
      .expect(401);
  });
  it('accepts an optional registry model ID for validation and rejects malformed selections', async () => {
    const id = '111111111111111111111111';
    const modelId = '222222222222222222222222';
    const path = `/admin/ai/credentials/${id}/validate`;
    await request(app.getHttpServer())
      .post(path)
      .set('Authorization', `Bearer ${token('admin', 'admin-session')}`)
      .send({ modelId })
      .expect(201);
    expect(service.validateCredential).toHaveBeenLastCalledWith(
      'admin',
      id,
      modelId,
    );
    await request(app.getHttpServer())
      .post(path)
      .set('Authorization', `Bearer ${token('admin', 'admin-session')}`)
      .expect(201);
    expect(service.validateCredential).toHaveBeenLastCalledWith(
      'admin',
      id,
      undefined,
    );
    await request(app.getHttpServer())
      .post(path)
      .set('Authorization', `Bearer ${token('admin', 'admin-session')}`)
      .send({ modelId: 'upstream-name' })
      .expect(400);
    expect(service.validateCredential).toHaveBeenCalledTimes(2);
  });
  it('rejects an invalid signature and consumer session', async () => {
    await request(app.getHttpServer())
      .get(API_ENDPOINTS.aiAdmin.adapters)
      .set('Authorization', 'Bearer invalid-test-token')
      .expect(401);
    await request(app.getHttpServer())
      .get(API_ENDPOINTS.aiAdmin.adapters)
      .set('Authorization', `Bearer ${token('user', 'consumer-session')}`)
      .expect(403);
  });
  it('does not grant an admin user access through a consumer session', async () => {
    await request(app.getHttpServer())
      .get(API_ENDPOINTS.aiAdmin.adapters)
      .set('Authorization', `Bearer ${token('admin', 'consumer-session')}`)
      .expect(403);
  });
  it('runs the authenticated read-only deployment smoke script against a local HTTP server', async () => {
    await app.listen(0, '127.0.0.1');
    const { stdout } = await promisify(execFile)(
      process.execPath,
      [resolve(__dirname, '../../scripts/smoke-ai-admin.cjs')],
      {
        env: {
          ...process.env,
          AI_SMOKE_BASE_URL: await app.getUrl(),
          AI_SMOKE_ADMIN_TOKEN: token('admin', 'admin-session'),
          AI_SMOKE_EXPECTED_REVISION: 'a'.repeat(40),
        },
        timeout: 20000,
      },
    );
    expect(stdout).toContain('Authenticated AI adapters smoke check passed');
    expect(stdout).not.toContain('Bearer');
  });
});
