import { meteredGenerateObject } from '../../billing/metered-ai';
import { setTimeout as abortableDelay } from 'node:timers/promises';
import {
  cancellationSignal,
  assertNotCancelled,
} from '../../jobs/cancellation-context';
import {
  Injectable,
  Logger,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  HighlightRouting,
  HighlightModelSelection,
} from '../../ai-registry/highlight-routing.service';
import { ModelRegistry } from '../../ai-registry/model-registry.service';
import { ConfigService } from '@nestjs/config';
import { NoObjectGeneratedError, type LanguageModel } from 'ai';
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
import { highlightDurationSeconds } from '../highlight-duration';
import {
  DETECTION_VERSION,
  MIN_HIGHLIGHT_SCORE,
} from '../pipeline-cache-identity';
import { strongestCombination } from '../highlight-selection';

import { HighlightsResponseSchema } from '../highlight-result.contract';
export {
  HighlightSchema,
  HighlightsResponseSchema,
} from '../highlight-result.contract';

export interface HighlightDto {
  contextComplete?: boolean;
  presetRelevant?: boolean;
  groundedQuote?: string;
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

export interface HighlightDetectionOptions {
  customPrompt?: string;
  model?: string;
  videoDuration?: number;
  maxHighlights?: number;
  minHighlights?: number;
  maxOutputSeconds?: number;
  jobId?: string;
  plan?: string;
  registeredModel?: { userId: string; selection: HighlightModelSelection };
}

export interface HighlightDetectionResult {
  analyzedRegions?: { startTime: number; endTime: number }[];
  llmCalls?: number;
  rejected?: Record<string, number>;
  candidateCount?: number;
  candidates?: HighlightDto[];
  cacheable?: boolean;
  coverageSeconds?: number;
  videoTitle: string;
  videoDescription: string;
  keywords: string;
  hashtags: string[];
  highlights: HighlightDto[];
}

const SDK_MAX_RETRIES = 0;
const DIRECT_MAX_OUTPUT_TOKENS = 8192;

const CHUNK_CHAR_BUDGET = 3000; // ~750 tokens of transcript text per chunk
const CHUNK_MAX_OUTPUT_TOKENS = 2500; // generous room for hidden reasoning + final JSON
const CHUNK_OVERLAP_SECONDS = 45;
const HIGHLIGHTS_PER_CHUNK = 2;
const FINAL_HIGHLIGHT_COUNT = 9;
const MAX_RATE_LIMIT_RETRIES = 3;

const TPM_LIMIT = 8000;
const TPM_SAFETY_MARGIN = 500;
const WINDOW_MS = 60_000;

const normalizedText = (text: string) =>
  text
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function repeatedContent(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  const left = new Set(normalizedText(a).split(' '));
  const right = new Set(normalizedText(b).split(' '));
  if (left.size < 6 || right.size < 6) return false;
  const intersection = [...left].filter((word) => right.has(word)).length;
  return intersection / (left.size + right.size - intersection) >= 0.85;
}

function coveredSeconds(
  regions: { startTime: number; endTime: number }[],
  limit: number,
): number {
  let total = 0,
    until = 0;
  for (const region of [...regions].sort((a, b) => a.startTime - b.startTime)) {
    const start = Math.max(0, until, region.startTime),
      end = Math.min(limit, region.endTime);
    if (end > start) {
      total += end - start;
      until = end;
    }
  }
  return total;
}

@Injectable()
export class HighlightDetectionService {
  private readonly logger = new Logger(HighlightDetectionService.name);
  private readonly model: any;
  private readonly provider: string;
  private readonly resolvedModelName: string;
  private readonly usageLog: { timestamp: number; tokens: number }[] = [];

  constructor(
    private configService: ConfigService,
    @Optional() private routing?: HighlightRouting,
    @Optional() private registry?: ModelRegistry,
  ) {
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
      await abortableDelay(waitMs, undefined, { signal: cancellationSignal() });
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
    options?: HighlightDetectionOptions,
  ): Promise<HighlightDto[]> {
    const res = await this.detectHighlightsWithMetadata(segments, options);
    return res.highlights;
  }

  async detectHighlightsWithMetadata(
    segments: TranscriptSegmentDto[],
    options?: HighlightDetectionOptions,
  ): Promise<HighlightDetectionResult> {
    const discovered = await this.discoverCandidatesWithMetadata(
      segments,
      options,
    );
    return {
      ...discovered,
      highlights: this.selectCandidates(
        discovered.candidates ?? discovered.highlights,
        segments,
        options,
      ),
    };
  }

