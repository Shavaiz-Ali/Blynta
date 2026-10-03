import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';

/** Only the central Auth.js server may submit identities verified by its OAuth callbacks. */
@Injectable()
export class SsoBridgeGuard implements CanActivate {
  constructor(private config: ConfigService) {}
  canActivate(context: ExecutionContext) {
    const value = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, unknown> }>().headers[
      'x-blynta-auth-bridge'
    ];
    const expected = this.config.get<string>('SSO_BRIDGE_SECRET');
    if (
      !expected ||
      typeof value !== 'string' ||
      Buffer.byteLength(value) !== Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(value), Buffer.from(expected))
    )
      throw new UnauthorizedException();
    return true;
  }
}
