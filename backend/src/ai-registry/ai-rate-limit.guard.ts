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
export class AIRateLimitGuard implements CanActivate {
  constructor(@Inject(REDIS_CLIENT) private redis: Redis) {}
  async canActivate(context: ExecutionContext) {
    const req = context
      .switchToHttp()
      .getRequest<{ user: { userId: string }; method: string; path: string }>();
    const costly = /\/(test|validate|propose)$/.test(req.path);
    const read = req.method === 'GET';
    const budget = costly ? 3 : read ? 120 : 20;
    const bucket = costly ? 'costly' : read ? 'read' : 'write';
    const n = Number(
      await this.redis.eval(
        "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],60) end; return n",
        1,
        'ai:rate:' + req.user.userId + ':' + bucket,
      ),
    );
    if (n > budget)
      throw new HttpException('AI request limit exceeded; retry later', 429);
    return true;
  }
}