  cacheConfiguration(model?: string, selection?: HighlightModelSelection) {
    return {
      ...(selection ? { registeredModel: selection } : {}),
      version: DETECTION_VERSION,
      provider: this.provider,
      baseURL:
        this.provider === 'groq'
          ? this.configService.get<string>(
              'LLM_BASE_URL',
              'https://api.groq.com/openai/v1',
            )
          : 'google',
      model: selection?.modelId || model || this.resolvedModelName,
      minScore: MIN_HIGHLIGHT_SCORE,
      temperature: 0.3,
      outputTokens: DIRECT_MAX_OUTPUT_TOKENS,
      windowSeconds: 900,
      overlapSeconds: 45,
      windowChars: 18000,
    };
  }
  async verifySelection(userId: string, selection: HighlightModelSelection) {
    if (!this.routing)
      throw new ServiceUnavailableException('AI registry is unavailable');
    await this.routing.resolve(userId, selection);
  }

  candidateArtifactIsValid(
    value: unknown,
    segments: TranscriptSegmentDto[],
    options: HighlightDetectionOptions,
  ): value is HighlightDetectionResult {
    if (!value || typeof value !== 'object') return false;
    const result = value as HighlightDetectionResult;
    if (
      !Array.isArray(result.candidates) ||
      typeof result.cacheable !== 'boolean'
    )
      return false;
    if (
      !HighlightsResponseSchema.safeParse({
        ...result,
        highlights: result.candidates,
      }).success
    )
      return false;
    if (
      result.candidates.some(
        (h) =>
          h.contextComplete !== true ||
          h.presetRelevant !== true ||
          !h.groundedQuote,
      )
    )
      return false;
    return (
      this.validateCandidates(
        result.candidates,
        segments,
        options.videoDuration ?? 0,
        Infinity,
        Infinity,
        [],
        {},
        true,
      ).length === result.candidates.length
    );
  }

  private generateFor(
    options?: HighlightDetectionOptions,
  ): typeof meteredGenerateObject {
    if (!options?.registeredModel) return meteredGenerateObject;
    const binding = options.registeredModel;
    return (async (...args: Parameters<typeof meteredGenerateObject>) => {
      if (!this.routing || !this.registry)
        throw new ServiceUnavailableException('AI registry is unavailable');
      const resolved = await this.routing.resolve(
        binding.userId,
        binding.selection,
      );
      const started = Date.now();
      const usage = {
        executionId: randomUUID(),
        call: 1,
        userId: binding.userId,
        modelId: binding.selection.registryId,
        providerModelId: resolved.model.modelId,
        providerId: resolved.model.providerId,
        taskType: 'highlight_detection',
        pricing: resolved.model.pricing,
        latencyMs: 0,
        status: 'failed',
      };
      try {
        const timeout = AbortSignal.timeout(resolved.model.settings.timeoutMs);
        const signal = args[0].abortSignal
          ? AbortSignal.any([args[0].abortSignal, timeout])
          : timeout;
        const result = await meteredGenerateObject({
          ...args[0],
          model: createGoogleGenerativeAI({ apiKey: resolved.secret })(
            resolved.model.modelId,
          ),
          temperature:
            resolved.model.settings.temperature ?? args[0].temperature,
          maxOutputTokens: Math.min(
            args[0].maxOutputTokens ?? 8192,
            resolved.model.settings.maxOutputTokens,
          ),
          maxRetries: 0,
          abortSignal: signal,
        });
        const inputTokens = result.usage.inputTokens,
          outputTokens = result.usage.outputTokens;
        const pricing = resolved.model.pricing;
        await this.registry.recordUsage({
          ...usage,
          latencyMs: Date.now() - started,
          status: 'success',
          inputTokens,
          outputTokens,
          totalTokens: result.usage.totalTokens,
          ...(pricing && inputTokens !== undefined && outputTokens !== undefined
            ? {
                estimatedCostUsd:
                  (inputTokens * pricing.inputCostPerMillionTokens +
                    outputTokens * pricing.outputCostPerMillionTokens) /
                  1e6,
              }
            : {}),
        });
        return result;
      } catch {
        await this.registry.recordUsage({
          ...usage,
          latencyMs: Date.now() - started,
          errorCode: 'HIGHLIGHT_PROVIDER_FAILED',
        });
        throw new ServiceUnavailableException(
          'Selected AI model could not generate highlights',
        );
      }
    }) as typeof meteredGenerateObject;
  }
  private configuredModel(model?: string): LanguageModel {
    if (!model || model === this.resolvedModelName)
      return this.model as LanguageModel;
    const apiKey =
      this.configService.get<string>('LLM_API_KEY') ||
      this.configService.get<string>('GROQ_API_KEY');
    return this.provider === 'groq'
      ? createOpenAI({
          apiKey,
          baseURL: this.configService.get<string>(
            'LLM_BASE_URL',
            'https://api.groq.com/openai/v1',
          ),
        }).chat(model)
      : createGoogleGenerativeAI({ apiKey })(model);
  }

