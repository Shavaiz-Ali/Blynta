import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as crypto from 'crypto';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';
import {
  YouTubeConnection,
  YouTubeConnectionDocument,
} from './schemas/youtube-connection.schema';
import { encryptToken, decryptToken } from './utils/token-encryption.util';
import { YouTubeReauthRequiredException } from './exceptions/youtube-reauth-required.exception';

const OAUTH_STATE_TTL_SECONDS = 600; // 10 minutes
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const YOUTUBE_CHANNEL_URL =
  'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true';

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number; // seconds
  scope: string;
  token_type: string;
}

interface YouTubeChannelSnippet {
  title: string;
  thumbnails?: {
    default?: { url: string };
    medium?: { url: string };
  };
}

interface YouTubeChannelItem {
  id: string;
  snippet: YouTubeChannelSnippet;
}

@Injectable()
export class YouTubeOAuthService {
  private readonly logger = new Logger(YouTubeOAuthService.name);

  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly scopes: string;
  private readonly encryptionKey: string;

  constructor(
    @InjectModel(YouTubeConnection.name)
    private youtubeConnectionModel: Model<YouTubeConnectionDocument>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private configService: ConfigService,
  ) {
    this.clientId = this.configService.get<string>('GOOGLE_CLIENT_ID', '');
    this.clientSecret = this.configService.get<string>(
      'GOOGLE_CLIENT_SECRET',
      '',
    );
    this.redirectUri = this.configService.get<string>(
      'GOOGLE_REDIRECT_URI',
      '',
    );
    this.scopes = this.configService.get<string>(
      'YOUTUBE_OAUTH_SCOPES',
      [
        'https://www.googleapis.com/auth/youtube.readonly',
        'https://www.googleapis.com/auth/youtube.upload',
      ].join(' '),
    );
    this.encryptionKey = this.configService.get<string>(
      'TOKEN_ENCRYPTION_KEY',
      '',
    );
  }

