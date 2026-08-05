import { Body, Controller, Get, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthProviderConfigService } from './auth-provider-config.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import { SocialLoginDto } from './dto/social-login.dto';
import { AuthProvider } from '../users/schemas/user.schema';
import { ProviderDisabledException } from '../common/exceptions';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private providerConfigService: AuthProviderConfigService,
  ) { }

  // Frontend calls this to know which login buttons to render
  @Get('providers')
  getEnabledProviders() {
    return this.providerConfigService.getEnabledProviders();
  }

  @Post('signup')
  signup(@Body() dto: CreateUserDto) {
    return this.authService.signup(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.validateLogin(dto);
  }

  @Post('google')
  async googleLogin(@Body() dto: SocialLoginDto) {
    const enabled = await this.providerConfigService.isProviderEnabled(AuthProvider.GOOGLE);
    if (!enabled) throw new ProviderDisabledException('Google');
    return this.authService.validateSocialLogin(dto, AuthProvider.GOOGLE);
  }

  @Post('facebook')
  async facebookLogin(@Body() dto: SocialLoginDto) {
    const enabled = await this.providerConfigService.isProviderEnabled(AuthProvider.FACEBOOK);
    if (!enabled) throw new ProviderDisabledException('Facebook');
    return this.authService.validateSocialLogin(dto, AuthProvider.FACEBOOK);
  }

  @Post('verify-otp')
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto.email, dto.otp);
  }

  @Post('resend-otp')
  resendOtp(@Body() dto: ResendOtpDto) {
    return this.authService.resendOtp(dto.email);
  }

  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.requestPasswordReset(dto.email);
  }

  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

  // Adding Apple/Facebook later = copy-pasting one of the two methods above, swapping the enum value
}