  selectCandidates(
    candidates: HighlightDto[],
    segments: TranscriptSegmentDto[],
    options?: HighlightDetectionOptions,
  ): HighlightDto[] {
    const duration =
      options?.videoDuration ?? Math.max(...segments.map((s) => s.endTime));
    const rejected: Record<string, number> = {};
    const valid = this.validateCandidates(
      candidates,
      segments,
      duration,
      Infinity,
      Infinity,
      [],
      rejected,
      true,
    );
    const cap = options?.maxHighlights ?? FINAL_HIGHLIGHT_COUNT;
    const allowance = options?.maxOutputSeconds ?? cap * 60;
    const accepted = strongestCombination(valid, cap, allowance);
    for (const candidate of valid.filter((h) => !accepted.includes(h))) {
      const reason = accepted.some(
        (h) =>
          candidate.startTime < h.endTime && candidate.endTime > h.startTime,
      )
        ? 'overlap'
        : accepted.length === cap
          ? 'plan_limit'
          : 'output_budget';
      rejected[reason] = (rejected[reason] ?? 0) + 1;
    }
    const seconds = accepted.reduce(
      (sum, h) => sum + highlightDurationSeconds(h),
      0,
    );
    this.logger.log({
      event: 'highlights.selected',
      jobId: options?.jobId,
      plan: options?.plan,
      algorithmVersion: DETECTION_VERSION,
      requestedMax: cap,
      candidateCount: candidates.length,
      rejected,
      accepted: accepted.length,
      totalOutputSeconds: seconds,
      remainingAuthorizedOutputSeconds: Math.max(0, allowance - seconds),
      authorizedOutputSeconds: allowance,
      reason:
        accepted.length === cap
          ? 'plan_cap'
          : valid.length > accepted.length
            ? 'overlap_or_authorized_output_budget'
            : 'quality_and_content_availability',
    });
    return accepted;
  }

