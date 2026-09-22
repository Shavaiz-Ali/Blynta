import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type YouTubeConnectionDocument = YouTubeConnection & Document;

/**
 * Stores a user's connected YouTube channel and their (encrypted) OAuth tokens.
 *
 * userId + channelId is unique — the same channel can't be connected to one
 * user twice. A user can only have one active connection (enforced at the
 * service layer: upsert by userId).
 */
@Schema({ timestamps: true })
export class YouTubeConnection {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  channelId: string; // e.g. "UCxxxxxx"

  @Prop({ required: true })
  channelTitle: string; // e.g. "Shavaiz Tech"

  @Prop()
  channelThumbnail: string; // profile picture URL

  /**
   * AES-256-GCM encrypted access token.
   * Never returned in API responses — select: false prevents accidental exposure.
   */
  @Prop({ required: true, select: false })
  accessToken: string;

  /**
   * AES-256-GCM encrypted refresh token.
   * Never returned in API responses.
   */
  @Prop({ required: true, select: false })
  refreshToken: string;

  /** When the current access token expires (UTC). */
  @Prop({ required: true })
  accessTokenExpiresAt: Date;

  /** OAuth scopes that were granted. */
  @Prop()
  scope: string;
}

export const YouTubeConnectionSchema =
  SchemaFactory.createForClass(YouTubeConnection);

// Enforce one connection per user (we upsert, so this is a safety net).
YouTubeConnectionSchema.index({ userId: 1 }, { unique: true });
// Also ensure the same channel can't be linked to two different users.
YouTubeConnectionSchema.index({ channelId: 1 }, { unique: true, sparse: true });