  /**
   * Generates a Google OAuth 2.0 authorization URL.
   * Stores a CSRF state token in Redis keyed to the userId so we can
   * validate it in the callback without a session.
   */
  async getAuthorizationUrl(userId: string): Promise<string> {
    const state = `${userId}:${crypto.randomBytes(16).toString('hex')}`;
    // Store state in Redis — key: oauth_state:<state>, value: userId, TTL 10 min
    await this.redis.set(
      `oauth_state:${state}`,
      userId,
      'EX',
      OAUTH_STATE_TTL_SECONDS,
    );

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: this.scopes,
      access_type: 'offline',
      prompt: 'consent', // always prompt so we always get a refresh_token
      state,
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Validates OAuth state (CSRF check), exchanges the code for tokens,
   * fetches the connected channel, and persists the connection.
   *
   * Returns the userId encoded in the state so the caller can redirect correctly.
   */
  async handleCallback(
    code: string,
    state: string,
  ): Promise<{ userId: string }> {
    // --- CSRF / state validation ---
    const storedUserId = await this.redis.get(`oauth_state:${state}`);
    if (!storedUserId) {
      throw new Error(
        'Invalid or expired OAuth state. Please try connecting again.',
      );
    }
    // Consume the state — one-time use
    await this.redis.del(`oauth_state:${state}`);

    // --- Exchange code for tokens ---
    const tokens = await this.exchangeCodeForTokens(code);

    // --- Fetch YouTube channel info ---
    const channel = await this.fetchYouTubeChannel(tokens.access_token);

    // --- Encrypt and persist ---
    const encryptedAccess = encryptToken(
      tokens.access_token,
      this.encryptionKey,
    );
    const encryptedRefresh = tokens.refresh_token
      ? encryptToken(tokens.refresh_token, this.encryptionKey)
      : undefined;

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await this.youtubeConnectionModel
      .findOneAndUpdate(
        { userId: new Types.ObjectId(storedUserId) },
        {
          $set: {
            userId: new Types.ObjectId(storedUserId),
            channelId: channel.id,
            channelTitle: channel.snippet.title,
            channelThumbnail:
              channel.snippet.thumbnails?.medium?.url ||
              channel.snippet.thumbnails?.default?.url ||
              '',
            accessToken: encryptedAccess,
            ...(encryptedRefresh ? { refreshToken: encryptedRefresh } : {}),
            accessTokenExpiresAt: expiresAt,
            scope: tokens.scope,
          },
        },
        { upsert: true, new: true },
      )
      .exec();

    this.logger.log(
      `YouTube connection saved for user ${storedUserId} (channel: ${channel.snippet.title})`,
    );

    return { userId: storedUserId };
  }

  /**
   * Refreshes the access token using the stored refresh token.
   * Updates the connection document with new encrypted access token + expiry.
   * Throws YouTubeReauthRequiredException if the refresh token is invalid/revoked.
   */
  async refreshAccessToken(
    connection: YouTubeConnectionDocument,
  ): Promise<{ accessToken: string }> {
    const refreshToken = decryptToken(
      connection.refreshToken,
      this.encryptionKey,
    );

    let resp: GoogleTokenResponse;
    try {
      const response = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }).toString(),
      });

      const data = await response.json();
      if (!response.ok) {
        const errorCode = data?.error;
        this.logger.warn(
          `Token refresh failed for user ${connection.userId}: ${errorCode}`,
        );
        if (
          errorCode === 'invalid_grant' ||
          errorCode === 'token_revoked' ||
          errorCode === 'invalid_client'
        ) {
          throw new YouTubeReauthRequiredException();
        }
        throw new Error(
          data?.error_description || data?.error || 'Token refresh failed',
        );
      }

      resp = data as GoogleTokenResponse;
    } catch (err: any) {
      if (err instanceof YouTubeReauthRequiredException) {
        throw err;
      }
      throw err;
    }

    const newAccessToken = resp.access_token;
    const newExpiresAt = new Date(Date.now() + resp.expires_in * 1000);

    await this.youtubeConnectionModel
      .findByIdAndUpdate(connection._id, {
        $set: {
          accessToken: encryptToken(newAccessToken, this.encryptionKey),
          accessTokenExpiresAt: newExpiresAt,
        },
      })
      .exec();

    return { accessToken: newAccessToken };
  }

  /**
   * Decrypts and returns the current access token for a connection,
   * automatically refreshing it if it has expired (or is within 60s of expiry).
   */
  async getValidAccessToken(
    connection: YouTubeConnectionDocument,
  ): Promise<string> {
    const bufferMs = 60 * 1000; // 60 second buffer
    const isExpired =
      connection.accessTokenExpiresAt.getTime() - Date.now() < bufferMs;

    if (!isExpired) {
      return decryptToken(connection.accessToken, this.encryptionKey);
    }

    this.logger.log(
      `Access token expired for user ${connection.userId} — refreshing`,
    );
    const { accessToken } = await this.refreshAccessToken(connection);
    return accessToken;
  }

  /**
   * Revokes the user's access token with Google and deletes the connection.
   */
  async revokeAndDelete(userId: string): Promise<void> {
    const connection = await this.youtubeConnectionModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .select('+accessToken +refreshToken')
      .exec();

    if (!connection) return;

    // Best-effort token revocation — don't fail if Google returns an error
    try {
      const accessToken = decryptToken(
        connection.accessToken,
        this.encryptionKey,
      );
      await fetch(
        `${GOOGLE_REVOKE_URL}?token=${encodeURIComponent(accessToken)}`,
        {
          method: 'POST',
        },
      );
    } catch (err: any) {
      this.logger.warn(`Token revocation failed (non-fatal): ${err?.message}`);
    }

    await this.youtubeConnectionModel.findByIdAndDelete(connection._id).exec();

    this.logger.log(`YouTube connection deleted for user ${userId}`);
  }

  /**
   * Returns connection document by userId without sensitive tokens.
   */
  async findConnectionByUserId(
    userId: string,
  ): Promise<YouTubeConnectionDocument | null> {
    return this.youtubeConnectionModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .exec();
  }

  /**
   * Returns connection document with encrypted tokens included.
   * Internal use only (processor / token refresh).
   */
  async findConnectionWithTokens(
    userId: string,
  ): Promise<YouTubeConnectionDocument | null> {
    return this.youtubeConnectionModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .select('+accessToken +refreshToken')
      .exec();
  }

  // ---------------------------------------------------------------------------
  // Private Google OAuth / YouTube API helpers
  // ---------------------------------------------------------------------------

  private async exchangeCodeForTokens(
    code: string,
  ): Promise<GoogleTokenResponse> {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(
        `Failed to exchange authorization code: ${data?.error_description || data?.error || 'Unknown error'}`,
      );
    }

    return data as GoogleTokenResponse;
  }

  private async fetchYouTubeChannel(
    accessToken: string,
  ): Promise<YouTubeChannelItem> {
    const response = await fetch(YOUTUBE_CHANNEL_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(
        `Failed to fetch YouTube channel details: ${data?.error?.message || 'Unknown error'}`,
      );
    }

    const items: YouTubeChannelItem[] = data.items;
    if (!items || items.length === 0) {
      throw new Error(
        'No YouTube channel found for this Google account. Please create a channel first.',
      );
    }

    return items[0];
  }
}
