import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateObject, NoObjectGeneratedError } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { z } from 'zod';
import { TranscriptSegmentDto } from './transcription.service';

const HighlightSchema = z.object({
  startTime: z.number().describe('Start time of the clip in seconds'),
  endTime: z.number().describe('End time of the clip in seconds'),
  reason: z.string().describe('Short explanation of why this moment is engaging'),
  score: z
    .number()
    .describe('Engagement score strictly between 0 and 1, e.g. 0.5, 0.82, 0.95. NEVER use a 0-10 or 0-100 scale.')
    // Safety net: if the model still drifts to a 0-10 or 0-100 scale, normalize instead of hard-failing.
    .transform((val) => {
      if (val > 1 && val <= 10) return val / 10;
      if (val > 10 && val <= 100) return val / 100;
      return val;
    })
    .pipe(z.number().min(0).max(1)),
});

const HighlightsResponseSchema = z.object({
  highlights: z.array(HighlightSchema),
});

export type HighlightDto = z.infer<typeof HighlightSchema>;

@Injectable()
export class HighlightDetectionService {
  private readonly logger = new Logger(HighlightDetectionService.name);
  private google: ReturnType<typeof createGoogleGenerativeAI>;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('LLM_API_KEY');
    this.google = createGoogleGenerativeAI({ apiKey });
  }

  async detectHighlights(
    segments: TranscriptSegmentDto[],
    options?: { customPrompt?: string; model?: string },
  ): Promise<HighlightDto[]> {
    const modelName = options?.model || this.configService.get<string>('LLM_MODEL_NAME', 'gemini-flash-latest');
    const transcriptText = segments
      .map((s) => `[${s.startTime.toFixed(1)}s - ${s.endTime.toFixed(1)}s] ${s.text}`)
      .join('\n');

    const systemPrompt = `You are a video editor's assistant. Given a timestamped transcript, identify the 3-5 most engaging, self-contained moments suitable for short vertical clips (15-60 seconds each). Each clip must: (1) be at least 15 seconds long, (2) not exceed 60 seconds, (3) contain a complete, self-contained thought or moment. The "score" field must be a decimal between 0 and 1 (e.g. 0.5, 0.82, 0.95) representing engagement — never use a 0-10 or 0-100 scale.`;

    const userPrompt = options?.customPrompt
      ? `${options.customPrompt}\n\nTranscript:\n${transcriptText}`
      : `Transcript:\n${transcriptText}`;

    this.logger.log(`Detecting highlights with model=${modelName}, transcript segments=${segments.length}`);

    let object: z.infer<typeof HighlightsResponseSchema>;
    try {
      const result = await generateObject({
        model: this.google(modelName),
        schema: HighlightsResponseSchema,
        system: systemPrompt,
        prompt: userPrompt,
        temperature: 0.3,
        maxOutputTokens: 4096,
      });
      object = result.object;
    } catch (e) {
      if (NoObjectGeneratedError.isInstance(e)) {
        this.logger.error(`No object generated. Raw text: ${e.text}`);
        this.logger.error(`Cause: ${JSON.stringify(e.cause)}`);
        this.logger.error(`Finish reason: ${e.finishReason}, usage: ${JSON.stringify(e.usage)}`);
      } else {
        this.logger.error(`LLM call failed for highlight detection: ${e.message}`);
      }
      throw new Error(`Failed to generate highlights: ${e.message}`);
    }

    return object.highlights
      .filter((h) => {
        const valid = h.endTime > h.startTime;
        if (!valid) this.logger.warn(`Dropping invalid highlight: ${JSON.stringify(h)}`);
        return valid;
      })
      .sort((a, b) => b.score - a.score);
  }
}