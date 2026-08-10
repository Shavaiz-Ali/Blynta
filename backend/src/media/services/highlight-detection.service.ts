import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { TranscriptSegmentDto } from './transcription.service';

export interface HighlightDto {
  startTime: number;
  endTime: number;
  reason: string;
  score: number;
}

@Injectable()
export class HighlightDetectionService {
  private readonly logger = new Logger(HighlightDetectionService.name);
  private client: OpenAI;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('LLM_API_KEY');
    const baseURL = this.configService.get<string>('LLM_BASE_URL');
    this.client = new OpenAI({
      apiKey,
      baseURL: baseURL || undefined,
    });
  }

  async detectHighlights(
    segments: TranscriptSegmentDto[],
    options?: { customPrompt?: string; model?: string },
  ): Promise<HighlightDto[]> {
    const model = options?.model || this.configService.get<string>('LLM_DEFAULT_MODEL', 'gpt-4o-mini');
    const transcriptText = segments
      .map((s) => `[${s.startTime.toFixed(1)}s - ${s.endTime.toFixed(1)}s] ${s.text}`)
      .join('\n');

    const systemPrompt = `You are a video editor's assistant. Given a timestamped transcript, identify the 3-5 most engaging, self-contained moments suitable for short vertical clips (15-60 seconds each). Each clip must: (1) be at least 15 seconds long, (2) not exceed 60 seconds, (3) contain a complete, self-contained thought or moment. Return ONLY valid JSON matching this exact shape, no other text, no markdown fences, no commentary:
{"highlights": [{"startTime": number, "endTime": number, "reason": "short string explaining why this is engaging", "score": number between 0 and 1}]}`;

    const userPrompt = options?.customPrompt
      ? `${options.customPrompt}\n\nTranscript:\n${transcriptText}`
      : `Transcript:\n${transcriptText}`;

    this.logger.log(`Detecting highlights with model=${model}, transcript segments=${segments.length}`);

    const response = await this.client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) throw new Error('LLM returned no content for highlight detection');

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      this.logger.error(`Failed to parse LLM response as JSON. Raw response: ${raw}`);
      throw new Error('LLM returned invalid JSON for highlight detection');
    }

    const highlights: HighlightDto[] = Array.isArray(parsed)
      ? parsed
      : parsed.highlights || parsed.data || [];

    return highlights
      .filter((h: HighlightDto) => {
        const valid = typeof h.startTime === 'number'
          && typeof h.endTime === 'number'
          && h.endTime > h.startTime;
        if (!valid) this.logger.warn(`Dropping invalid highlight: ${JSON.stringify(h)}`);
        return valid;
      })
      .map((h: HighlightDto) => ({
        startTime: Number(h.startTime),
        endTime: Number(h.endTime),
        reason: String(h.reason || ''),
        score: Math.max(0, Math.min(1, Number(h.score) || 0.5)),
      }))
      .sort((a: HighlightDto, b: HighlightDto) => b.score - a.score);
  }
}
