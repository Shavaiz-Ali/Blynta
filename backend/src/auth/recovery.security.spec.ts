import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { AuthProvider } from '../users/schemas/user.schema';

type RecordState = {
  otpCode?: string;
  otpExpiresAt?: Date;
  passwordResetToken?: string;
  passwordResetExpiresAt?: Date;
  password?: string;
  emailVerified?: boolean;
};

describe('Persistent recovery artifacts', () => {
  let state: RecordState;
  let service: UsersService;
  beforeEach(() => {
    state = {};
    const model = {
      findById: () => ({
        select: () => ({ exec: () => Promise.resolve({ ...state }) }),
      }),
      updateOne: (
        filter: Record<string, unknown>,
        update: {
          $set?: Record<string, unknown>;
          $unset?: Record<string, number>;
        },
      ) => {
        for (const key of ['otpCode', 'passwordResetToken'] as const)
          if (key in filter && filter[key] !== state[key])
            return { modifiedCount: 0 };
        for (const key of ['otpExpiresAt', 'passwordResetExpiresAt'] as const)
          if (key in filter && (!state[key] || state[key] <= new Date()))
            return { modifiedCount: 0 };
        Object.assign(state, update.$set);
        for (const key of Object.keys(update.$unset || {}))
          Reflect.deleteProperty(state, key);
        return { modifiedCount: 1 };
      },
    };
    service = Object.assign(
      Object.create(UsersService.prototype) as UsersService,
      { userModel: model },
    );
  });
  it('consumes a correct OTP only once, including simultaneous requests', async () => {
    state.otpCode = await bcrypt.hash('123456', 10);
    state.otpExpiresAt = new Date(Date.now() + 600000);
    const results = await Promise.all([
      service.verifyOtpCode('user', '123456'),
      service.verifyOtpCode('user', '123456'),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(state.emailVerified).toBe(true);
    expect(state.otpCode).toBeUndefined();
    await expect(service.verifyOtpCode('user', '123456')).resolves.toBe(false);
  });
  it('rejects incorrect and expired OTPs without consuming a valid artifact', async () => {
    state.otpCode = await bcrypt.hash('123456', 10);
    state.otpExpiresAt = new Date(Date.now() + 600000);
    await expect(service.verifyOtpCode('user', '654321')).resolves.toBe(false);
    expect(state.otpCode).toBeDefined();
    state.otpExpiresAt = new Date(0);
    await expect(service.verifyOtpCode('user', '123456')).resolves.toBe(false);
  });
  it('atomically consumes reset hashes and stores a bcrypt password', async () => {
    state.passwordResetToken = 'existing-bcrypt-reset-hash';
    state.passwordResetExpiresAt = new Date(Date.now() + 3600000);
    const results = await Promise.all([
      service.resetPassword(
        'user',
        'New-password-123',
        state.passwordResetToken,
      ),
      service.resetPassword(
        'user',
        'Other-password-456',
        state.passwordResetToken,
      ),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(state.passwordResetToken).toBeUndefined();
    expect(state.passwordResetExpiresAt).toBeUndefined();
    expect(state.password).toMatch(/^\$2/);
    await expect(
      service.resetPassword(
        'user',
        'Third-password-789',
        'existing-bcrypt-reset-hash',
      ),
    ).resolves.toBe(false);
  });
  it('rejects expired or replaced reset hashes', async () => {
    state.passwordResetToken = 'newer-reset-hash';
    state.passwordResetExpiresAt = new Date(Date.now() + 3600000);
    await expect(
      service.resetPassword('user', 'New-password-123', 'old-reset-hash'),
    ).resolves.toBe(false);
    state.passwordResetExpiresAt = new Date(0);
    await expect(
      service.resetPassword('user', 'New-password-123', 'newer-reset-hash'),
    ).resolves.toBe(false);
    expect(state.password).toBeUndefined();
  });
});

describe('Existing federated identities', () => {
  it.each([AuthProvider.GOOGLE, AuthProvider.FACEBOOK])(
    'links %s to an existing email instead of creating a second user',
    async (provider) => {
      const existing = {
        _id: 'existing-user',
        email: 'existing@example.test',
        linkedAccounts: [
          { provider: AuthProvider.LOCAL, providerId: 'existing@example.test' },
        ],
        save: jest.fn(),
      };
      existing.save.mockResolvedValue(existing);
      const model = {
        findOne: jest.fn(() => ({ exec: () => Promise.resolve(existing) })),
      };
      const service: UsersService = Object.assign(
        Object.create(UsersService.prototype) as UsersService,
        { userModel: model },
      );
      jest.spyOn(service, 'findByProviderId').mockResolvedValue(null);
      const result = await service.findOrCreateFromSocialProvider({
        provider,
        providerId: 'verified-provider-account',
        email: existing.email,
        name: 'Existing User',
      });
      expect(result._id).toBe('existing-user');
      expect(existing.linkedAccounts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            provider,
            providerId: 'verified-provider-account',
          }),
        ]),
      );
      expect(existing.save).toHaveBeenCalledTimes(1);
    },
  );
  it('keeps the previously linked provider identity authoritative', async () => {
    const existing = { _id: 'existing-user' };
    const service = Object.create(UsersService.prototype) as UsersService;
    jest
      .spyOn(service, 'findByProviderId')
      .mockResolvedValue(
        existing as Awaited<ReturnType<UsersService['findByProviderId']>>,
      );
    const result = await service.findOrCreateFromSocialProvider({
      provider: AuthProvider.GOOGLE,
      providerId: 'existing-provider-id',
      email: 'changed@example.test',
      name: 'Changed Name',
    });
    expect(result._id).toBe('existing-user');
  });
});