  async discoverCandidatesWithMetadata(
    segments: TranscriptSegmentDto[],
    options?: HighlightDetectionOptions,
  ): Promise<HighlightDetectionResult> {
    const filtered = segments.filter((s) => s.text.trim().length > 0);
    if (filtered.length === 0) {
      this.logger.warn(
        'No segments remained after filtering filler — falling back to unfiltered segments',
      );
    }
    const usableSegments = filtered.length > 0 ? filtered : segments;
    if (!usableSegments.length)
      throw new Error('No usable transcript for highlight detection');

    const duration =
      options?.videoDuration ||
      Math.max(...usableSegments.map((s) => s.endTime));
    // Discovery is plan-independent: the same complete pool serves Free and paid jobs.
    const max = Math.min(24, Math.max(12, Math.ceil(duration / 600) * 4));
    const min = 0;
    const budget = Infinity;
    const rejected: Record<string, number> = {};
    const requestOptions = {
      ...options,
      videoDuration: duration,
      maxHighlights: max,
      customPrompt: `${options?.customPrompt || ''}\nGenerate a ranked candidate pool, considering up to ${max} genuinely useful moments when available. There is no minimum count; candidate limits are not quotas. Analyze all supplied regions and prioritize strong, complete moments matching the effective instructions. Keep each description and reason to one short sentence; emit only the JSON object.`,
    };
    this.logger.log({
      event: 'highlights.requested',
      jobId: options?.jobId,
      plan: options?.plan,
      requestedMin: min,
      requestedMax: max,
      candidateLimit: max,
      algorithmVersion: DETECTION_VERSION,
      sourceDuration: duration,
      authorizedOutputSeconds: options?.maxOutputSeconds,
    });
    const result =
      this.provider === 'groq' && !options?.registeredModel
        ? await this.detectHighlightsGroqWithMetadata(
            usableSegments,
            requestOptions,
          )
        : await this.detectHighlightsAcrossWindows(
            usableSegments,
            requestOptions,
          );
    Object.assign(rejected, result.rejected);
    let candidateCount = result.candidateCount ?? result.highlights.length;
    let accepted = this.validateCandidates(
      result.highlights,
      usableSegments,
      duration,
      Infinity,
      budget,
      [],
      rejected,
      true,
    );
    let recoveryAttempted = false;
    let recoveryFailed = false;
    const analyzedRegions = [...(result.analyzedRegions ?? [])];
    let llmCalls = result.llmCalls ?? 0;
    const outputSeconds = () =>
      accepted.reduce((sum, h) => sum + highlightDurationSeconds(h), 0);
    // One source-wide recovery pass repairs rejected/incomplete discovery without a quota.
    if (
      duration >= 1200 &&
      (Object.keys(rejected).length > 0 || result.cacheable === false)
    ) {
      const uncovered = usableSegments.filter(
        (s) =>
          !accepted.some(
            (h) => s.startTime < h.endTime && s.endTime > h.startTime,
          ),
      );
      if (uncovered.length) {
        recoveryAttempted = true;
        this.logger.log({
          event: 'highlights.recovery.requested',
          jobId: options?.jobId,
          uncoveredSegments: uncovered.length,
          retainedCandidates: accepted.length,
        });
        const recoveryOptions = {
          ...requestOptions,
          maxHighlights: max,
          customPrompt: `${requestOptions.customPrompt}\nFind additional distinct highlights only in this uncovered excerpt covering ALL remaining source regions. Never bridge gaps in this excerpt or overlap accepted ranges: ${JSON.stringify(accepted.map((h) => [h.startTime, h.endTime]))}. Return fewer when no genuine complete moments exist.`,
        };
        try {
          assertNotCancelled();
          const recovered =
            this.provider === 'groq' && !options?.registeredModel
              ? await this.detectHighlightsGroqWithMetadata(
                  uncovered,
                  recoveryOptions,
                )
              : await this.detectHighlightsAcrossWindows(
                  uncovered,
                  recoveryOptions,
                );
          llmCalls += recovered.llmCalls ?? 0;
          analyzedRegions.push(...(recovered.analyzedRegions ?? []));
          if (recovered.cacheable === false) recoveryFailed = true;
          candidateCount +=
            recovered.candidateCount ?? recovered.highlights.length;
          for (const [reason, count] of Object.entries(
            recovered.rejected ?? {},
          ))
            rejected[reason] = (rejected[reason] ?? 0) + count;
          // Validate against the supplied excerpt and retain the initial winners.
          accepted = this.validateCandidates(
            recovered.highlights,
            uncovered,
            duration,
            Infinity,
            budget,
            accepted,
            rejected,
            true,
          );
          this.logger.log({
            event: 'highlights.recovery.completed',
            jobId: options?.jobId,
            candidates: recovered.candidateCount ?? recovered.highlights.length,
            acceptedPool: accepted.length,
            complete: recovered.cacheable !== false,
          });
        } catch (error) {
          assertNotCancelled();
          recoveryFailed = true;
          this.logger.warn({
            event: 'highlights.recovery.failed',
            jobId: options?.jobId,
            retained: accepted.length,
            errorType: error instanceof Error ? error.name : 'provider_error',
          });
        }
      }
    }
    this.logger.log({
      event: 'highlights.discovery',
      algorithmVersion: DETECTION_VERSION,
      jobId: options?.jobId,
      plan: options?.plan,
      requestedMin: min,
      requestedMax: max,
      candidateCount,
      coverageSeconds: coveredSeconds(analyzedRegions, duration),
      llmCalls,
      rejected,
      accepted: accepted.length,
      totalOutputSeconds: outputSeconds(),
      shortfall: Math.max(0, min - accepted.length),
      recoveryAttempted,
      reason: 'quality_and_content_availability',
    });
    return {
      ...result,
      highlights: accepted,
      llmCalls,
      rejected,
      candidateCount,
      analyzedRegions,
      candidates: accepted,
      cacheable: result.cacheable !== false && !recoveryFailed,
      coverageSeconds: coveredSeconds(analyzedRegions, duration),
    };
  }

