import type { VideoFaceDetection, DetectionFrame } from '../services/face-detection.service';

export interface CropPosition {
  /** Timestamp in seconds (source video timeline). */
  timestamp: number;
  /** Pixel X offset for the left edge of the 9:16 crop window. */
  cropX: number;
}

/** Options for the crop calculator. */
export interface FaceCropOptions {
  /**
   * Exponential smoothing factor (0–1).
   * Lower = smoother transitions, higher = more responsive.
   * Default: 0.15
   */
  smoothingAlpha?: number;
  /**
   * Maximum pixels the crop window can move per second of video.
   * Prevents abrupt jumps on fast movement. Default: 300 px/s.
   */
  maxVelocityPxPerSec?: number;
  /**
   * Maximum temporal distance in seconds to search for nearest faces
   * when no detection lands strictly inside the highlight window.
   * Default: 3.0s.
   */
  maxBoundaryTemporalDistance?: number;
  /**
   * Minimum movement in pixels across the clip required to activate dynamic
   * crop expression. Below this threshold, static median crop is used.
   * Default: 60 px.
   */
  dynamicMovementThresholdPx?: number;
  /**
   * Force static or dynamic mode. If omitted, automatically determined
   * by dynamicMovementThresholdPx.
   */
  forceMode?: 'static' | 'dynamic';
}

export interface ClipCropResult {
  /** 'static' (single fixed offset) or 'dynamic' (FFmpeg expression). */
  mode: 'static' | 'dynamic';
  /** Crop X value passed to FFmpeg (integer number or clamped expression string). */
  cropX: number | string;
  /** The representative median crop X across the clip. */
  medianCropX: number;
}

/**
 * Calculate per-timestamp crop X positions for a 9:16 vertical clip given
 * MediaPipe face detection results.
 *
 * Returns null when no faces are detected at all, signalling the caller to
 * use its existing center-crop fallback.
 */
export function computeFaceCropPositions(
  detection: VideoFaceDetection,
  clipStartTime: number,
  clipEndTime: number,
  options: FaceCropOptions = {},
): CropPosition[] | null {
  const { sourceWidth, sourceHeight, frames } = detection;
  if (!frames.length) return null;

  const cropW = Math.round((sourceHeight * 9) / 16);
  if (cropW >= sourceWidth) {
    // Source is already narrow — no lateral cropping needed; fall back.
    return null;
  }

  const alpha = clamp(options.smoothingAlpha ?? 0.15, 0.01, 1.0);
  const maxVelocity = options.maxVelocityPxPerSec ?? 300;
  const maxBoundaryDist = options.maxBoundaryTemporalDistance ?? 3.0;

  // Filter frames within [clipStart, clipEnd] ± 1-second lookahead.
  const relevant = frames.filter(
    (f) => f.timestamp >= clipStartTime - 1 && f.timestamp <= clipEndTime + 1,
  );

  // Build a map of timestamp → ideal (unsmoothed) crop X based on face centers.
  const idealMap = new Map<number, number>();
  for (const frame of relevant) {
    const facesWithDetections = frame.faces.filter((f) => f.confidence > 0);
    if (!facesWithDetections.length) continue;

    const centerX = calculateTargetCenter(facesWithDetections, sourceWidth, cropW);
    const raw = clamp(
      Math.round(centerX - cropW / 2),
      0,
      sourceWidth - cropW,
    );
    idealMap.set(frame.timestamp, raw);
  }

  // Also search within maxBoundaryDist if idealMap is still empty (short clip between sampled frames)
  if (idealMap.size === 0) {
    const clipMid = (clipStartTime + clipEndTime) / 2;
    let nearestFrame: DetectionFrame | undefined;
    let minDistance = Infinity;

    for (const frame of frames) {
      if (!frame.faces.some((f) => f.confidence > 0)) continue;
      const dist = Math.abs(frame.timestamp - clipMid);
      if (dist < minDistance && dist <= maxBoundaryDist) {
        minDistance = dist;
        nearestFrame = frame;
      }
    }

    if (nearestFrame) {
      const activeFaces = nearestFrame.faces.filter((f) => f.confidence > 0);
      const centerX = calculateTargetCenter(activeFaces, sourceWidth, cropW);
      const raw = clamp(
        Math.round(centerX - cropW / 2),
        0,
        sourceWidth - cropW,
      );
      idealMap.set(nearestFrame.timestamp, raw);
    } else {
      return null;
    }
  }

  // Collect target timestamps within [clipStartTime, clipEndTime]
  let targetTimestamps = frames
    .map((f) => f.timestamp)
    .filter((t) => t >= clipStartTime && t <= clipEndTime)
    .sort((a, b) => a - b);

  // If no sampled frame fell strictly inside clip boundaries, use nearest key from idealMap
  if (!targetTimestamps.length) {
    const idealKeys = Array.from(idealMap.keys()).sort((a, b) => a - b);
    const clipMid = (clipStartTime + clipEndTime) / 2;
    let bestKey = idealKeys[0];
    let bestDist = Math.abs(bestKey - clipMid);

    for (const key of idealKeys) {
      const dist = Math.abs(key - clipMid);
      if (dist < bestDist) {
        bestDist = dist;
        bestKey = key;
      }
    }

    if (bestDist <= maxBoundaryDist) {
      targetTimestamps = [bestKey];
    } else {
      return null;
    }
  }

  const idealPositions: { t: number; x: number }[] = targetTimestamps.map((t) => ({
    t,
    x: interpolateIdeal(t, idealMap),
  }));

  // Apply exponential smoothing + velocity clamping.
  const smoothed: CropPosition[] = [];
  let prev: { t: number; x: number } | undefined;

  for (const { t, x } of idealPositions) {
    let smoothX: number;
    if (prev === undefined) {
      smoothX = x;
    } else {
      const dt = Math.max(t - prev.t, 0.001);
      const target = alpha * x + (1 - alpha) * prev.x;
      const delta = target - prev.x;
      const maxDelta = maxVelocity * dt;
      smoothX = prev.x + clamp(delta, -maxDelta, maxDelta);
    }
    smoothX = clamp(Math.round(smoothX), 0, sourceWidth - cropW);
    smoothed.push({ timestamp: t, cropX: smoothX });
    prev = { t, x: smoothX };
  }

  return smoothed;
}

