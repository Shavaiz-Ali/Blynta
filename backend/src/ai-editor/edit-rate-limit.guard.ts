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
export class EditRateLimitGuard implements CanActivate {
  constructor(@Inject(REDIS_CLIENT) private redis: Redis) {}
  async canActivate(context: ExecutionContext) {
    const req = context
      .switchToHttp()
      .getRequest<{ user: { userId: string }; method: string }>();
    const read = req.method === 'GET';
    const count = Number(
      await this.redis.eval(
        "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],60) end; return n",
        1,
        `editing:limit:${req.user.userId}:${read ? 'read' : 'write'}`,
      ),
    );
    if (count > (read ? 120 : 20))
      throw new HttpException(
        'Too many editing requests; retry in one minute',
        429,
      );
    return true;
  }
}
