/** Local integration fixture: real Nest/AuthService/bcrypt/JWT, in-memory users and Redis. No external accounts or databases. */
import 'reflect-metadata';
import { Controller, Get, Module, Req, Query, UseGuards } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PassportModule, AuthGuard } from '@nestjs/passport';
import { ZodValidationPipe } from 'nestjs-zod';
import * as bcrypt from 'bcrypt';
import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { AuthProviderConfigService } from '../src/auth/auth-provider-config.service';
import { SsoController } from '../src/auth/sso.controller';
import { AdminAuthController } from '../src/auth/admin-auth.controller';
import { SsoService } from '../src/auth/sso.service';
import { AuthRateLimitGuard } from '../src/auth/auth-rate-limit.guard';
import { SsoBridgeGuard } from '../src/auth/sso-bridge.guard';
import { JwtStrategy } from '../src/auth/jwt.strategy';
import { UsersService } from '../src/users/users.service';
import { MailService } from '../src/mail/mail.service';
import { ActivitiesService } from '../src/activities/activities.service';
import { AdminGuard } from '../src/admin/guards/admin.guard';
import { REDIS_CLIENT } from '../src/redis/redis.module';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { MemoryRedis } from './support/memory-redis';

type FixtureUser = {
  _id: string;
  email: string;
  name: string;
  password: string;
  role: 'user' | 'admin';
  isActive: boolean;
  emailVerified: boolean;
  otp?: string;
  passwordResetToken?: string;
  passwordResetExpiresAt?: number;
};
const accounts = new Map<string, FixtureUser>();
const resetMail = new Map<string, string>();
const users = {
  async create(dto: { email: string; name: string; password: string }) {
    if (accounts.has(dto.email)) throw new Error('Account already exists');
    const user: FixtureUser = {
      _id: dto.email,
      email: dto.email,
      name: dto.name,
      role: 'user',
      isActive: true,
      emailVerified: false,
      password: await bcrypt.hash(dto.password, 10),
    };
    accounts.set(dto.email, user);
    return user;
  },
  findByEmailWithPassword(email: string) {
    return accounts.get(email);
  },
  findByEmail(email: string) {
    return accounts.get(email);
  },
  findById(id: string) {
    return accounts.get(id);
  },
  async validatePassword(plain: string, hashed: string) {
    return bcrypt.compare(plain, hashed);
  },
  handleFirstLoginReferralCheck() {},
  setOtp(id: string, otp: string) {
    accounts.get(id)!.otp = otp;
  },
  verifyOtpCode(id: string, otp: string) {
    const user = accounts.get(id)!;
    const valid = user.otp === otp;
    if (valid) delete user.otp;
    return valid;
  },
  markEmailVerified(id: string) {
    accounts.get(id)!.emailVerified = true;
  },
  async setPasswordResetToken(id: string, token: string) {
    const user = accounts.get(id)!;
    user.passwordResetToken = await bcrypt.hash(token, 10);
    user.passwordResetExpiresAt = Date.now() + 3600000;
  },
  async findByValidResetToken(token: string) {
    for (const user of accounts.values())
      if (
        user.passwordResetToken &&
        (user.passwordResetExpiresAt || 0) > Date.now() &&
        (await bcrypt.compare(token, user.passwordResetToken))
      )
        return { ...user };
    return null;
  },
  async resetPassword(id: string, password: string, expected: string) {
    const hashed = await bcrypt.hash(password, 10);
    const user = accounts.get(id)!;
    if (
      user.passwordResetToken !== expected ||
      (user.passwordResetExpiresAt || 0) <= Date.now()
    )
      return false;
    user.password = hashed;
    delete user.passwordResetToken;
    delete user.passwordResetExpiresAt;
    return true;
  },
};

@Controller()
class FixtureController {
  @Get('health') health() {
    return { status: 'ok' };
  }
  @Get('users/me') @UseGuards(AuthGuard('jwt')) me(
    @Req() req: { user: { userId: string } },
  ) {
    const user = accounts.get(req.user.userId)!;
    return {
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: true,
      emailVerified: true,
      isWelcomed: true,
      plan: 'free',
      creditsBalance: 5,
      linkedAccounts: [],
    };
  }
  @Get('admin/probe') @UseGuards(AuthGuard('jwt'), AdminGuard) admin() {
    return { allowed: true };
  }
  // Test-only verification code fixture, bound to loopback test server. Never registered by AppModule.
  @Get('test/admin-role') adminRole(@Query('role') role: string) {
    if (role === 'admin' || role === 'user')
      accounts.get('admin@example.test')!.role = role;
    return { updated: true };
  }
  @Get('test/otp') otp() {
    return { otp: accounts.get('signup@example.test')?.otp };
  }
  @Get('test/reset-token') resetToken() {
    return { token: resetMail.get('signup@example.test') };
  }
}

@Module({
  imports: [PassportModule],
  controllers: [
    AuthController,
    SsoController,
    AdminAuthController,
    FixtureController,
  ],
  providers: [
    AuthService,
    SsoService,
    JwtStrategy,
    AuthRateLimitGuard,
    SsoBridgeGuard,
    AdminGuard,
    {
      provide: ConfigService,
      useFactory: () => new ConfigService(process.env),
    },
    {
      provide: JwtService,
      useFactory: () =>
        new JwtService({
          secret: process.env.JWT_SECRET,
          signOptions: { expiresIn: '7d' },
        }),
    },
    { provide: REDIS_CLIENT, useFactory: () => new MemoryRedis() },
    { provide: UsersService, useValue: users },
    {
      provide: AuthProviderConfigService,
      useValue: {
        getEnabledProviders: () => ['local', 'google', 'facebook'],
        isProviderEnabled: (provider: string) =>
          ['google', 'facebook'].includes(provider),
      },
    },
    {
      provide: MailService,
      useValue: {
        queueOtpEmail: () => {},
        queueWelcomeEmail: () => {},
        queuePasswordResetEmail: (email: string, token: string) =>
          resetMail.set(email, token),
      },
    },
    { provide: ActivitiesService, useValue: { queueCreate: () => {} } },
  ],
})
class FixtureModule {}

async function start() {
  if (process.env.BLYNTA_TEST_FIXTURE !== 'true')
    throw new Error('Test fixture must be explicitly enabled');
  await users.create({
    email: 'existing@example.test',
    name: 'Existing User',
    password: 'Test-password-123',
  });
  const admin = await users.create({
    email: 'admin@example.test',
    name: 'Admin User',
    password: 'Test-password-123',
  });
  admin.role = 'admin';
  for (const name of ['app', 'studio', 'admin', 'auth', 'security'])
    await users.create({
      email: `logout-${name}@example.test`,
      name: 'Logout Fixture',
      password: 'Test-password-123',
    });
  const app = await NestFactory.create(FixtureModule, { logger: false });
  app.useGlobalPipes(new ZodValidationPipe());
  app.useGlobalInterceptors(new ResponseInterceptor());
  await app.listen(5101, '127.0.0.1');
  console.log('SSO integration fixture ready on loopback:5101');
}
void start();
