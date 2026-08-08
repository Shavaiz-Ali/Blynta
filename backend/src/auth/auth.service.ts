import { BadRequestException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import { SocialLoginDto } from './dto/social-login.dto';
import { AuthProvider } from '../users/schemas/user.schema';
import { InvalidCredentialsException } from '../common/exceptions';
import { randomBytes, randomInt } from 'crypto';
import { MailService } from 'src/mail/mail.service';

export interface AuthResult {
  id: string;
  email: string;
  role: string;
  accessToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private mailService: MailService,
    private jwtService: JwtService,
  ) { }

  async signup(dto: CreateUserDto) {
    const user = await this.usersService.create(dto);
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
    const id = user._id.toString();
    const accessToken = await this.jwtService.signAsync({
      sub: id,
      email: user.email,
      role: user.role,
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
    const id = user._id.toString();
    const accessToken = await this.jwtService.signAsync({
      sub: id,
      email: user.email,
      role: user.role,
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
    return { message: 'Email verified successfully' };
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

    return { message: 'If that email exists, a reset link was sent' };
  }

  async resetPassword(token: string, newPassword: string) {
    const user = await this.usersService.findByValidResetToken(token);
    if (!user) {
      throw new BadRequestException('Invalid or expired reset link');
    }

    await this.usersService.resetPassword(user._id.toString(), newPassword);
    return { message: 'Password reset successfully' };
  }
}