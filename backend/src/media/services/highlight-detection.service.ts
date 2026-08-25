import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateObject, NoObjectGeneratedError } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { z } from 'zod';
import { TranscriptSegmentDto } from './transcription.service';

export const HighlightSchema = z.object({
  startTime: z.number().describe('Start time of the clip in seconds'),
  endTime: z.number().describe('End time of the clip in seconds'),
  reason: z.string().max(300).describe('Short explanation of why this moment is engaging, 1-2 sentences'),
  score: z
    .number()
    .describe('Engagement score strictly between 0 and 1, e.g. 0.5, 0.82, 0.95. NEVER use a 0-10 or 0-100 scale.')
    .transform((val) => {
      if (val > 1 && val <= 10) return val / 10;
      if (val > 10 && val <= 100) return val / 100;
      return val;
    })
    .pipe(z.number().min(0).max(1)),
  clipTitle: z.string().max(80).describe('Short, punchy title under 60 characters, like a social media caption'),
  clipDescription: z.string().max(400).describe('1-2 sentence description explaining what makes this moment worth watching'),
});

export const HighlightsResponseSchema = z.object({
  highlights: z.array(HighlightSchema),
});

export interface HighlightDto {
  startTime: number;
  endTime: number;
  reason: string;
  score: number;
  clipTitle: string;
  clipDescription: string;
}

const MAX_OUTPUT_TOKENS = 8192;


@Injectable()
export class HighlightDetectionService {
  private readonly logger = new Logger(HighlightDetectionService.name);
  private readonly model: any;
  private readonly resolvedModelName: string;

  constructor(private configService: ConfigService) {
    const provider = this.configService.get<string>('LLM_PROVIDER', 'google').toLowerCase();
    this.resolvedModelName = this.configService.get<string>('LLM_MODEL_NAME', 'gemini-3.5-flash-lite');

    const apiKey =
      this.configService.get<string>('LLM_API_KEY') ||
      this.configService.get<string>('GROQ_API_KEY');

    if (!apiKey) {
      this.logger.error('No API key found for HighlightDetectionService — set LLM_API_KEY (or GROQ_API_KEY) in .env');
    }

    if (provider === 'groq') {
      const baseURL = this.configService.get<string>('LLM_BASE_URL', 'https://api.groq.com/openai/v1');
      const openai = createOpenAI({ apiKey, baseURL });
      this.model = openai.chat(this.resolvedModelName);
    } else {
      const google = createGoogleGenerativeAI({ apiKey });
      this.model = google(this.resolvedModelName);
    }

    this.logger.log(`HighlightDetectionService initialized — provider=${provider}, model=${this.resolvedModelName}`);
  }

  async detectHighlights(
    segments: TranscriptSegmentDto[],
    options?: { customPrompt?: string; model?: string },
  ): Promise<HighlightDto[]> {
    const transcriptText = segments
      .map((s) => `[${s.startTime.toFixed(1)}s - ${s.endTime.toFixed(1)}s] ${s.text}`)
      .join('\n');

    const systemPrompt = `You are a video editor's assistant. Given a timestamped transcript, identify the 3-5 most engaging, self-contained moments suitable for short vertical clips (15-60 seconds each). For each moment, also write a short, punchy title (STRICTLY under 60 characters) and a concise 1-2 sentence description (STRICTLY under 300 characters). Never repeat words or characters. Every field is required — always provide clipTitle and clipDescription.

Return valid JSON with the exact structure below. The "highlights" field MUST be a direct array of clip objects:
{
  "highlights": [
    {
      "startTime": 12.5,
      "endTime": 35.0,
      "reason": "Clear explanation of why this moment is engaging",
      "score": 0.88,
      "clipTitle": "Punchy Title",
      "clipDescription": "Engaging 1-2 sentence summary"
    }
  ]
}
IMPORTANT: Do NOT nest an "items" object inside "highlights". The value of "highlights" must be a direct array: "highlights": [...]`;

    const userPrompt = options?.customPrompt
      ? `${options.customPrompt}\n\nTranscript:\n${transcriptText}`
      : `Transcript:\n${transcriptText}`;

    this.logger.log(
      `Calling LLM for highlight detection — model=${this.resolvedModelName}, segments=${segments.length}`,
    );

    let object: z.infer<typeof HighlightsResponseSchema>;
    try {
      const result = await generateObject({
        model: this.model,
        schemaName: 'HighlightsResponse',
        schemaDescription: 'List of video highlights',
        schema: HighlightsResponseSchema,
        system: systemPrompt,
        prompt: userPrompt,
        temperature: 0.3,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
      });
      object = result.object;
    } catch (e: any) {
      const isLengthError = NoObjectGeneratedError.isInstance(e) && e.finishReason === 'length';
      const isSchemaError =
        e?.code === 'json_validate_failed' ||
        (typeof e?.message === 'string' && e.message.includes('json_validate_failed')) ||
        (typeof e?.responseBody === 'string' && e.responseBody.includes('json_validate_failed'));

      if (isLengthError || isSchemaError) {
        this.logger.warn(
          `LLM response failure (${isLengthError ? 'finishReason=length' : 'json_validate_failed'}) — retrying once with lower temperature (0.1)`,
        );
        try {
          const retryResult = await generateObject({
            model: this.model,
            schemaName: 'HighlightsResponse',
            schemaDescription: 'List of video highlights',
            schema: HighlightsResponseSchema,
            system: systemPrompt,
            prompt: userPrompt,
            temperature: 0.1,
            maxOutputTokens: MAX_OUTPUT_TOKENS,
          });
          object = retryResult.object;
        } catch (retryError: any) {
          this.logger.error(
            `Retry also failed: ${retryError instanceof Error ? retryError.message : retryError}`,
          );
          throw new Error(
            `Failed to generate highlights after retry: ${retryError instanceof Error ? retryError.message : retryError}`,
          );
        }
      } else if (NoObjectGeneratedError.isInstance(e)) {
        this.logger.error(`No object generated. Finish reason: ${e.finishReason}`);
        throw new Error(`Failed to generate highlights: ${e.message}`);
      } else {
        if (e?.constructor?.name === 'AI_APICallError' || e?.name === 'AI_APICallError') {
          this.logger.error(`AI_APICallError — status: ${e.statusCode}, responseBody: ${e.responseBody}`);
        }
        this.logger.error(`LLM call failed: ${e}`);
        throw new Error(`Failed to generate highlights: ${e}`);
      }
    }

    return object.highlights
      .filter((h) => {
        const valid = h.endTime > h.startTime;
        if (!valid) this.logger.warn(`Dropping invalid highlight: ${JSON.stringify(h)}`);
        return valid;
      })
      .sort((a, b) => b.score - a.score)
      .map((h, index) => ({
        startTime: h.startTime,
        endTime: h.endTime,
        reason: h.reason,
        score: h.score,
        clipTitle: h.clipTitle?.trim() || `Clip ${index + 1}`,
        clipDescription: h.clipDescription?.trim() || '',
      }));
  }
}