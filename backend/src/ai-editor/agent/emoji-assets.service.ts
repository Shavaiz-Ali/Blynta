import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { createHash } from 'node:crypto';
import type { StudioAsset } from '../../studio/studio.schemas';
import { R2Service } from '../../storage/r2.service';
import { emojiPng, shapePng } from './emoji-artwork';

@Injectable()
export class EmojiAssetsService {
  constructor(
    @InjectModel('StudioAsset') private assets: Model<StudioAsset>,
    private r2: R2Service,
  ) {}
  async generate(userId: string, emoji: string, size = 256) {
    const png = emojiPng(emoji, size);
    return this.store(userId, png, `${emoji} emoji`, size, 'emoji');
  }
  async generateShape(
    userId: string,
    shape: string,
    color?: string,
    size = 256,
  ) {
    return this.store(
      userId,
      shapePng(shape, color, size),
      `${color ?? '#3388ff'} ${shape}`,
      size,
      'shape',
    );
  }
  private async store(
    userId: string,
    png: Buffer,
    name: string,
    size: number,
    kind: 'emoji' | 'shape',
  ) {
    const hash = createHash('sha256').update(png).digest('hex');
    const assetId = kind + '-' + hash;
    const identity = { userId, projectId: 'generated-emoji', assetId };
    const ready = await this.assets.findOne({ ...identity, status: 'ready' });
    if (!ready) {
      // Durable intent before PUT: interrupted uploads are retried at the same
      // owner-scoped key. No temporary object keys or local files are created.
      const storageKey = `job-sources/assets/${userId}/${assetId}.png`;
      try {
        await this.assets.updateOne(
          identity,
          {
            $setOnInsert: {
              ...identity,
              storageKey,
              name,
              kind: 'image',
              mimeType: 'image/png',
              size: png.length,
              width: size,
              height: size,
              duration: 0,
              hasAudio: false,
              status: 'pending',
              sourceGroup: 'generated',
            },
          },
          { upsert: true },
        );
      } catch (error) {
        if ((error as { code?: number }).code !== 11000) throw error;
      }
      await this.r2.uploadBuffer(png, storageKey, 'image/png');
      const info = await this.r2.objectInfo(storageKey);
      if (info.size !== png.length || info.contentType !== 'image/png')
        throw new Error('Generated asset upload verification failed');
      await this.assets.updateOne(identity, { $set: { status: 'ready' } });
    }
    return {
      assetId,
      mimeType: 'image/png' as const,
      width: size,
      height: size,
    };
  }
}