/**
 * Returns a single representative median crop X for a clip.
 * Suitable for stationary clips (podcasts, seated speakers).
 */
export function computeMedianCropX(
  detection: VideoFaceDetection,
  clipStartTime: number,
  clipEndTime: number,
  options: FaceCropOptions = {},
): number | null {
  const positions = computeFaceCropPositions(
    detection,
    clipStartTime,
    clipEndTime,
    options,
  );
  if (!positions || !positions.length) return null;

  const sorted = [...positions].map((p) => p.cropX).sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/**
 * Resolves whether a clip should use static median crop or dynamic crop,
 * returning the appropriate cropX value (number or FFmpeg expression).
 */
export function resolveClipCrop(
  detection: VideoFaceDetection,
  clipStartTime: number,
  clipEndTime: number,
  options: FaceCropOptions = {},
): ClipCropResult | null {
  const positions = computeFaceCropPositions(
    detection,
    clipStartTime,
    clipEndTime,
    options,
  );
  if (!positions || !positions.length) return null;

  const cropXs = positions.map((p) => p.cropX);
  const sorted = [...cropXs].sort((a, b) => a - b);
  const medianCropX = sorted[Math.floor(sorted.length / 2)];

  const minX = sorted[0];
  const maxX = sorted[sorted.length - 1];
  const movement = maxX - minX;

  const threshold = options.dynamicMovementThresholdPx ?? 60;
  const isDynamicRequested =
    options.forceMode === 'dynamic' ||
    (options.forceMode !== 'static' && movement >= threshold && positions.length > 1);

  if (!isDynamicRequested) {
    return {
      mode: 'static',
      cropX: medianCropX,
      medianCropX,
    };
  }

  // Build dynamic piecewise linear expression for FFmpeg
  const expr = buildDynamicCropExpression(
    positions,
    clipStartTime,
    clipEndTime,
    detection.sourceWidth,
    Math.round((detection.sourceHeight * 9) / 16),
  );

  if (!expr) {
    return {
      mode: 'static',
      cropX: medianCropX,
      medianCropX,
    };
  }

  return {
    mode: 'dynamic',
    cropX: expr,
    medianCropX,
  };
}

/**
 * Build a clamped piecewise linear FFmpeg crop expression.
 * The expression uses timestamp variable `t` (which starts at 0 for `-ss before -i`).
 */
export function buildDynamicCropExpression(
  positions: CropPosition[],
  clipStartTime: number,
  clipEndTime: number,
  sourceWidth: number,
  cropW: number,
): string | null {
  if (positions.length <= 1) return null;

  const duration = Math.max(0.1, clipEndTime - clipStartTime);

  // Convert to relative time [0..duration] and deduplicate / downsample
  const keypoints: { t: number; x: number }[] = [];
  for (const pos of positions) {
    const relT = clamp(Number((pos.timestamp - clipStartTime).toFixed(3)), 0, duration);
    if (!keypoints.length || relT - keypoints[keypoints.length - 1].t >= 0.5) {
      keypoints.push({ t: relT, x: pos.cropX });
    }
  }

  // Ensure first keypoint is at t=0
  if (!keypoints.length) return null;
  if (keypoints[0].t > 0) {
    keypoints.unshift({ t: 0, x: keypoints[0].x });
  }
  // Ensure last keypoint covers duration
  if (keypoints[keypoints.length - 1].t < duration) {
    keypoints.push({ t: duration, x: keypoints[keypoints.length - 1].x });
  }

  if (keypoints.length === 1) return String(keypoints[0].x);

  // Limit to at most 12 keypoints to keep the FFmpeg filter expression compact and performant
  const downsampled = downsampleKeypoints(keypoints, 12);

  // Build nested if(lte(t, t_next), lerp, ...)
  let expr = String(downsampled[downsampled.length - 1].x);
  for (let i = downsampled.length - 2; i >= 0; i--) {
    const p0 = downsampled[i];
    const p1 = downsampled[i + 1];
    const dt = Math.max(0.001, p1.t - p0.t);
    const dx = p1.x - p0.x;
    // Linear segment: p0.x + (dx/dt)*(t - p0.t)
    const slope = (dx / dt).toFixed(2);
    const seg =
      dx === 0
        ? `${p0.x}`
        : `${p0.x}+${slope}*(t-${p0.t.toFixed(2)})`;
    expr = `if(lte(t\\,${p1.t.toFixed(2)})\\,${seg}\\,${expr})`;
  }

  // Wrap in min/max bounds: min(max(0, expr), iw-ow)
  const maxBound = sourceWidth - cropW;
  return `min(max(0\\,${expr})\\,${maxBound})`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Calculates target horizontal center for framing.
 *
 * Multi-speaker handling:
 * - If all visible faces fit within crop width `cropW`, frames them together
 *   using confidence-weighted centroid.
 * - If faces are spread out further than `cropW` (e.g. podcast guests far apart),
 *   averaging would place the camera on empty space between them. In this case,
 *   the dominant face (highest area × confidence) is selected and framed.
 */
function calculateTargetCenter(
  faces: Array<{ confidence: number; boundingBox: { x: number; y: number; width: number; height: number } }>,
  sourceWidth: number,
  cropW: number,
): number {
  if (!faces.length) return sourceWidth / 2;
  if (faces.length === 1) {
    return (faces[0].boundingBox.x + faces[0].boundingBox.width / 2) * sourceWidth;
  }

  // Calculate the total horizontal span across all visible faces
  const minLeft = Math.min(...faces.map((f) => f.boundingBox.x * sourceWidth));
  const maxRight = Math.max(
    ...faces.map((f) => (f.boundingBox.x + f.boundingBox.width) * sourceWidth),
  );
  const totalSpan = maxRight - minLeft;

  // Case 1: All faces fit inside the 9:16 vertical crop window
  if (totalSpan <= cropW) {
    let totalWeight = 0;
    let weightedX = 0;
    for (const face of faces) {
      const w = face.confidence;
      const centerPx =
        (face.boundingBox.x + face.boundingBox.width / 2) * sourceWidth;
      weightedX += centerPx * w;
      totalWeight += w;
    }
    return totalWeight > 0 ? weightedX / totalWeight : (minLeft + maxRight) / 2;
  }

  // Case 2: Faces are too far apart to fit in one 9:16 crop.
  // Avoid centering on empty space between speakers! Select dominant face by area × confidence.
  let bestScore = -1;
  let dominantFace = faces[0];

  for (const face of faces) {
    const area = face.boundingBox.width * face.boundingBox.height;
    const score = area * face.confidence;
    if (score > bestScore) {
      bestScore = score;
      dominantFace = face;
    }
  }

  return (dominantFace.boundingBox.x + dominantFace.boundingBox.width / 2) * sourceWidth;
}

function interpolateIdeal(t: number, idealMap: Map<number, number>): number {
  const direct = idealMap.get(t);
  if (direct !== undefined) return direct;

  let bestDist = Infinity;
  let bestX = 0;
  for (const [ts, x] of idealMap) {
    const d = Math.abs(ts - t);
    if (d < bestDist) {
      bestDist = d;
      bestX = x;
    }
  }
  return bestX;
}

function downsampleKeypoints(
  pts: { t: number; x: number }[],
  maxCount: number,
): { t: number; x: number }[] {
  if (pts.length <= maxCount) return pts;
  const result: { t: number; x: number }[] = [pts[0]];
  const step = (pts.length - 1) / (maxCount - 1);
  for (let i = 1; i < maxCount - 1; i++) {
    const idx = Math.round(i * step);
    result.push(pts[idx]);
  }
  result.push(pts[pts.length - 1]);
  return result;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
