import { deflateSync } from 'node:zlib';
import { BadRequestException } from '@nestjs/common';

/** Original project-owned Blynta emoji artwork; no third-party assets.
 * No external graphics, fonts, network requests or model calls are used.
 * Explicit allowlist: unsupported sequences must ask for a PNG, never approximate.
 */
export const SUPPORTED_EMOJIS = [
  '😂',
  '😀',
  '😃',
  '😄',
  '😊',
  '😍',
  '😎',
  '😢',
  '😭',
  '❤',
  '❤️',
  '💙',
  '💚',
  '💛',
] as const;
const crcTable = Array.from({ length: 256 }, (_, n) => {
  for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
function chunk(type: string, data: Buffer) {
  const body = Buffer.concat([Buffer.from(type), data]);
  let crc = 0xffffffff;
  for (const b of body) crc = crcTable[(crc ^ b) & 255] ^ (crc >>> 8);
  const head = Buffer.alloc(4),
    tail = Buffer.alloc(4);
  head.writeUInt32BE(data.length);
  tail.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([head, body, tail]);
}
export function emojiPng(emoji: string, size = 256): Buffer {
  if (
    !SUPPORTED_EMOJIS.some((e) => e === emoji) ||
    !Number.isInteger(size) ||
    size < 32 ||
    size > 512
  )
    throw new BadRequestException(
      'Unsupported emoji or size; choose a supported emoji at 32–512 pixels or upload a PNG',
    );
  const ellipse = (
    x: number,
    y: number,
    cx: number,
    cy: number,
    rx: number,
    ry: number,
  ) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
  const heart = (
    x: number,
    y: number,
    cx: number,
    cy: number,
    scale: number,
  ) => {
    const a = (x - cx) / scale,
      b = -(y - cy) / scale;
    return (a * a + b * b - 1) ** 3 - a * a * b * b * b <= 0;
  };
  const isHeart = /[❤💙💚💛]/u.test(emoji);
  const heartColor =
    emoji === '💙'
      ? [45, 135, 240]
      : emoji === '💚'
        ? [61, 180, 99]
        : emoji === '💛'
          ? [255, 201, 40]
          : [239, 65, 89];
  function sample(x: number, y: number): number[] | undefined {
    if (isHeart) return heart(x, y, 0.5, 0.48, 0.33) ? heartColor : undefined;
    let c: number[] | undefined = ellipse(x, y, 0.5, 0.5, 0.4, 0.4)
      ? [255, 202, 47]
      : undefined;
    if (!c) return;
    const dark = [74, 43, 31];
    for (const cx of [0.35, 0.65]) {
      if (emoji === '😍' && heart(x, y, cx, 0.39, 0.09)) c = heartColor;
      else if (
        emoji === '😎' &&
        Math.abs(x - cx) < 0.13 &&
        y > 0.32 &&
        y < 0.46
      )
        c = dark;
      else if (['😂', '😄', '😊', '😭'].includes(emoji)) {
        const curve = 0.4 - 0.065 * (1 - ((x - cx) / 0.095) ** 2);
        if (Math.abs(x - cx) < 0.095 && Math.abs(y - curve) < 0.016) c = dark;
      } else if (ellipse(x, y, cx, 0.38, 0.027, 0.045)) c = dark;
    }
    if (['😂', '😀', '😃', '😄', '😍'].includes(emoji)) {
      if (ellipse(x, y, 0.5, 0.58, 0.19, 0.19) && y > 0.56) c = dark;
      if (ellipse(x, y, 0.5, 0.58, 0.165, 0.12) && y > 0.56 && y < 0.61)
        c = [255, 255, 255];
    } else if (['😢', '😭'].includes(emoji)) {
      if (
        Math.abs(y - (0.69 - 0.08 * (1 - ((x - 0.5) / 0.14) ** 2))) < 0.016 &&
        Math.abs(x - 0.5) < 0.14
      )
        c = dark;
    } else if (
      ellipse(x, y, 0.5, 0.54, 0.19, 0.17) &&
      !ellipse(x, y, 0.5, 0.52, 0.19, 0.17) &&
      y > 0.57
    )
      c = dark;
    if (['😂', '😢', '😭'].includes(emoji)) {
      for (const cx of emoji === '😢' ? [0.69] : [0.25, 0.75])
        if (ellipse(x, y, cx, 0.54, 0.045, 0.09)) c = [63, 168, 239];
    }
    return c;
  }
  return rasterPng(size, sample);
}

export const SUPPORTED_SHAPES = ['arrow', 'rectangle'] as const;
export function shapePng(shape: string, color = '#3388ff', size = 256) {
  if (
    !SUPPORTED_SHAPES.some((s) => s === shape) ||
    !/^#[a-f\d]{6}$/i.test(color) ||
    !Number.isInteger(size) ||
    size < 32 ||
    size > 512
  )
    throw new BadRequestException(
      'Choose arrow or rectangle, a hex color, and a size of 32–512 pixels',
    );
  const rgb = [1, 3, 5].map((start) =>
    parseInt(color.slice(start, start + 2), 16),
  );
  return rasterPng(size, (x, y) => {
    const inside =
      shape === 'rectangle'
        ? x >= 0.1 && x <= 0.9 && y >= 0.2 && y <= 0.8
        : (x >= 0.1 && x <= 0.6 && y >= 0.4 && y <= 0.6) ||
          (x >= 0.5 && x <= 0.9 && Math.abs(y - 0.5) <= (0.9 - x) * 0.75);
    return inside ? rgb : undefined;
  });
}

function rasterPng(
  size: number,
  sample: (x: number, y: number) => number[] | undefined,
): Buffer {
  const pixels = Buffer.alloc((size * 4 + 1) * size);
  // Four samples per pixel smooth edges and preserve transparent padding.
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const sum = [0, 0, 0];
      let count = 0;
      for (const dy of [0.25, 0.75])
        for (const dx of [0.25, 0.75]) {
          const color = sample((x + dx) / size, (y + dy) / size);
          if (color) {
            count++;
            for (let i = 0; i < 3; i++) sum[i] += color[i];
          }
        }
      const p = y * (size * 4 + 1) + 1 + x * 4;
      if (count) {
        for (let i = 0; i < 3; i++) pixels[p + i] = Math.round(sum[i] / count);
        pixels[p + 3] = Math.round((count / 4) * 255);
      }
    }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(pixels)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
