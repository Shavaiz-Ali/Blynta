import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateObject, NoObjectGeneratedError, RetryError } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { z } from 'zod';
import { TranscriptSegmentDto } from './transcription.service';
import {
  EDITOR_STYLES,
  EditorStyleKey,
  DEFAULT_EDITOR_STYLE_KEY,
} from '../editor-styles';
import { buildHighlightSystemPrompt } from '../prompts/highlight-detection.prompts';

// Zod needs a literal tuple of string values for z.enum(), not a plain
// string[] — this line derives that tuple from EDITOR_STYLES' actual keys
// at runtime/compile-time, so the enum can NEVER drift from what
// EDITOR_STYLES actually defines:
const EDITOR_STYLE_KEYS = Object.keys(EDITOR_STYLES) as [
  EditorStyleKey,
  ...EditorStyleKey[],
];

export const HighlightSchema = z.object({
  startTime: z.number().describe('Start time of the clip in seconds'),
  endTime: z.number().describe('End time of the clip in seconds'),
  reason: z
    .string()
    .max(300)
    .describe(
      'Short explanation of why this moment is engaging, 1-2 sentences',
    ),
  score: z
    .number()
    .describe(
      'Engagement score strictly between 0 and 1, e.g. 0.5, 0.82, 0.95. NEVER use a 0-10 or 0-100 scale.',
    )
    .transform((val) => {
      if (val > 1 && val <= 10) return val / 10;
      if (val > 10 && val <= 100) return val / 100;
      return val;
    })
    .pipe(z.number().min(0).max(1)),
  clipTitle: z
    .string()
    .max(80)
    .describe(
      'Short, punchy title under 60 characters, like a social media caption',
    ),
  clipDescription: z
    .string()
    .max(400)
    .describe(
      '1-2 sentence description explaining what makes this moment worth watching',
    ),
  tags: z
    .array(z.string().max(30))
    .optional()
    .default([])
    .describe(
      'List of 3-8 short, lowercase keywords or hashtag-style tags describing the clip content, topic, mood, and people involved (e.g. "comedy", "celebrity", "reaction"). No # symbol, use hyphens if a tag needs multiple words.',
    ),
  style: z
    .enum(EDITOR_STYLE_KEYS)
    .optional()
    .default(DEFAULT_EDITOR_STYLE_KEY)
    .describe(
      "Editing style selected based on this specific clip's context — see system prompt for the full list and criteria.",
    ),
  hookText: z
    .string()
    .max(100)
    .optional()
    .default('')
    .describe(
      'Contextual top-banner hook / overlay text for ffmpeg (e.g. "Wait for the end 🤯", "Watch till the end 👇", "Step 1 of 3", "The truth about startups")',
    ),
  emojis: z
    .array(z.string().max(10))
    .optional()
    .default([])
    .describe(
      '1-3 contextual emojis that match this moment and amplify reaction (e.g. ["🤯", "🔥"])',
    ),
});

export const HighlightsResponseSchema = z.object({
  videoTitle: z
    .string()
    .max(150)
    .optional()
    .default('')
    .describe('Punchy, clickable title under 100 characters'),
  videoDescription: z
    .string()
    .max(600)
    .optional()
    .default('')
    .describe(
      '2-4 sentences, max 500 characters, naturally weaving in relevant keywords and hashtags',
    ),
  keywords: z
    .string()
    .max(600)
    .optional()
    .default('')
    .describe(
      'Comma-separated SEO keywords/phrases for the whole video, max 500 characters total',
    ),
  hashtags: z
    .array(z.string().max(50))
    .optional()
    .default([])
    .describe('5-15 hashtags, each starting with #, lowercase, no spaces'),
  highlights: z.array(HighlightSchema),
});

export interface HighlightDto {
  startTime: number;
  endTime: number;
  reason: string;
  score: number;
  clipTitle: string;
  clipDescription: string;
  tags: string[];
  style: string;
  hookText?: string;
  emojis?: string[];
}

export interface HighlightDetectionResult {
  videoTitle: string;
  videoDescription: string;
  keywords: string;
  hashtags: string[];
  highlights: HighlightDto[];
}

const SDK_MAX_RETRIES = 0;

