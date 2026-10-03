import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Inject,
  Injectable,
} from '@nestjs/common';
import Redis from 'ioredis';
import { createHash } from 'crypto';
import { REDIS_CLIENT } from '../redis/redis.module';

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  constructor(@Inject(REDIS_CLIENT) private redis: Redis) {}
  async canActivate(context: ExecutionContext) {
    const req = context
      .switchToHttp()
      .getRequest<{ ip: string; path: string; body?: { email?: string } }>();
    const key = `auth:limit:${createHash('sha256').update(`${req.ip}:${req.path}`).digest('hex')}`;
    const count = (await this.redis.eval(
      "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],60) end; return n",
      1,
      key,
    )) as number;
    const limit = req.path.endsWith('/sso/session')
      ? 3000
      : req.path.startsWith('/auth/sso/')
        ? 600
        : req.path.endsWith('/providers')
          ? 300
          : 30;
    if (typeof req.body?.email === 'string') {
      const account = createHash('sha256')
        .update(req.body.email.trim().toLowerCase())
        .digest('hex');
      const attempts = (await this.redis.eval(
        "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],60) end; return n",
        1,
        `auth:account:${req.path}:${account}`,
      )) as number;
      if (attempts > 10)
        throw new HttpException('Too many attempts. Try again later.', 429);
    }
    if (count > limit)
      throw new HttpException('Too many attempts. Try again later.', 429);
    return true;
  }
}
