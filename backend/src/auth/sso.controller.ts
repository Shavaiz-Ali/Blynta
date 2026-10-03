import {
  Body,
  Controller,
  Headers,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SsoService } from './sso.service';
import { AuthRateLimitGuard } from './auth-rate-limit.guard';

class SessionDto extends createZodDto(
  z.object({ sessionToken: z.string().length(43) }),
) {}
class IdentityDto extends createZodDto(
  z.object({ accessToken: z.string().min(1) }),
) {}
class LogoutDto extends createZodDto(
  z.object({
    sessionToken: z.string().length(43),
    scope: z.enum(['product', 'all']).default('all'),
  }),
) {}
class AuthorizeDto extends createZodDto(
  z.object({
    sessionToken: z.string().length(43),
    client_id: z.string(),
    redirect_uri: z.string().url(),
    response_type: z.literal('code'),
    state: z.string(),
    code_challenge: z.string(),
    code_challenge_method: z.literal('S256'),
  }),
) {}
class AuthorizationRequestDto extends createZodDto(
  z.object({
    client_id: z.string(),
    redirect_uri: z.string().url(),
    response_type: z.literal('code'),
    state: z.string(),
    code_challenge: z.string(),
    code_challenge_method: z.literal('S256'),
  }),
) {}
class ExchangeDto extends createZodDto(
  z.object({
    grant_type: z.literal('authorization_code'),
    code: z.string(),
    client_id: z.string(),
    redirect_uri: z.string().url(),
    code_verifier: z.string(),
  }),
) {}

@Controller('auth/sso')
@UseGuards(AuthRateLimitGuard)
export class SsoController {
  constructor(
    private sso: SsoService,
    private auth: AuthService,
    private config: ConfigService,
  ) {}

  private bridge(value: string | undefined) {
    const expected = this.config.get<string>('SSO_BRIDGE_SECRET');
    if (
      !expected ||
      !value ||
      Buffer.byteLength(value) !== Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(value), Buffer.from(expected))
    )
      throw new UnauthorizedException();
  }

  @Post('validate-request')
  validateRequest(@Body() dto: AuthorizationRequestDto) {
    this.sso.validateRequest(dto);
    return { valid: true };
  }

  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Headers('x-blynta-auth-bridge') bridge: string,
  ) {
    this.bridge(bridge);
    const user = await this.auth.validateLogin(dto);
    const session = await this.sso.createIdentity(user.id);
    return { ...session, ...(await this.sso.token(session.sessionToken)) };
  }

  @Post('identity')
  async identity(
    @Body() dto: IdentityDto,
    @Headers('x-blynta-auth-bridge') bridge: string,
  ) {
    this.bridge(bridge);
    const user = await this.auth.verifyIdentityToken(dto.accessToken);
    const session = await this.sso.createIdentity(user.sub);
    return { ...session, ...(await this.sso.token(session.sessionToken)) };
  }

  @Post('authorize')
  authorize(@Body() dto: AuthorizeDto) {
    return this.sso.authorize(dto.sessionToken, dto);
  }

  @Post('token')
  token(@Body() dto: ExchangeDto) {
    return this.sso.exchange(dto);
  }

  @Post('session')
  session(@Body() dto: SessionDto) {
    return this.sso.token(dto.sessionToken);
  }

  @Post('logout')
  async logout(@Body() dto: LogoutDto) {
    await this.sso.revoke(dto.sessionToken, dto.scope === 'all');
    return { success: true };
  }
}