const CHUNK_CHAR_BUDGET = 3000; // ~750 tokens of transcript text per chunk
const CHUNK_MAX_OUTPUT_TOKENS = 2500; // generous room for hidden reasoning + final JSON
const CHUNK_OVERLAP_SECONDS = 45;
const MIN_SEGMENT_CHARS = 8;
const HIGHLIGHTS_PER_CHUNK = 2;
const FINAL_HIGHLIGHT_COUNT = 8;
const MAX_RATE_LIMIT_RETRIES = 3;

const TPM_LIMIT = 8000;
const TPM_SAFETY_MARGIN = 500;
const WINDOW_MS = 60_000;

@Injectable()
export class HighlightDetectionService {
  private readonly logger = new Logger(HighlightDetectionService.name);
  private readonly model: any;
  private readonly provider: string;
  private readonly resolvedModelName: string;
  private readonly usageLog: { timestamp: number; tokens: number }[] = [];

  constructor(private configService: ConfigService) {
    this.provider = this.configService
      .get<string>('LLM_PROVIDER', 'google')
      .toLowerCase();
    this.resolvedModelName = this.configService.get<string>(
      'LLM_MODEL_NAME',
      'gemini-3.5-flash-lite',
    );

    const apiKey =
      this.configService.get<string>('LLM_API_KEY') ||
      this.configService.get<string>('GROQ_API_KEY');

    if (!apiKey) {
      this.logger.error(
        'No API key found for HighlightDetectionService — set LLM_API_KEY (or GROQ_API_KEY) in .env',
      );
    }

    if (this.provider === 'groq') {
      const baseURL = this.configService.get<string>(
        'LLM_BASE_URL',
        'https://api.groq.com/openai/v1',
      );
      const openai = createOpenAI({ apiKey, baseURL });
      this.model = openai.chat(this.resolvedModelName);
    } else {
      const google = createGoogleGenerativeAI({ apiKey });
      this.model = google(this.resolvedModelName);
    }

    this.logger.log(
      `HighlightDetectionService initialized — provider=${this.provider}, model=${this.resolvedModelName}`,
    );
  }

  private recordUsage(tokens: number): void {
    this.usageLog.push({ timestamp: Date.now(), tokens });
  }

  private getUsageInWindow(): number {
    const cutoff = Date.now() - WINDOW_MS;
    while (this.usageLog.length > 0 && this.usageLog[0].timestamp < cutoff) {
      this.usageLog.shift();
    }
    return this.usageLog.reduce((sum, entry) => sum + entry.tokens, 0);
  }

