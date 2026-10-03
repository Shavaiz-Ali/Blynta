import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { AuthProvider, UserRole } from '../users/schemas/user.schema';
import { MailService } from '../mail/mail.service';
import { ActivitiesService } from '../activities/activities.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { SsoController } from './sso.controller';
import { SsoService, digest } from './sso.service';
import { MemoryRedis } from '../../test/support/memory-redis';
import Redis from 'ioredis';

describe('Consumer social identities retain existing users and SSO', () => {
  it.each([AuthProvider.GOOGLE, AuthProvider.FACEBOOK])(
    'links %s to the existing user and issues consumer product sessions',
    async (provider) => {
      const existing = {
        _id: 'existing-user',
        email: 'existing@example.test',
        name: 'Existing User',
        role: UserRole.USER,
        isActive: true,
        hasLoggedInOnce: true,
        linkedAccounts: [
          { provider: AuthProvider.LOCAL, providerId: 'existing@example.test' },
        ],
        save: jest.fn(),
      };
      existing.save.mockResolvedValue(existing);
      const users = Object.assign(
        Object.create(UsersService.prototype) as UsersService,
        {
          userModel: {
            findOne: jest.fn(() => ({ exec: () => Promise.resolve(existing) })),
          },
          findByProviderId: jest.fn(() => Promise.resolve(null)),
          findById: jest.fn(() => Promise.resolve(existing)),
          handleFirstLoginReferralCheck: jest.fn(() => Promise.resolve()),
        },
      );
      const config = new ConfigService({
        SSO_BRIDGE_SECRET: 'synthetic-bridge',
        SSO_CLIENTS: JSON.stringify({
          'blynta-main': ['http://localhost:3000/auth/callback'],
          'blynta-studio': ['http://localhost:3002/auth/callback'],
        }),
      });
      const jwt = new JwtService({ secret: 'synthetic-jwt' });
      const sessions = new SsoService(
        new MemoryRedis() as unknown as Redis,
        config,
        users,
        jwt,
      );
      const auth = new AuthService(
        users,
        {} as MailService,
        jwt,
        {
          queueCreate: jest.fn(() => Promise.resolve()),
        } as unknown as ActivitiesService,
        sessions,
      );
      const social = await auth.validateSocialLogin(
        {
          providerId: 'verified-provider-id',
          email: existing.email,
          name: existing.name,
        },
        provider,
      );
      expect(social.id).toBe(existing._id);
      expect(existing.linkedAccounts).toEqual(
        expect.arrayContaining([
          { provider: AuthProvider.LOCAL, providerId: existing.email },
          expect.objectContaining({
            provider,
            providerId: 'verified-provider-id',
          }),
        ]),
      );
      const root = await new SsoController(sessions, auth, config).identity(
        { accessToken: social.accessToken },
        'synthetic-bridge',
      );
      for (const [client, port] of [
        ['blynta-main', 3000],
        ['blynta-studio', 3002],
      ] as const) {
        const verifier = 'v'.repeat(43);
        const redirect = `http://localhost:${port}/auth/callback`;
        const code = await sessions.authorize(root.sessionToken, {
          client_id: client,
          redirect_uri: redirect,
          response_type: 'code',
          code_challenge_method: 'S256',
          code_challenge: digest(verifier),
          state: 's'.repeat(43),
        });
        const product = await sessions.exchange({
          code: code.code,
          client_id: client,
          redirect_uri: redirect,
          grant_type: 'authorization_code',
          code_verifier: verifier,
        });
        expect(product.id).toBe(existing._id);
        expect(product.sessionKind).toBe('consumer');
        await expect(
          sessions.token(product.sessionToken, 'admin'),
        ).rejects.toThrow();
      }
    },
  );
});