  private async detectHighlightsAcrossWindows(
    segments: TranscriptSegmentDto[],
    options: HighlightDetectionOptions,
  ): Promise<HighlightDetectionResult> {
    const windows: TranscriptSegmentDto[][] = [];
    let current: TranscriptSegmentDto[] = [];
    let chars = 0;
    for (const segment of segments) {
      if (
        current.length &&
        (segment.endTime - current[0].startTime > 900 ||
          chars + segment.text.length > 18000)
      ) {
        windows.push(current);
        const end = current.at(-1)!.endTime;
        current = current.filter((s) => s.endTime > end - 45);
        chars = current.reduce((sum, s) => sum + s.text.length, 0);
      }
      current.push(segment);
      chars += segment.text.length;
    }
    if (current.length) windows.push(current);
    let result: HighlightDetectionResult = {
      videoTitle: '',
      videoDescription: '',
      keywords: '',
      hashtags: [],
      highlights: [],
      cacheable: true,
    };
    const rejected: Record<string, number> = {};
    let candidateCount = 0;
    let successfulWindows = 0;
    const analyzedRegions: { startTime: number; endTime: number }[] = [];
    for (let i = 0; i < windows.length; i++) {
      try {
        assertNotCancelled();
        const part = await this.detectHighlightsDirectWithMetadata(windows[i], {
          ...options,
          maxHighlights:
            windows.length > 1
              ? Math.min(options.maxHighlights ?? 12, 8)
              : options.maxHighlights,
        });
        candidateCount += part.highlights.length;
        successfulWindows++;
        analyzedRegions.push({
          startTime: windows[i][0].startTime,
          endTime: windows[i].at(-1)!.endTime,
        });
        const valid = this.validateCandidates(
          part.highlights,
          windows[i],
          options.videoDuration ?? 0,
          Infinity,
          Infinity,
          [],
          rejected,
          true,
        );
        result = {
          ...part,
          highlights: [...result.highlights, ...valid],
          cacheable: result.cacheable !== false && part.cacheable !== false,
          llmCalls: (result.llmCalls ?? 0) + (part.llmCalls ?? 0),
        };
      } catch (error) {
        assertNotCancelled();
        if (options.registeredModel || windows.length === 1) throw error;
        result.cacheable = false;
      }
    }
    this.logger.log({
      event: 'highlights.coverage',
      jobId: options.jobId,
      windows: windows.length,
      successfulWindows,
      segments: segments.length,
      sourceDuration: options.videoDuration,
    });
    return { ...result, rejected, candidateCount, analyzedRegions };
  }

  private async detectHighlightsDirectWithMetadata(
    segments: TranscriptSegmentDto[],
    options?: HighlightDetectionOptions,
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
    const systemPrompt = buildHighlightSystemPrompt(
      duration,
      options?.maxHighlights,
    );

    const userPrompt = options?.customPrompt
      ? `${options.customPrompt}\n\nFull Video Transcript:\n${transcriptText}`
      : `Full Video Transcript:\n${transcriptText}`;

    let llmCalls = 0;
    let cacheable = true;
    try {
      assertNotCancelled();
      const request = {
        abortSignal: cancellationSignal(),
        model: this.configuredModel(options?.model),
        schemaName: 'HighlightsResponse',
        schemaDescription: 'List of video highlights and metadata',
        schema: HighlightsResponseSchema,
        system: systemPrompt,
        prompt: `${userPrompt}\n\nReturn at most ${options?.maxHighlights || FINAL_HIGHLIGHT_COUNT} highlights in one complete JSON object. Keep descriptions concise.`,
        temperature: 0.3,
        maxOutputTokens: DIRECT_MAX_OUTPUT_TOKENS,
        maxRetries: 2,
      };
      let parsedObj: z.infer<typeof HighlightsResponseSchema>;
      try {
        llmCalls++;
        parsedObj = (await this.generateFor(options)(request)).object;
      } catch (error) {
        assertNotCancelled();
        if (!NoObjectGeneratedError.isInstance(error)) throw error;

        this.logger.warn(
          `Highlight response invalid: finishReason=${error.finishReason}, outputChars=${error.text?.length ?? 0}`,
        );
        // Only recover complete, schema-valid JSON. Never invent missing fields
        // or salvage a truncated list of clips.
        const recovered = this.recoverHighlightResponse(error.text);
        if (recovered) {
          parsedObj = recovered;
          if (error.finishReason === 'length') cacheable = false;
        } else {
          this.logger.warn(
            'Retrying highlight generation once with stricter JSON instructions',
          );
          llmCalls++;
          parsedObj = (
            await this.generateFor(options)({
              ...request,
              temperature: 0.1,
              maxOutputTokens:
                error.finishReason === 'length'
                  ? DIRECT_MAX_OUTPUT_TOKENS * 2
                  : DIRECT_MAX_OUTPUT_TOKENS,
              prompt: `${userPrompt}\n\nReturn only one complete JSON object matching the schema, without Markdown or commentary. Return at most ${options?.maxHighlights || FINAL_HIGHLIGHT_COUNT} highlights and keep descriptions concise.`,
            })
          ).object;
        }
      }

      const dtos = this.toDto(parsedObj);
      const topHighlights = dtos;

      return {
        videoTitle: parsedObj.videoTitle || '',
        videoDescription: parsedObj.videoDescription || '',
        keywords: parsedObj.keywords || '',
        hashtags: parsedObj.hashtags || [],
        highlights: topHighlights,
        llmCalls,
        cacheable,
      };
    } catch (e: any) {
      assertNotCancelled();
      if (options?.registeredModel) throw e;
      if (NoObjectGeneratedError.isInstance(e)) {
        this.logger.error(
          `Invalid highlight output: finishReason=${e.finishReason}, outputChars=${e.text?.length ?? 0}`,
        );
      }
      this.logger.error({
        event: 'highlights.provider.error',
        name: e instanceof Error ? e.name : 'provider_error',
      });
      this.logFullErrorBody(e, 'detectHighlightsDirect error');
      // Let the processor record a highlight_detection failure, rather than
      // caching an empty result and advancing to cutting/finalizing.
      throw new Error('Highlight detection failed', { cause: e });
    }
  }

