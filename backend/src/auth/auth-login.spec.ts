import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { ActivitiesService } from '../activities/activities.service';
import { SsoService } from './sso.service';

describe('Password login failures', () => {
  const user = {
    _id: 'test-user',
    email: 'user@example.test',
    role: 'user',
    isActive: true,
    password: 'synthetic-hash',
  };

  function setup(record: object | null, passwordValid = false) {
    const users = {
      findByEmailWithPassword: jest.fn().mockResolvedValue(record),
      validatePassword: jest.fn().mockResolvedValue(passwordValid),
      handleFirstLoginReferralCheck: jest.fn().mockResolvedValue(undefined),
    };
    const jwt = { signAsync: jest.fn().mockResolvedValue('access-token') };
    const activities = { queueCreate: jest.fn().mockResolvedValue(undefined) };
    const service = new AuthService(
      users as unknown as UsersService,
      {} as MailService,
      jwt as unknown as JwtService,
      activities as unknown as ActivitiesService,
      {} as SsoService,
    );
    return { service, users, jwt, activities };
  }

  it.each([
    [null, 'INCORRECT_EMAIL', 401],
    [{ ...user, isActive: false }, 'ACCOUNT_INACTIVE', 403],
    [{ ...user, password: undefined }, 'PASSWORD_SIGN_IN_UNAVAILABLE', 401],
    [user, 'INCORRECT_PASSWORD', 401],
  ])('reports the correct failure for %s', async (record, code, status) => {
    const { service, users, jwt, activities } = setup(record);
    await expect(
      service.validateLogin({
        email: user.email,
        password: 'incorrect-password',
      }),
    ).rejects.toMatchObject({ code, status });
    expect(jwt.signAsync).not.toHaveBeenCalled();
    expect(activities.queueCreate).not.toHaveBeenCalled();
    expect(users.handleFirstLoginReferralCheck).not.toHaveBeenCalled();
    if (code !== 'INCORRECT_PASSWORD') {
      expect(users.validatePassword).not.toHaveBeenCalled();
    }
  });

  it('still issues an access token for a valid password', async () => {
    const { service, users, activities } = setup(user, true);
    await expect(
      service.validateLogin({
        email: user.email,
        password: 'correct-password',
      }),
    ).resolves.toEqual({
      id: user._id,
      email: user.email,
      role: user.role,
      accessToken: 'access-token',
    });
    expect(users.validatePassword).toHaveBeenCalledWith(
      'correct-password',
      user.password,
    );
    expect(activities.queueCreate).toHaveBeenCalledTimes(1);
  });
});
