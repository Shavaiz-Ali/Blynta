import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Inject,
  Injectable,
} from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';

@Injectable()
export class BillingRateLimitGuard implements CanActivate {
  constructor(@Inject(REDIS_CLIENT) private redis: Redis) {}
  async canActivate(context: ExecutionContext) {
    const req = context
      .switchToHttp()
      .getRequest<{ user?: { userId: string }; method: string }>();
    const category = req.method === 'GET' ? 'read' : 'write';
    const n = Number(
      await this.redis.eval(
        "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],60) end; return n",
        1,
        `billing:limit:${req.user?.userId}:${category}`,
      ),
    );
    if (n > (category === 'read' ? 120 : 30))
      throw new HttpException(
        'Too many billing requests. Try again shortly.',
        429,
      );
    return true;
  }
}