  private recoverHighlightResponse(
    text: string | undefined,
  ): z.infer<typeof HighlightsResponseSchema> | null {
    if (!text) return null;
    const json = text
      .trim()
      .replace(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i, '$1');
    try {
      const result = HighlightsResponseSchema.safeParse(JSON.parse(json));
      return result.success ? result.data : null;
    } catch {
      return null;
    }
  }

  private async detectHighlightsGroqWithMetadata(
    segments: TranscriptSegmentDto[],
    options?: HighlightDetectionOptions,
  ): Promise<HighlightDetectionResult> {
    const chunks = this.chunkSegments(segments);
    this.logger.log(
      `Detecting highlights across ${chunks.length} chunk(s) (${segments.length} segments) — provider=groq, model=${this.resolvedModelName}`,
    );

    const totalDuration =
      segments.length > 0 ? segments[segments.length - 1].endTime : 0;
    const duration = options?.videoDuration ?? totalDuration;

    const allCandidates: HighlightDto[] = [];
    const rejected: Record<string, number> = {};
    let candidateCount = 0;
    let llmCalls = 0;
    let cacheable = true;
    const analyzedRegions: { startTime: number; endTime: number }[] = [];
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
        {
          ...options,
          maxHighlights: Math.min(
            options?.maxHighlights ?? FINAL_HIGHLIGHT_COUNT,
            HIGHLIGHTS_PER_CHUNK * 2,
          ),
          customPrompt: `${options?.customPrompt || ''}\nFor this small excerpt return at most ${HIGHLIGHTS_PER_CHUNK * 2} complete candidates.`,
        },
        duration,
      );
      candidateCount += res.highlights.length;
      llmCalls += res.llmCalls ?? 0;
      cacheable = cacheable && res.cacheable !== false;
      if (res.cacheable !== false)
        analyzedRegions.push({
          startTime: chunks[i][0].startTime,
          endTime: chunks[i].at(-1)!.endTime,
        });
      allCandidates.push(
        ...this.validateCandidates(
          res.highlights,
          chunks[i],
          duration,
          Infinity,
          Infinity,
          [],
          rejected,
          true,
        ),
      );
      if (!videoTitle && res.videoTitle) videoTitle = res.videoTitle;
      if (!videoDescription && res.videoDescription)
        videoDescription = res.videoDescription;
      if (!keywords && res.keywords) keywords = res.keywords;
      if (hashtags.length === 0 && res.hashtags?.length)
        hashtags = res.hashtags;
    }

    const topHighlights = allCandidates;

