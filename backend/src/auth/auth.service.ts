import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import { SocialLoginDto } from './dto/social-login.dto';
import { AuthProvider } from '../users/schemas/user.schema';
import { InvalidCredentialsException } from '../common/exceptions';
import { randomBytes, randomInt } from 'crypto';
import { MailService } from '../mail/mail.service';
import { ActivitiesService } from '../activities/activities.service';
import {
  ActivityActorType,
  ActivityCategory,
  ActivitySeverity,
  ActivityStatus,
  ActivityType,
} from '../activities/schemas/activity.schema';

export interface AuthResult {
  id: string;
  email: string;
  role: string;
  accessToken: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private usersService: UsersService,
    private mailService: MailService,
    private jwtService: JwtService,
    private activitiesService: ActivitiesService,
  ) { }

  async signup(dto: CreateUserDto) {
    const refCode = dto.ref || dto.referralCode;
    const user = await this.usersService.create(dto, refCode);

    this.logger.log(`Queueing OTP email for ${user.email}`);
    // Automatically generate and queue verification OTP email upon signup
    const otp = this.generateOtp();
    await this.usersService.setOtp(user._id.toString(), otp);
    await this.mailService.queueOtpEmail(user.email, otp);
    this.logger.log(`OTP email queued for ${user.email}`);

    await this.activitiesService.queueCreate({
      userId: user._id,
      type: ActivityType.AUTH_REGISTER,
      category: ActivityCategory.AUTH,
      title: 'Account created',
      description: 'Your Blynta account was registered successfully.',
      activityUrl: '/dashboard',
      entityType: 'user',
      entityId: user._id,
      actorType: ActivityActorType.USER,
      actorId: user._id,
      status: ActivityStatus.SUCCESS,
      severity: ActivitySeverity.SUCCESS,
    });

    return { id: user._id, email: user.email };
  }

  async validateLogin(dto: LoginDto): Promise<AuthResult> {
    const user = await this.usersService.findByEmailWithPassword(dto.email);
    if (!user || !user.password) {
      throw new InvalidCredentialsException();
    }
    const isValid = await this.usersService.validatePassword(dto.password, user.password);
    if (!isValid) {
      throw new InvalidCredentialsException();
    }

    await this.usersService.handleFirstLoginReferralCheck(user._id.toString());

    const id = user._id.toString();
    const accessToken = await this.jwtService.signAsync({
      sub: id,
      email: user.email,
      role: user.role,
    });

    await this.activitiesService.queueCreate({
      userId: user._id,
      type: ActivityType.AUTH_LOGIN,
      category: ActivityCategory.AUTH,
      title: 'Logged in',
      description: 'You successfully logged in to your Blynta account.',
      activityUrl: '/dashboard',
      entityType: 'user',
      entityId: user._id,
      actorType: ActivityActorType.USER,
      actorId: user._id,
      status: ActivityStatus.SUCCESS,
      severity: ActivitySeverity.INFO,
    });

    return { id, email: user.email, role: user.role, accessToken };
  }

  async validateSocialLogin(dto: SocialLoginDto, provider: AuthProvider): Promise<AuthResult> {
    const user = await this.usersService.findOrCreateFromSocialProvider({
      provider,
      providerId: dto.providerId,
      email: dto.email,
      name: dto.name,
      avatarUrl: dto.avatarUrl,
    });

    if (!user.hasLoggedInOnce) {
      await this.mailService.queueWelcomeEmail(user.email, user.name);
    }

    await this.usersService.handleFirstLoginReferralCheck(user._id.toString());

    const id = user._id.toString();
    const accessToken = await this.jwtService.signAsync({
      sub: id,
      email: user.email,
      role: user.role,
    });

    await this.activitiesService.queueCreate({
      userId: user._id,
      type: ActivityType.AUTH_LOGIN,
      category: ActivityCategory.AUTH,
      title: `Logged in with ${provider.toUpperCase()}`,
      description: `You logged in via ${provider}.`,
      activityUrl: '/dashboard',
      entityType: 'user',
      entityId: user._id,
      actorType: ActivityActorType.USER,
      actorId: user._id,
      status: ActivityStatus.SUCCESS,
      severity: ActivitySeverity.INFO,
      metadata: { provider },
    });

    return { id, email: user.email, role: user.role, accessToken };
  }

  private generateOtp(): string {
    return randomInt(100000, 999999).toString(); // 6-digit numeric code
  }

  async verifyOtp(email: string, otp: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new BadRequestException('Invalid or expired code');
    }

    const isValid = await this.usersService.verifyOtpCode(user._id.toString(), otp);
    if (!isValid) {
      throw new BadRequestException('Invalid or expired code');
    }

    await this.usersService.markEmailVerified(user._id.toString());
    await this.mailService.queueWelcomeEmail(user.email, user.name);
    await this.usersService.handleFirstLoginReferralCheck(user._id.toString());

    const accessToken = await this.jwtService.signAsync({
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    await this.activitiesService.queueCreate({
      userId: user._id,
      type: ActivityType.AUTH_LOGIN,
      category: ActivityCategory.AUTH,
      title: 'Email verified and logged in',
      description: 'Your email was verified and you logged in.',
      activityUrl: '/dashboard',
      entityType: 'user',
      entityId: user._id,
      actorType: ActivityActorType.USER,
      actorId: user._id,
      status: ActivityStatus.SUCCESS,
      severity: ActivitySeverity.INFO,
    });

    return { message: 'Email verified successfully', accessToken };
  }

  async resendOtp(email: string) {
    const user = await this.usersService.findByEmail(email);
    // Same "don't reveal if the email exists" principle as password reset
    if (!user) {
      return { message: 'If that email exists, a new code was sent' };
    }
    if (user.emailVerified) {
      return { message: 'This email is already verified' };
    }

    const otp = this.generateOtp();
    await this.usersService.setOtp(user._id.toString(), otp);
    await this.mailService.queueOtpEmail(user.email, otp);

    return { message: 'If that email exists, a new code was sent' };
  }

  async requestPasswordReset(email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      return { message: 'If that email exists, a reset link was sent' };
    }

    const resetToken = randomBytes(32).toString('hex');
    await this.usersService.setPasswordResetToken(user._id.toString(), resetToken);
    await this.mailService.queuePasswordResetEmail(user.email, resetToken);

    await this.activitiesService.queueCreate({
      userId: user._id,
      type: ActivityType.AUTH_PASSWORD_RESET_REQUEST,
      category: ActivityCategory.AUTH,
      title: 'Password reset requested',
      description: 'A password reset link was sent to your email address.',
      activityUrl: '/login',
      entityType: 'user',
      entityId: user._id,
      actorType: ActivityActorType.USER,
      actorId: user._id,
      status: ActivityStatus.SUCCESS,
      severity: ActivitySeverity.INFO,
    });

    return { message: 'If that email exists, a reset link was sent' };
  }

  async resetPassword(token: string, newPassword: string) {
    const user = await this.usersService.findByValidResetToken(token);
    if (!user) {
      throw new BadRequestException('Invalid or expired reset link');
    }

    await this.usersService.resetPassword(user._id.toString(), newPassword);

    await this.activitiesService.queueCreate({
      userId: user._id,
      type: ActivityType.AUTH_PASSWORD_RESET_COMPLETE,
      category: ActivityCategory.AUTH,
      title: 'Password reset completed',
      description: 'Your account password was successfully reset.',
      activityUrl: '/login',
      entityType: 'user',
      entityId: user._id,
      actorType: ActivityActorType.USER,
      actorId: user._id,
      status: ActivityStatus.SUCCESS,
      severity: ActivitySeverity.SUCCESS,
    });

    return { message: 'Password reset successfully' };
  }
}