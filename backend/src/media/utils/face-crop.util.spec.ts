import {
  computeFaceCropPositions,
  computeMedianCropX,
  resolveClipCrop,
  buildDynamicCropExpression,
} from './face-crop.util';
import type { VideoFaceDetection } from '../services/face-detection.service';

/** Helper: build a VideoFaceDetection with arbitrary faces per frame. */
function makeDetection(
  frames: Array<{
    t: number;
    faces: Array<{
      x: number;
      y?: number;
      w: number;
      h?: number;
      confidence?: number;
    }>;
  }>,
  sourceWidth = 1920,
  sourceHeight = 1080,
): VideoFaceDetection {
  return {
    sourceWidth,
    sourceHeight,
    frames: frames.map(({ t, faces }) => ({
      timestamp: t,
      faces: faces.map((f) => ({
        confidence: f.confidence ?? 0.9,
        boundingBox: {
          x: f.x,
          y: f.y ?? 0.1,
          width: f.w,
          height: f.h ?? 0.4,
        },
      })),
    })),
  };
}

describe('computeFaceCropPositions', () => {
  const cropW = Math.round((1080 * 9) / 16); // 608 px

  it('returns null when there are no frames', () => {
    const d: VideoFaceDetection = { sourceWidth: 1920, sourceHeight: 1080, frames: [] };
    expect(computeFaceCropPositions(d, 0, 10)).toBeNull();
  });

  it('returns null when source is already narrow (cropW >= sourceWidth)', () => {
    const d: VideoFaceDetection = {
      sourceWidth: 400,
      sourceHeight: 1080,
      frames: [{ timestamp: 0, faces: [{ confidence: 0.9, boundingBox: { x: 0.4, y: 0.1, width: 0.2, height: 0.6 } }] }],
    };
    expect(computeFaceCropPositions(d, 0, 10)).toBeNull();
  });

  it('centres crop on a single face at frame centre (normX=0.5)', () => {
    // Face centered at 0.5 (x=0.4, w=0.2) -> pixel center = 960, cropX = 960 - 608/2 = 656
    const d = makeDetection([{ t: 0, faces: [{ x: 0.4, w: 0.2 }] }]);
    const positions = computeFaceCropPositions(d, 0, 1);
    expect(positions).not.toBeNull();
    const expected = Math.round(960 - cropW / 2);
    expect(Math.abs(positions![0].cropX - expected)).toBeLessThan(5);
  });

  it('clamps cropX to [0, sourceWidth - cropW]', () => {
    const d = makeDetection([{ t: 0, faces: [{ x: 0.9, w: 0.1 }] }]);
    const positions = computeFaceCropPositions(d, 0, 1);
    expect(positions).not.toBeNull();
    expect(positions![0].cropX).toBe(1920 - cropW);
  });

  describe('multi-speaker handling', () => {
    it('uses weighted centroid when multiple faces fit inside 9:16 window', () => {
      // Two faces: face1 at [0.4, 0.48] (~768-921px), face2 at [0.52, 0.6] (~998-1152px)
      // Total span = 1152 - 768 = 384px < cropW (608px) -> fits inside window!
      const d = makeDetection([
        {
          t: 0,
          faces: [
            { x: 0.4, w: 0.08, confidence: 0.9 }, // center ~0.44 -> 844.8px
            { x: 0.52, w: 0.08, confidence: 0.9 }, // center ~0.56 -> 1075.2px
          ],
        },
      ]);
      const positions = computeFaceCropPositions(d, 0, 1);
      expect(positions).not.toBeNull();
      // Centroid = (844.8 + 1075.2)/2 = 960px -> cropX = 960 - 304 = 656
      const expected = Math.round(960 - cropW / 2);
      expect(Math.abs(positions![0].cropX - expected)).toBeLessThan(5);
    });

    it('selects dominant face when faces are too far apart to fit in 9:16 window', () => {
      // Two distant speakers across podcast table:
      // Speaker A (left): [0.1, 0.25] (192 - 480px), smaller face (area = 0.15 * 0.2 = 0.03)
      // Speaker B (right, primary): [0.75, 0.95] (1440 - 1824px), larger face (area = 0.2 * 0.4 = 0.08)
      // Total span = 1824 - 192 = 1632px >> 608px (cannot fit both!)
      const d = makeDetection([
        {
          t: 0,
          faces: [
            { x: 0.1, w: 0.15, h: 0.2, confidence: 0.9 },
            { x: 0.75, w: 0.2, h: 0.4, confidence: 0.95 }, // dominant speaker
          ],
        },
      ]);
      const positions = computeFaceCropPositions(d, 0, 1);
      expect(positions).not.toBeNull();

      // Dominant speaker B center = (0.75 + 0.1) * 1920 = 1632px
      // Ideal cropX = 1632 - 304 = 1328px, clamped to 1920 - 608 = 1312px
      // Crucially, it MUST NOT center in the middle (960px) which would frame empty space!
      expect(positions![0].cropX).toBeGreaterThan(1200);
      expect(positions![0].cropX).toBeLessThanOrEqual(1920 - cropW);
    });
  });

  describe('timestamp boundary handling', () => {
    it('uses nearest detection for short highlights between sample points', () => {
      // Sampled frames are at t=0 and t=5. Highlight is at [2.2, 2.8].
      // Neither 0 nor 5 is inside [2.2, 2.8], but t=0 is 2.5s away (within 3.0s boundary limit)
      const d = makeDetection([
        { t: 0, faces: [{ x: 0.4, w: 0.2 }] },
        { t: 5, faces: [{ x: 0.4, w: 0.2 }] },
      ]);
      const positions = computeFaceCropPositions(d, 2.2, 2.8);
      expect(positions).not.toBeNull();
      expect(positions!.length).toBeGreaterThan(0);
    });

    it('returns null if nearest detection is too far away (> 3.0s)', () => {
      // Sampled frame is at t=0. Highlight is at [10.0, 15.0].
      // Distance is 10s > 3.0s max boundary -> should reject unrelated scene
      const d = makeDetection([{ t: 0, faces: [{ x: 0.4, w: 0.2 }] }]);
      const positions = computeFaceCropPositions(d, 10.0, 15.0);
      expect(positions).toBeNull();
    });
  });
});

