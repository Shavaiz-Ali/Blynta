import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';
import { UsersService } from '../users/users.service';

export const digest = (value: string) =>
  createHash('sha256').update(value).digest('base64url');
const SESSION_TTL = 7 * 24 * 60 * 60;
type Identity = { userId: string; root?: string; expiresAt: number };
export type AuthorizationRequest = {
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
  code_challenge_method: string;
  state: string;
  response_type: string;
};

@Injectable()
export class SsoService {
  constructor(
    @Inject(REDIS_CLIENT) private redis: Redis,
    private config: ConfigService,
    private users: UsersService,
    private jwt: JwtService,
  ) {}

  validateRequest(request: AuthorizationRequest) {
    let clients: Record<string, string[]>;
    try {
      clients = JSON.parse(
        this.config.get<string>('SSO_CLIENTS', '{}'),
      ) as Record<string, string[]>;
    } catch {
      throw new BadRequestException('Invalid client configuration');
    }
    const callbacks = Object.prototype.hasOwnProperty.call(
      clients,
      request.client_id,
    )
      ? clients[request.client_id]
      : undefined;
    if (!Array.isArray(callbacks) || !callbacks.includes(request.redirect_uri))
      throw new BadRequestException('Invalid authorization request');
    const url = new URL(request.redirect_uri);
    const local = ['localhost', '127.0.0.1'].includes(url.hostname);
    if (
      url.username ||
      url.password ||
      url.hash ||
      url.search ||
      (url.protocol !== 'https:' &&
        !(
          local &&
          url.protocol === 'http:' &&
          this.config.get('NODE_ENV') !== 'production'
        ))
    )
      throw new BadRequestException('Invalid authorization request');
    if (
      request.response_type !== 'code' ||
      request.code_challenge_method !== 'S256' ||
      !/^[A-Za-z0-9_-]{43}$/.test(request.code_challenge) ||
      !/^[A-Za-z0-9_-]{32,128}$/.test(request.state)
    )
      throw new BadRequestException('Invalid authorization request');
  }

  async createIdentity(
    userId: string,
    root?: string,
    expiresAt = Date.now() + SESSION_TTL * 1000,
  ) {
    const secret = randomBytes(32).toString('base64url');
    const identity: Identity = { userId, root, expiresAt };
    await this.redis.set(
      `sso:session:${digest(secret)}`,
      JSON.stringify(identity),
      'EX',
      Math.max(1, Math.floor((expiresAt - Date.now()) / 1000)),
    );
    return { sessionToken: secret, expiresAt };
  }

  async identity(secret: string): Promise<Identity> {
    if (!/^[A-Za-z0-9_-]{43}$/.test(secret || ''))
      throw new UnauthorizedException('Session expired');
    const raw = await this.redis.get(`sso:session:${digest(secret)}`);
    if (!raw) throw new UnauthorizedException('Session expired');
    const identity = JSON.parse(raw) as Identity;
    if (
      identity.expiresAt <= Date.now() ||
      (identity.root &&
        !(await this.redis.exists(`sso:session:${identity.root}`)))
    )
      throw new UnauthorizedException('Session expired');
    const user = await this.users.findById(identity.userId);
    if (!user || !user.isActive)
      throw new UnauthorizedException('Session expired');
    return identity;
  }

  async authorize(secret: string, request: AuthorizationRequest) {
    this.validateRequest(request);
    const identity = await this.identity(secret);
    if (identity.root)
      throw new UnauthorizedException('Central identity required');
    const code = randomBytes(32).toString('base64url');
    await this.redis.set(
      `sso:code:${digest(code)}`,
      JSON.stringify({
        client_id: request.client_id,
        redirect_uri: request.redirect_uri,
        response_type: request.response_type,
        state: request.state,
        code_challenge: request.code_challenge,
        code_challenge_method: request.code_challenge_method,
        userId: identity.userId,
        root: digest(secret),
        expiresAt: identity.expiresAt,
      }),
      'EX',
      60,
    );
    return { code, state: request.state, redirect_uri: request.redirect_uri };
  }

  async exchange(body: {
    code: string;
    client_id: string;
    redirect_uri: string;
    code_verifier: string;
    grant_type: string;
  }) {
    if (
      body.grant_type !== 'authorization_code' ||
      !/^[A-Za-z0-9_-]{43}$/.test(body.code || '') ||
      !/^[A-Za-z0-9._~-]{43,128}$/.test(body.code_verifier || '')
    )
      throw new BadRequestException('Invalid grant');
    const key = `sso:code:${digest(body.code)}`;
    const raw = await this.redis.get(key);
    if (!raw) throw new BadRequestException('Invalid grant');
    const grant = JSON.parse(raw) as AuthorizationRequest & Identity;
    if (
      grant.client_id !== body.client_id ||
      grant.redirect_uri !== body.redirect_uri ||
      grant.code_challenge !== digest(body.code_verifier) ||
      !grant.root ||
      !(await this.redis.exists(`sso:session:${grant.root}`))
    )
      throw new BadRequestException('Invalid grant');
    // Compare and delete atomically: concurrent exchanges can never both succeed.
    const consumed = await this.redis.eval(
      "if redis.call('GET',KEYS[1]) == ARGV[1] then return redis.call('DEL',KEYS[1]) else return 0 end",
      1,
      key,
      raw,
    );
    if (consumed !== 1) throw new BadRequestException('Invalid grant');
    const session = await this.createIdentity(
      grant.userId,
      grant.root,
      grant.expiresAt,
    );
    return { ...session, ...(await this.token(session.sessionToken)) };
  }

  async token(secret: string) {
    const identity = await this.identity(secret);
    const user = await this.users.findById(identity.userId);
    if (!user) throw new UnauthorizedException('Session expired');
    const accessToken = await this.jwt.signAsync(
      {
        sub: identity.userId,
        email: user.email,
        role: user.role,
        sid: digest(secret),
      },
      { expiresIn: 300 },
    );
    return {
      id: identity.userId,
      email: user.email,
      role: user.role,
      accessToken,
      accessTokenExpires: Date.now() + 300000,
    };
  }

  async validateSessionHash(hash: string, userId: string) {
    const raw = await this.redis.get(`sso:session:${hash}`);
    if (!raw) throw new UnauthorizedException();
    const identity = JSON.parse(raw) as Identity;
    if (
      identity.userId !== userId ||
      identity.expiresAt <= Date.now() ||
      (identity.root &&
        !(await this.redis.exists(`sso:session:${identity.root}`)))
    )
      throw new UnauthorizedException();
  }

  async revoke(secret: string, all = false) {
    const key = `sso:session:${digest(secret)}`;
    if (all) {
      const raw = await this.redis.get(key);
      if (raw) {
        const session = JSON.parse(raw) as Identity;
        if (session.root) await this.redis.del(`sso:session:${session.root}`);
      }
    }
    await this.redis.del(key);
  }

  async revokeUser(userId: string) {
    // Rare operation (password reset), bounded SCAN; never use blocking KEYS.
    let cursor = '0';
    do {
      const result = await this.redis.scan(
        cursor,
        'MATCH',
        'sso:session:*',
        'COUNT',
        100,
      );
      cursor = result[0];
      for (const key of result[1]) {
        const raw = await this.redis.get(key);
        if (raw && (JSON.parse(raw) as Identity).userId === userId)
          await this.redis.del(key);
      }
    } while (cursor !== '0');
  }
}
