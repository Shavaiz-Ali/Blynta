import {
  Body,
  Controller,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { AuthService } from './auth.service';
import { AuthRateLimitGuard } from './auth-rate-limit.guard';
import { LoginDto } from './dto/login.dto';
import { SsoService } from './sso.service';

class AdminSessionDto extends createZodDto(
  z.object({ sessionToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }),
) {}

/** Uses existing Users, but never attaches an Admin session to a consumer root. */
@Controller('auth/admin')
@UseGuards(AuthRateLimitGuard)
export class AdminAuthController {
  constructor(
    private auth: AuthService,
    private sessions: SsoService,
  ) {}

  @Post('login')
  async login(@Body() dto: LoginDto) {
    const user = await this.auth.validateLogin(dto);
    if (user.role !== 'admin')
      throw new UnauthorizedException('Invalid administrator credentials');
    const session = await this.sessions.createIdentity(
      user.id,
      undefined,
      Date.now() + 8 * 60 * 60 * 1000,
      'admin',
    );
    return {
      ...session,
      ...(await this.sessions.token(session.sessionToken, 'admin')),
    };
  }

  @Post('session')
  session(@Body() dto: AdminSessionDto) {
    return this.sessions.token(dto.sessionToken, 'admin');
  }

  @Post('logout')
  async logout(@Body() dto: AdminSessionDto) {
    await this.sessions.revoke(dto.sessionToken, false, 'admin');
    return { success: true };
  }
}