  private async waitForBudget(estimatedTokens: number): Promise<void> {
    const budget = TPM_LIMIT - TPM_SAFETY_MARGIN;

    for (;;) {
      const used = this.getUsageInWindow();
      if (used + estimatedTokens <= budget) return;

      const oldest = this.usageLog[0];
      const msUntilOldestExpires = oldest
        ? oldest.timestamp + WINDOW_MS - Date.now()
        : 1000;
      const waitMs = Math.max(1000, msUntilOldestExpires + 200);

      this.logger.log(
        `Rate budget check: ${used}/${budget} tokens used in the last 60s, need room for ~${estimatedTokens} more — waiting ${Math.ceil(waitMs / 1000)}s`,
      );
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  private estimateRequestTokens(segments: TranscriptSegmentDto[]): number {
    const transcriptChars = segments.reduce(
      (sum, s) => sum + s.text.length + 20,
      0,
    );
    const inputTokens = Math.ceil(transcriptChars / 2);
    const overhead = 600;
    return inputTokens + overhead + CHUNK_MAX_OUTPUT_TOKENS;
  }

  async detectHighlights(
    segments: TranscriptSegmentDto[],
    options?: { customPrompt?: string; model?: string; videoDuration?: number },
  ): Promise<HighlightDto[]> {
    const res = await this.detectHighlightsWithMetadata(segments, options);
    return res.highlights;
  }

  async detectHighlightsWithMetadata(
    segments: TranscriptSegmentDto[],
    options?: { customPrompt?: string; model?: string; videoDuration?: number },
  ): Promise<HighlightDetectionResult> {
    const filtered = segments.filter(
      (s) => s.text.trim().length >= MIN_SEGMENT_CHARS,
    );
    if (filtered.length === 0) {
      this.logger.warn(
        'No segments remained after filtering filler — falling back to unfiltered segments',
      );
    }
    const usableSegments = filtered.length > 0 ? filtered : segments;

    if (this.provider === 'groq') {
      return this.detectHighlightsGroqWithMetadata(usableSegments, options);
    }

    return this.detectHighlightsDirectWithMetadata(usableSegments, options);
  }

  private async detectHighlightsDirectWithMetadata(
    segments: TranscriptSegmentDto[],
    options?: { customPrompt?: string; model?: string; videoDuration?: number },
  ): Promise<HighlightDetectionResult> {
    this.logger.log(
      `Detecting highlights for full transcript in a single call (${segments.length} segments) — provider=${this.provider}, model=${this.resolvedModelName}`,
    );

    const transcriptText = segments
      .map(
        (s) =>
          `[${s.startTime.toFixed(1)}s - ${s.endTime.toFixed(1)}s] ${s.text}`,
      )
      .join('\n');

    const totalDuration =
      segments.length > 0 ? segments[segments.length - 1].endTime : 0;
    const duration = options?.videoDuration ?? totalDuration;
    const systemPrompt = buildHighlightSystemPrompt(duration);

    const userPrompt = options?.customPrompt
      ? `${options.customPrompt}\n\nFull Video Transcript:\n${transcriptText}`
      : `Full Video Transcript:\n${transcriptText}`;

    try {
      const result = await generateObject({
        model: this.model,
        schemaName: 'HighlightsResponse',
        schemaDescription: 'List of video highlights and metadata',
        schema: HighlightsResponseSchema,
        system: systemPrompt,
        prompt: userPrompt,
        temperature: 0.3,
        maxRetries: 2,
      });

      const parsedObj = result.object;
      const dtos = this.toDto(parsedObj);
      const merged = this.mergeCandidates(dtos);
      const topHighlights = merged
        .sort((a, b) => b.score - a.score)
        .slice(0, FINAL_HIGHLIGHT_COUNT);

      return {
        videoTitle: parsedObj.videoTitle || '',
        videoDescription: parsedObj.videoDescription || '',
        keywords: parsedObj.keywords || '',
        hashtags: parsedObj.hashtags || [],
        highlights: topHighlights,
      };
    } catch (e: any) {
      this.logger.error(
        `Highlight detection failed: ${e instanceof Error ? e.message : e}`,
      );
      this.logFullErrorBody(e, 'detectHighlightsDirect error');
      return {
        videoTitle: '',
        videoDescription: '',
        keywords: '',
        hashtags: [],
        highlights: [],
      };
    }
  }

  private async detectHighlightsGroqWithMetadata(
    segments: TranscriptSegmentDto[],
    options?: { customPrompt?: string; model?: string; videoDuration?: number },
  ): Promise<HighlightDetectionResult> {
    const chunks = this.chunkSegments(segments);
    this.logger.log(
      `Detecting highlights across ${chunks.length} chunk(s) (${segments.length} segments) — provider=groq, model=${this.resolvedModelName}`,
    );

    const totalDuration =
      segments.length > 0 ? segments[segments.length - 1].endTime : 0;
    const duration = options?.videoDuration ?? totalDuration;

    const allCandidates: HighlightDto[] = [];
    let videoTitle = '';
    let videoDescription = '';
    let keywords = '';
    let hashtags: string[] = [];

    for (let i = 0; i < chunks.length; i++) {
      this.logger.log(
        `Processing chunk ${i + 1}/${chunks.length} (${chunks[i].length} segments)`,
      );
      const res = await this.detectHighlightsInChunkWithMetadata(
        chunks[i],
        options,
        duration,
      );
      allCandidates.push(...res.highlights);
      if (!videoTitle && res.videoTitle) videoTitle = res.videoTitle;
      if (!videoDescription && res.videoDescription)
        videoDescription = res.videoDescription;
      if (!keywords && res.keywords) keywords = res.keywords;
      if (hashtags.length === 0 && res.hashtags?.length)
        hashtags = res.hashtags;
    }

    const merged = this.mergeCandidates(allCandidates);
    const topHighlights = merged
      .sort((a, b) => b.score - a.score)
      .slice(0, FINAL_HIGHLIGHT_COUNT);

    return {
      videoTitle,
      videoDescription,
      keywords,
      hashtags,
      highlights: topHighlights,
    };
  }

  private chunkSegments(
    segments: TranscriptSegmentDto[],
  ): TranscriptSegmentDto[][] {
    const chunks: TranscriptSegmentDto[][] = [];
    let current: TranscriptSegmentDto[] = [];
    let currentChars = 0;

    for (const seg of segments) {
      const lineChars = seg.text.length + 20;
      if (currentChars + lineChars > CHUNK_CHAR_BUDGET && current.length > 0) {
        chunks.push(current);
        const overlapStart =
          current[current.length - 1].endTime - CHUNK_OVERLAP_SECONDS;
        current = current.filter((s) => s.endTime >= overlapStart);
        currentChars = current.reduce((sum, s) => sum + s.text.length + 20, 0);
      }
      current.push(seg);
      currentChars += lineChars;
    }
    if (current.length > 0) chunks.push(current);

    return chunks;
  }

  private isRateLimitError(e: any): boolean {
    let candidates: any[] = [e];

    if (e?.name === 'AI_RetryError' || e?.name === 'RetryError') {
      if (Array.isArray(e?.errors) && e.errors.length > 0) {
        candidates = e.errors;
      } else if (e?.lastError) {
        candidates = [e.lastError];
      }
    }

    return candidates.some((err: any) => {
      const isApiError =
        err?.constructor?.name === 'AI_APICallError' ||
        err?.name === 'AI_APICallError';
      if (!isApiError) return false;
      return (
        err?.statusCode === 413 ||
        err?.statusCode === 429 ||
        (typeof err?.responseBody === 'string' &&
          err.responseBody.includes('rate_limit_exceeded'))
      );
    });
  }

  private isConnectionError(e: any): boolean {
    const msg = typeof e?.message === 'string' ? e.message : String(e ?? '');
    return (
      msg.includes('Cannot connect to API') ||
      msg.includes('ECONNREFUSED') ||
      msg.includes('ECONNRESET') ||
      msg.includes('ETIMEDOUT') ||
      msg.includes('ENOTFOUND') ||
      msg.includes('fetch failed') ||
      msg.includes('socket hang up') ||
      msg.includes('network') ||
      (e?.statusCode === undefined &&
        e?.responseBody === undefined &&
        (e?.constructor?.name === 'AI_APICallError' ||
          e?.name === 'AI_APICallError'))
    );
  }

  /**
   * Groq's own JSON validation failures include a `failed_generation`
   * field inside responseBody showing the model's actual (invalid) raw
   * output — this is the single most useful piece of information for
   * diagnosing WHY validation failed (truncation vs. malformed structure
   * vs. something else), and previously was never logged.
   */
  private logFullErrorBody(e: any, label: string): void {
    if (e?.responseBody) {
      this.logger.error(`${label} — responseBody: ${e.responseBody}`);
    } else if (e?.lastError?.responseBody) {
      this.logger.error(
        `${label} — lastError.responseBody: ${e.lastError.responseBody}`,
      );
    } else if (Array.isArray(e?.errors)) {
      e.errors.forEach((err: any, i: number) => {
        if (err?.responseBody)
          this.logger.error(
            `${label} — errors[${i}].responseBody: ${err.responseBody}`,
          );
      });
    }
  }

  private buildGenerateObjectOptions(
    model: any,
    systemPrompt: string,
    userPrompt: string,
    temperature: number,
  ) {
    const base: any = {
      model,
      schemaName: 'HighlightsResponse',
      schemaDescription: 'List of video highlights and metadata',
      schema: HighlightsResponseSchema,
      system: systemPrompt,
      prompt: userPrompt,
      temperature,
      maxOutputTokens: CHUNK_MAX_OUTPUT_TOKENS,
      maxRetries: SDK_MAX_RETRIES,
    };
    if (this.provider === 'groq') {
      base.providerOptions = {
        groq: {
          reasoningEffort: 'low',
        },
      };
    }
    return base;
  }

  private async detectHighlightsInChunk(
    segments: TranscriptSegmentDto[],
    options?: { customPrompt?: string; model?: string; videoDuration?: number },
    videoDuration = 0,
    rateLimitRetryCount = 0,
  ): Promise<HighlightDto[]> {
    const res = await this.detectHighlightsInChunkWithMetadata(
      segments,
      options,
      videoDuration,
      rateLimitRetryCount,
    );
    return res.highlights;
  }

  private async detectHighlightsInChunkWithMetadata(
    segments: TranscriptSegmentDto[],
    options?: { customPrompt?: string; model?: string; videoDuration?: number },
    videoDuration = 0,
    rateLimitRetryCount = 0,
  ): Promise<HighlightDetectionResult> {
    const transcriptText = segments
      .map(
        (s) =>
          `[${s.startTime.toFixed(1)}s - ${s.endTime.toFixed(1)}s] ${s.text}`,
      )
      .join('\n');

    const systemPrompt = buildHighlightSystemPrompt(videoDuration);

    const userPrompt = options?.customPrompt
      ? `${options.customPrompt}\n\nTranscript excerpt:\n${transcriptText}`
      : `Transcript excerpt:\n${transcriptText}`;

    const estimatedTokens = this.estimateRequestTokens(segments);
    await this.waitForBudget(estimatedTokens);

    try {
      const result = await generateObject(
        this.buildGenerateObjectOptions(
          this.model,
          systemPrompt,
          userPrompt,
          0.3,
        ),
      );
      this.recordUsage(estimatedTokens);
      const parsed = result.object as z.infer<typeof HighlightsResponseSchema>;
      return {
        videoTitle: parsed.videoTitle || '',
        videoDescription: parsed.videoDescription || '',
        keywords: parsed.keywords || '',
        hashtags: parsed.hashtags || [],
        highlights: this.toDto(parsed),
      };
    } catch (e: any) {
      if (this.isRateLimitError(e)) {
        this.recordUsage(estimatedTokens);
        if (rateLimitRetryCount >= MAX_RATE_LIMIT_RETRIES) {
          this.logger.error(
            `Chunk hit TPM rate limit and exhausted ${MAX_RATE_LIMIT_RETRIES} retries — skipping this chunk.`,
          );
          return {
            videoTitle: '',
            videoDescription: '',
            keywords: '',
            hashtags: [],
            highlights: [],
          };
        }
        this.logger.warn(
          `Chunk hit TPM rate limit (attempt ${rateLimitRetryCount + 1}/${MAX_RATE_LIMIT_RETRIES}) — will re-check budget and retry`,
        );
        return this.detectHighlightsInChunkWithMetadata(
          segments,
          options,
          videoDuration,
          rateLimitRetryCount + 1,
        );
      }

      const isLengthError =
        NoObjectGeneratedError.isInstance(e) && e.finishReason === 'length';
      const isSchemaError =
        e?.code === 'json_validate_failed' ||
        (typeof e?.message === 'string' &&
          e.message.includes('json_validate_failed')) ||
        (typeof e?.responseBody === 'string' &&
          e.responseBody.includes('json_validate_failed'));

      if (isLengthError || isSchemaError) {
        this.logger.warn(
          `Chunk LLM response failure (${isLengthError ? 'finishReason=length' : 'json_validate_failed'}) — retrying once with lower temperature (0.1)`,
        );
        this.logFullErrorBody(e, 'First-attempt failure');

        await this.waitForBudget(estimatedTokens);

        try {
          const retryResult = await generateObject(
            this.buildGenerateObjectOptions(
              this.model,
              systemPrompt,
              userPrompt,
              0.1,
            ),
          );
          this.recordUsage(estimatedTokens);
          const parsedRetry = retryResult.object as z.infer<
            typeof HighlightsResponseSchema
          >;
          return {
            videoTitle: parsedRetry.videoTitle || '',
            videoDescription: parsedRetry.videoDescription || '',
            keywords: parsedRetry.keywords || '',
            hashtags: parsedRetry.hashtags || [],
            highlights: this.toDto(parsedRetry),
          };
        } catch (retryError: any) {
          this.recordUsage(estimatedTokens);
          this.logFullErrorBody(retryError, 'Retry failure');

          if (
            this.isRateLimitError(retryError) &&
            rateLimitRetryCount < MAX_RATE_LIMIT_RETRIES
          ) {
            this.logger.warn(
              `Low-temp retry also hit rate limit (attempt ${rateLimitRetryCount + 1}/${MAX_RATE_LIMIT_RETRIES}) — will re-check budget and retry from scratch`,
            );
            return this.detectHighlightsInChunkWithMetadata(
              segments,
              options,
              videoDuration,
              rateLimitRetryCount + 1,
            );
          }
          if (
            this.isConnectionError(retryError) &&
            rateLimitRetryCount < MAX_RATE_LIMIT_RETRIES
          ) {
            this.logger.warn(
              `Low-temp retry hit connection error (attempt ${rateLimitRetryCount + 1}/${MAX_RATE_LIMIT_RETRIES}) — waiting 5s then retrying`,
            );
            await new Promise((r) => setTimeout(r, 5000));
            return this.detectHighlightsInChunkWithMetadata(
              segments,
              options,
              videoDuration,
              rateLimitRetryCount + 1,
            );
          }
          this.logger.error(
            `Chunk retry also failed: ${retryError instanceof Error ? retryError.message : retryError}`,
          );
          return {
            videoTitle: '',
            videoDescription: '',
            keywords: '',
            hashtags: [],
            highlights: [],
          };
        }
      } else if (NoObjectGeneratedError.isInstance(e)) {
        this.logger.error(
          `Chunk: no object generated. Finish reason: ${e.finishReason}`,
        );
        this.logFullErrorBody(e, 'NoObjectGeneratedError');
        return {
          videoTitle: '',
          videoDescription: '',
          keywords: '',
          hashtags: [],
          highlights: [],
        };
      } else if (this.isConnectionError(e)) {
        if (rateLimitRetryCount < MAX_RATE_LIMIT_RETRIES) {
          this.logger.warn(
            `Chunk hit connection error (attempt ${rateLimitRetryCount + 1}/${MAX_RATE_LIMIT_RETRIES}): ${e instanceof Error ? e.message : e} — waiting 5s then retrying`,
          );
          await new Promise((r) => setTimeout(r, 5000));
          return this.detectHighlightsInChunkWithMetadata(
            segments,
            options,
            videoDuration,
            rateLimitRetryCount + 1,
          );
        }
        this.logger.error(
          `Chunk connection error persisted after ${MAX_RATE_LIMIT_RETRIES} retries — skipping: ${e}`,
        );
        return {
          videoTitle: '',
          videoDescription: '',
          keywords: '',
          hashtags: [],
          highlights: [],
        };
      } else {
        if (
          e?.constructor?.name === 'AI_APICallError' ||
          e?.name === 'AI_APICallError'
        ) {
          this.logger.error(
            `Chunk AI_APICallError — status: ${e.statusCode}, responseBody: ${e.responseBody}`,
          );
        } else if (e?.name === 'AI_RetryError' || e?.name === 'RetryError') {
          this.logger.error(
            `Chunk RetryError — lastError: ${e?.lastError?.message ?? e?.message}`,
          );
          this.logFullErrorBody(e, 'Unhandled RetryError');
        }
        this.logger.error(`Chunk LLM call failed: ${e}`);
        return {
          videoTitle: '',
          videoDescription: '',
          keywords: '',
          hashtags: [],
          highlights: [],
        };
      }
    }
  }

  private toDto(
    object: z.infer<typeof HighlightsResponseSchema>,
  ): HighlightDto[] {
    return (object.highlights || [])
      .filter((h) => {
        const valid = h.endTime > h.startTime;
        if (!valid)
          this.logger.warn(`Dropping invalid highlight: ${JSON.stringify(h)}`);
        return valid;
      })
      .map((h, index) => {
        const start = h.startTime;
        let end = h.endTime;
        const duration = end - start;

        // If LLM returned a clip slightly over 60s, clamp to 60s
        if (duration > 60) {
          end = start + 60;
        }

        return {
          startTime: Number(start.toFixed(2)),
          endTime: Number(end.toFixed(2)),
          reason: h.reason,
          score: h.score,
          clipTitle: h.clipTitle?.trim() || `Clip ${index + 1}`,
          clipDescription: h.clipDescription?.trim() || '',
          tags: (h.tags ?? [])
            .map((t) => t.trim().toLowerCase().replace(/^#+/, ''))
            .filter(Boolean),
          style: h.style?.trim() || 'curiosity-hook',
          hookText: h.hookText?.trim() || '',
          emojis: (h.emojis ?? []).filter(Boolean),
        };
      });
  }

  private mergeCandidates(candidates: HighlightDto[]): HighlightDto[] {
    const sorted = [...candidates].sort((a, b) => b.score - a.score);
    const kept: HighlightDto[] = [];

    for (const candidate of sorted) {
      const overlapsExisting = kept.some((existing) => {
        const overlapStart = Math.max(candidate.startTime, existing.startTime);
        const overlapEnd = Math.min(candidate.endTime, existing.endTime);
        const overlapDuration = Math.max(0, overlapEnd - overlapStart);
        const candidateDuration = candidate.endTime - candidate.startTime;
        return (
          candidateDuration > 0 && overlapDuration / candidateDuration > 0.5
        );
      });
      if (!overlapsExisting) kept.push(candidate);
    }

    return kept;
  }
}
