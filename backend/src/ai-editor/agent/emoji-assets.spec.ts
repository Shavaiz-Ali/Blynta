import { inflateSync } from 'node:zlib';
import { Model } from 'mongoose';
import { emojiPng, shapePng } from './emoji-artwork';
import { EmojiAssetsService } from './emoji-assets.service';
import type { StudioAsset } from '../../studio/studio.schemas';
import { R2Service } from '../../storage/r2.service';

describe('Deterministic emoji PNG assets', () => {
  it.each(['arrow', 'rectangle'])(
    'generates a transparent colored %s without model calls',
    (shape) => {
      const png = shapePng(shape, '#ff0000', 64);
      expect(png.readUInt32BE(16)).toBe(64);
      expect(png[25]).toBe(6);
      expect(shapePng(shape, '#ff0000', 64)).toEqual(png);
      expect(shapePng(shape, '#0000ff', 64)).not.toEqual(png);
    },
  );
  it('rejects unsafe shape and color input', () => {
    expect(() => shapePng('../../asset')).toThrow();
    expect(() => shapePng('arrow', 'red;run-command')).toThrow();
  });
  it.each(['😂', '❤️', '💙'])(
    'creates a transparent padded PNG for %s',
    (emoji) => {
      const png = emojiPng(emoji, 64);
      expect(png.subarray(0, 8)).toEqual(
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      );
      expect(png.readUInt32BE(16)).toBe(64);
      expect(png[25]).toBe(6); // RGBA
      const length = png.readUInt32BE(33);
      const pixels = inflateSync(png.subarray(41, 41 + length));
      expect(pixels[4]).toBe(0); // transparent corner
      expect(pixels.some((b) => b > 0)).toBe(true);
      expect(emojiPng(emoji, 64)).toEqual(png);
    },
  );
  it.each(['hello', '😂😂', '../../secret', '👩‍💻', ''])(
    'rejects unsupported input %s',
    (emoji) => {
      expect(() => emojiPng(emoji)).toThrow();
    },
  );
  it.each([0, 31, 513, NaN, 64.2])('bounds raster dimensions %s', (size) => {
    expect(() => emojiPng('😂', size)).toThrow();
  });
  function setup() {
    const records = new Map<string, Record<string, unknown>>();
    const assets = {
      findOne: jest.fn(
        ({ userId, assetId }: { userId: string; assetId: string }) =>
          Promise.resolve(records.get(`${userId}:${assetId}`)),
      ),
      updateOne: jest.fn(
        (
          identity: { userId: string; assetId: string },
          update: { $set?: { status: string } },
        ) => {
          if (update.$set?.status === 'ready')
            records.set(`${identity.userId}:${identity.assetId}`, {
              ...identity,
            });
          return Promise.resolve({});
        },
      ),
    };
    const r2 = {
      uploadBuffer: jest
        .fn<
          ReturnType<R2Service['uploadBuffer']>,
          Parameters<R2Service['uploadBuffer']>
        >()
        .mockResolvedValue('key'),
      objectInfo: jest.fn().mockImplementation(() =>
        Promise.resolve({
          size: emojiPng('😂').length,
          contentType: 'image/png',
        }),
      ),
    };
    const service = new EmojiAssetsService(
      assets as unknown as Model<StudioAsset>,
      r2 as unknown as R2Service,
    );
    return { service, assets, r2 };
  }
  it('reuses deterministic IDs on retries, with separate owner records and private keys', async () => {
    const s = setup();
    const one = await s.service.generate('owner', '😂');
    expect(await s.service.generate('owner', '😂')).toEqual(one);
    expect(s.r2.uploadBuffer).toHaveBeenCalledTimes(1);
    await s.service.generate('another-owner', '😂');
    expect(s.r2.uploadBuffer).toHaveBeenCalledTimes(2);
    expect(s.r2.uploadBuffer.mock.calls[1][1]).toContain(
      'job-sources/assets/another-owner/',
    );
  });
  it('stores shapes through the same verified, deduplicated owner-scoped asset library', async () => {
    const s = setup();
    s.r2.objectInfo.mockResolvedValueOnce({
      size: shapePng('rectangle', '#ff0000').length,
      contentType: 'image/png',
    });
    const generated = await s.service.generateShape(
      'owner',
      'rectangle',
      '#ff0000',
    );
    expect(generated.assetId).toMatch(/^shape-[a-f\d]{64}$/);
    expect(
      await s.service.generateShape('owner', 'rectangle', '#ff0000'),
    ).toEqual(generated);
    expect(s.r2.uploadBuffer).toHaveBeenCalledTimes(1);
  });
  it('does not publish a ready asset when upload fails; retry uses the same intent', async () => {
    const s = setup();
    s.r2.uploadBuffer.mockRejectedValueOnce(new Error('storage unavailable'));
    await expect(s.service.generate('owner', '😂')).rejects.toThrow(
      'storage unavailable',
    );
    expect(s.assets.updateOne).not.toHaveBeenCalledWith(expect.anything(), {
      $set: { status: 'ready' },
    });
    await s.service.generate('owner', '😂');
    expect(s.r2.uploadBuffer.mock.calls[0][1]).toBe(
      s.r2.uploadBuffer.mock.calls[1][1],
    );
  });
  it('verifies uploaded bytes before marking assets ready', async () => {
    const s = setup();
    s.r2.objectInfo.mockResolvedValueOnce({
      size: 1,
      contentType: 'image/png',
    });
    await expect(s.service.generate('owner', '😂')).rejects.toThrow(
      'verification failed',
    );
  });
});