    return {
      videoTitle,
      videoDescription,
      keywords,
      hashtags,
      highlights: topHighlights,
      cacheable,
      analyzedRegions,
      llmCalls,
      rejected,
      candidateCount,
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
  private logFullErrorBody(error: unknown, label: string): void {
    const e = error as
      | {
          statusCode?: number;
          name?: string;
          lastError?: { statusCode?: number };
        }
      | undefined;
    this.logger.error({
      event: 'highlights.provider.failed',
      label,
      statusCode: e?.statusCode ?? e?.lastError?.statusCode,
      name: e?.name,
    });
  }

  private buildGenerateObjectOptions(
    model: LanguageModel,
    systemPrompt: string,
    userPrompt: string,
    temperature: number,
  ) {
    assertNotCancelled();
    return {
      abortSignal: cancellationSignal(),
      model,
      schemaName: 'HighlightsResponse',
      schemaDescription: 'List of video highlights and metadata',
      schema: HighlightsResponseSchema,
      system: systemPrompt,
      prompt: userPrompt,
      temperature,
      maxOutputTokens: CHUNK_MAX_OUTPUT_TOKENS,
      maxRetries: SDK_MAX_RETRIES,
      ...(this.provider === 'groq'
        ? { providerOptions: { groq: { reasoningEffort: 'low' } } }
        : {}),
    };
  }

  private async detectHighlightsInChunk(
    segments: TranscriptSegmentDto[],
    options?: HighlightDetectionOptions,
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
    options?: HighlightDetectionOptions,
    videoDuration = 0,
    rateLimitRetryCount = 0,
  ): Promise<HighlightDetectionResult> {
    const transcriptText = segments
      .map(
        (s) =>
          `[${s.startTime.toFixed(1)}s - ${s.endTime.toFixed(1)}s] ${s.text}`,
      )
      .join('\n');

    const systemPrompt = buildHighlightSystemPrompt(
      videoDuration,
      options?.maxHighlights,
    );

    const userPrompt = options?.customPrompt
      ? `${options.customPrompt}\n\nTranscript excerpt:\n${transcriptText}`
      : `Transcript excerpt:\n${transcriptText}`;

    const estimatedTokens = this.estimateRequestTokens(segments);
    await this.waitForBudget(estimatedTokens);

    let llmCalls = 0;
    try {
      llmCalls++;
      const result = await this.generateFor(options)(
        this.buildGenerateObjectOptions(
          this.configuredModel(options?.model),
          systemPrompt,
          userPrompt,
          0.3,
        ),
      );
      this.recordUsage(estimatedTokens);
      const parsed = result.object;
      return {
        videoTitle: parsed.videoTitle || '',
        videoDescription: parsed.videoDescription || '',
        keywords: parsed.keywords || '',
        hashtags: parsed.hashtags || [],
        highlights: this.toDto(parsed),
        llmCalls,
      };
    } catch (e: any) {
      assertNotCancelled();
      if (options?.registeredModel) throw e;
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
            cacheable: false,
          };
        }
        this.logger.warn(
          `Chunk hit TPM rate limit (attempt ${rateLimitRetryCount + 1}/${MAX_RATE_LIMIT_RETRIES}) — will re-check budget and retry`,
        );
        const retried = await this.detectHighlightsInChunkWithMetadata(
          segments,
          options,
          videoDuration,
          rateLimitRetryCount + 1,
        );
        return { ...retried, llmCalls: (retried.llmCalls ?? 0) + llmCalls };
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
          llmCalls++;
          const retryResult = await this.generateFor(options)(
            this.buildGenerateObjectOptions(
              this.configuredModel(options?.model),
              systemPrompt,
              userPrompt,
              0.1,
            ),
          );
          this.recordUsage(estimatedTokens);
          const parsedRetry = retryResult.object;
          return {
            videoTitle: parsedRetry.videoTitle || '',
            videoDescription: parsedRetry.videoDescription || '',
            keywords: parsedRetry.keywords || '',
            hashtags: parsedRetry.hashtags || [],
            highlights: this.toDto(parsedRetry),
            llmCalls,
          };
        } catch (retryError: any) {
          assertNotCancelled();
          this.recordUsage(estimatedTokens);
          this.logFullErrorBody(retryError, 'Retry failure');

          if (
            this.isRateLimitError(retryError) &&
            rateLimitRetryCount < MAX_RATE_LIMIT_RETRIES
          ) {
            this.logger.warn(
              `Low-temp retry also hit rate limit (attempt ${rateLimitRetryCount + 1}/${MAX_RATE_LIMIT_RETRIES}) — will re-check budget and retry from scratch`,
            );
            const retried = await this.detectHighlightsInChunkWithMetadata(
              segments,
              options,
              videoDuration,
              rateLimitRetryCount + 1,
            );
            return { ...retried, llmCalls: (retried.llmCalls ?? 0) + llmCalls };
          }
          if (
            this.isConnectionError(retryError) &&
            rateLimitRetryCount < MAX_RATE_LIMIT_RETRIES
          ) {
            this.logger.warn(
              `Low-temp retry hit connection error (attempt ${rateLimitRetryCount + 1}/${MAX_RATE_LIMIT_RETRIES}) — waiting 5s then retrying`,
            );
            await abortableDelay(5000, undefined, {
              signal: cancellationSignal(),
            });
            const retried = await this.detectHighlightsInChunkWithMetadata(
              segments,
              options,
              videoDuration,
              rateLimitRetryCount + 1,
            );
            return { ...retried, llmCalls: (retried.llmCalls ?? 0) + llmCalls };
          }
          this.logger.error(
            `Chunk retry also failed: ${retryError?.name || 'provider_error'}`,
          );
          return {
            videoTitle: '',
            videoDescription: '',
            keywords: '',
            hashtags: [],
            highlights: [],
            cacheable: false,
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
          cacheable: false,
        };
      } else if (this.isConnectionError(e)) {
        if (rateLimitRetryCount < MAX_RATE_LIMIT_RETRIES) {
          this.logger.warn(
            `Chunk hit connection error (attempt ${rateLimitRetryCount + 1}/${MAX_RATE_LIMIT_RETRIES}): ${e?.name || 'provider_error'} — waiting 5s then retrying`,
          );
          await abortableDelay(5000, undefined, {
            signal: cancellationSignal(),
          });
          const retried = await this.detectHighlightsInChunkWithMetadata(
            segments,
            options,
            videoDuration,
            rateLimitRetryCount + 1,
          );
          return { ...retried, llmCalls: (retried.llmCalls ?? 0) + llmCalls };
        }
        this.logger.error(
          `Chunk connection error persisted after ${MAX_RATE_LIMIT_RETRIES} retries — skipping: ${e instanceof Error ? e.name : 'provider_error'}`,
        );
        return {
          videoTitle: '',
          videoDescription: '',
          keywords: '',
          hashtags: [],
          highlights: [],
          cacheable: false,
        };
      } else {
        const errorName = e instanceof Error ? e.name : 'provider_error';
        if (errorName === 'AI_APICallError') {
          this.logger.error(`Chunk AI_APICallError — status: ${e.statusCode}`);
        } else if (
          errorName === 'AI_RetryError' ||
          errorName === 'RetryError'
        ) {
          this.logger.error(`Chunk RetryError — lastError: ${errorName}`);
          this.logFullErrorBody(e, 'Unhandled RetryError');
        }
        this.logger.error(`Chunk LLM call failed: ${errorName}`);
        return {
          videoTitle: '',
          videoDescription: '',
          keywords: '',
          hashtags: [],
          highlights: [],
          cacheable: false,
        };
      }
    }
  }

  private toDto(
    object: z.infer<typeof HighlightsResponseSchema>,
  ): HighlightDto[] {
    this.logger.log({
      event: 'highlights.parsed',
      returned: object.highlights?.length || 0,
    });
    return (object.highlights || []).map((h, index) => {
      const start = h.startTime;
      const end = h.endTime;

      return {
        contextComplete: h.contextComplete ?? true,
        presetRelevant: h.presetRelevant ?? true,
        groundedQuote: h.groundedQuote,
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

  private validateCandidates(
    candidates: HighlightDto[],
    segments: TranscriptSegmentDto[],
    duration: number,
    max: number,
    budget = max * 60,
    retained: HighlightDto[] = [],
    rejected: Record<string, number> = {},
    allowOverlap = false,
  ) {
    const accepted = [...retained];
    let remaining =
      budget -
      accepted.reduce((sum, h) => sum + highlightDurationSeconds(h), 0);
    for (const h of [...candidates].sort((a, b) => b.score - a.score)) {
      const seconds = highlightDurationSeconds(h);
      // ASR segments can overlap; count their union rather than counting speech twice.
      let covered = 0;
      let coveredUntil = h.startTime;
      for (const segment of [...segments].sort(
        (a, b) => a.startTime - b.startTime,
      )) {
        const start = Math.max(h.startTime, segment.startTime, coveredUntil);
        const end = Math.min(h.endTime, segment.endTime);
        if (end > start) {
          covered += end - start;
          coveredUntil = end;
        }
      }
      const reason =
        !Number.isFinite(h.startTime) ||
        !Number.isFinite(h.endTime) ||
        h.startTime < 0 ||
        h.endTime > duration ||
        seconds <= 0
          ? 'invalid_timestamp'
          : !Number.isFinite(h.score) ||
              h.score < MIN_HIGHLIGHT_SCORE ||
              h.score > 1
            ? 'quality'
            : h.contextComplete === false
              ? 'context_incomplete'
              : h.presetRelevant === false
                ? 'preset_relevance'
                : seconds > 60 || (duration >= 600 && seconds < 45)
                  ? 'duration'
                  : covered < seconds * 0.5
                    ? 'transcript_coverage'
                    : h.groundedQuote !== undefined &&
                        (!normalizedText(h.groundedQuote) ||
                          !normalizedText(
                            segments
                              .filter(
                                (s) =>
                                  s.startTime < h.endTime &&
                                  s.endTime > h.startTime,
                              )
                              .map((s) => s.text)
                              .join(' '),
                          ).includes(normalizedText(h.groundedQuote)))
                      ? 'grounding'
                      : accepted.some(
                            (a) =>
                              a.startTime === h.startTime &&
                              a.endTime === h.endTime,
                          )
                        ? 'duplicate'
                        : accepted.some((a) =>
                              repeatedContent(a.groundedQuote, h.groundedQuote),
                            )
                          ? 'duplicate_content'
                          : !allowOverlap &&
                              accepted.some(
                                (a) =>
                                  h.startTime < a.endTime &&
                                  h.endTime > a.startTime,
                              )
                            ? 'overlap'
                            : accepted.length >= max
                              ? 'plan_limit'
                              : seconds > remaining
                                ? 'output_budget'
                                : undefined;
      if (reason) rejected[reason] = (rejected[reason] || 0) + 1;
      else {
        accepted.push(h);
        remaining -= seconds;
      }
    }
    this.logger.log({
      event: 'highlights.filtered',
      parsed: candidates.length,
      accepted: accepted.length,
      rejected,
    });
    return accepted;
  }
}
