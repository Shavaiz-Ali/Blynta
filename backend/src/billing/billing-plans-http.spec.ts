import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { BillingRateLimitGuard } from './billing-rate-limit.guard';
import { UsersService } from '../users/users.service';
import { PaddleService } from '../paddle/paddle.service';
import { ResponseInterceptor } from '../common/interceptors/response.interceptor';
import { JwtStrategy } from '../auth/jwt.strategy';
import { SsoService } from '../auth/sso.service';

// An isolated HTTP boundary test. These credentials are never accepted by production.
const testSecret = 'isolated-billing-route-test-secret';

describe('GET /billing/plans HTTP contract', () => {
  let app: INestApplication<Server>;
  const catalog = [
    {
      id: 'pro',
      credits: 75,
      enabled: true,
      price: { amount: '2200', currencyCode: 'EUR' },
    },
  ];
  const listPlans = jest.fn(() => Promise.resolve(catalog));
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [PassportModule],
      controllers: [BillingController],
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: new ConfigService({ JWT_SECRET: testSecret }),
        },
        {
          provide: SsoService,
          useValue: {
            validateSessionHash: jest.fn(() => Promise.resolve('consumer')),
          },
        },
        { provide: BillingService, useValue: { listPlans } },
        {
          provide: UsersService,
          useValue: {
            findById: jest.fn(() =>
              Promise.resolve({
                _id: 'isolated-user',
                isActive: true,
                role: 'user',
                email: 'fixture@example.invalid',
              }),
            ),
          },
        },
        { provide: PaddleService, useValue: {} },
      ],
    })
      .overrideGuard(BillingRateLimitGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
    app.useGlobalInterceptors(new ResponseInterceptor());
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
  });
  test('registered route requires authentication rather than returning 404', async () => {
    await request(app.getHttpServer()).get('/billing/plans').expect(401);
    await request(app.getHttpServer())
      .get('/billing/plans')
      .set('Authorization', 'Bearer invalid')
      .expect(401);
    expect(listPlans).not.toHaveBeenCalled();
  });
  test('valid authorized request returns the authoritative service result in the standard envelope', async () => {
    const token = new JwtService().sign(
      { sub: 'isolated-user', sid: 'isolated-session-hash' },
      { secret: testSecret, expiresIn: '1m' },
    );
    const response = await request(app.getHttpServer())
      .get('/billing/plans')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(response.body).toMatchObject({
      success: true,
      data: catalog,
      path: '/billing/plans',
    });
    expect(listPlans).toHaveBeenCalledTimes(1);
    expect(response.body).not.toHaveProperty('apiKey');
  });
});
