import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ChatGoogle } from '@langchain/google/node';
import {
  HumanMessage,
  SystemMessage,
  isAIMessage,
} from '@langchain/core/messages';
import { z } from 'zod';
import type { AIModel } from './registry.schemas';

export function providerError(error: unknown) {
  const status =
    typeof error === 'object' && error !== null && 'status' in error
      ? Number(error.status)
      : 0;
  if (status === 401 || status === 403) return 'AI_AUTH_FAILED';
  if (status === 404) return 'AI_MODEL_UNAVAILABLE';
  if (status === 429) return 'AI_QUOTA_OR_RATE_LIMIT';
  if (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    ['AbortError', 'TimeoutError'].includes(String(error.name))
  )
    return 'AI_TIMEOUT';
  return 'AI_PROVIDER_FAILED';
}
@Injectable()
export class GoogleAdapter {
  create(model: AIModel, secret: string) {
    return new ChatGoogle({
      apiKey: secret,
      model: model.modelId,
      platformType: 'gai',
      temperature: model.settings.temperature,
      maxOutputTokens: model.settings.maxOutputTokens,
      maxRetries: 0,
    });
  }
  async structured<T>(
    model: AIModel,
    secret: string,
    schema: z.ZodType<T>,
    system: string,
    input: string,
    signal: AbortSignal,
  ) {
    try {
      const client = this.create(model, secret).withStructuredOutput(schema, {
        includeRaw: true,
      });
      const result = await client.invoke(
        [new SystemMessage(system), new HumanMessage(input)],
        { signal, callbacks: [], tags: ['blynta-editing'], configurable: {} },
      );
      return {
        parsed: result.parsed,
        usage: isAIMessage(result.raw) ? result.raw.usage_metadata : undefined,
      };
    } catch (error) {
      throw new ServiceUnavailableException({
        message: 'AI provider request failed',
        code: providerError(error),
        issues: [],
      });
    }
  }
  async verifyModel(modelId: string, secret: string, signal: AbortSignal) {
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/' +
        encodeURIComponent(modelId),
      { headers: { 'x-goog-api-key': secret }, signal },
    );
    if (!response.ok)
      throw new ServiceUnavailableException(
        'AI model or credential is unavailable',
      );
    const data: unknown = await response.json();
    if (
      !data ||
      typeof data !== 'object' ||
      !('supportedGenerationMethods' in data) ||
      !Array.isArray(data.supportedGenerationMethods) ||
      !data.supportedGenerationMethods.includes('generateContent')
    )
      throw new ServiceUnavailableException(
        'Model does not support content generation',
      );
  }
}