describe('resolveClipCrop and dynamic cropping', () => {
  it('selects static median mode for stationary video (movement < threshold)', () => {
    // Subject is stationary (only 5px variation)
    const d = makeDetection([
      { t: 0, faces: [{ x: 0.4, w: 0.2 }] },
      { t: 1, faces: [{ x: 0.402, w: 0.2 }] },
      { t: 2, faces: [{ x: 0.4, w: 0.2 }] },
    ]);
    const res = resolveClipCrop(d, 0, 2);
    expect(res).not.toBeNull();
    expect(res!.mode).toBe('static');
    expect(typeof res!.cropX).toBe('number');
  });

  it('selects dynamic mode and generates FFmpeg expression for moving subject', () => {
    // Subject walks from left (normX=0.2 -> ~384px) to right (normX=0.8 -> ~1536px)
    const d = makeDetection([
      { t: 0, faces: [{ x: 0.1, w: 0.2 }] },
      { t: 2, faces: [{ x: 0.4, w: 0.2 }] },
      { t: 4, faces: [{ x: 0.7, w: 0.2 }] },
    ]);
    const res = resolveClipCrop(d, 0, 4);
    expect(res).not.toBeNull();
    expect(res!.mode).toBe('dynamic');
    expect(typeof res!.cropX).toBe('string');
    // FFmpeg expression contains min, max, and timestamp variable t
    expect(res!.cropX as string).toContain('min(max(0\\,');
    expect(res!.cropX as string).toContain('lte(t\\,');
  });

  it('allows forcing static mode even when movement is high', () => {
    const d = makeDetection([
      { t: 0, faces: [{ x: 0.1, w: 0.2 }] },
      { t: 2, faces: [{ x: 0.7, w: 0.2 }] },
    ]);
    const res = resolveClipCrop(d, 0, 2, { forceMode: 'static' });
    expect(res).not.toBeNull();
    expect(res!.mode).toBe('static');
    expect(typeof res!.cropX).toBe('number');
  });
});

describe('buildDynamicCropExpression', () => {
  it('returns valid FFmpeg expression within bounded range', () => {
    const positions = [
      { timestamp: 10, cropX: 300 },
      { timestamp: 12, cropX: 500 },
      { timestamp: 14, cropX: 700 },
    ];
    const expr = buildDynamicCropExpression(positions, 10, 14, 1920, 608);
    expect(expr).not.toBeNull();
    expect(expr).toContain('min(max(0\\,');
    expect(expr).toContain('1312'); // 1920 - 608
  });
});
