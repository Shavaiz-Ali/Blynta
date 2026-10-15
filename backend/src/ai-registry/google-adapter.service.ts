import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AI_ERROR_CODES } from '@blynta/types/contracts';
import { ProviderTransport } from './provider-transport.service';
import {
  classifyProviderFailure,
  googleResponseFailure,
} from './provider-errors';
import { providerEndpoint, AI_LIMITS } from './provider-policy';
import { ChatGoogle } from '@langchain/google/node';
import {
  HumanMessage,
  SystemMessage,
  isAIMessage,
} from '@langchain/core/messages';
import { z } from 'zod';
import type { AIModel, AIProvider } from './registry.schemas';

export function providerError(error: unknown) {
  return classifyProviderFailure(error).code;
}
@Injectable()
export class GoogleAdapter {
  readonly freeAuto = true;
  private readonly logger = new Logger(GoogleAdapter.name);
  constructor(private transport: ProviderTransport = new ProviderTransport()) {}
  create(model: AIModel, secret: string, provider: AIProvider) {
    const endpoint = providerEndpoint(provider);
    return new ChatGoogle({
      apiKey: secret,
      endpoint: endpoint.baseUrl,
      apiVersion: endpoint.apiVersion,
      streaming: false,
      apiClient: {
        hasApiKey: () => true,
        getProjectId: () => Promise.resolve(''),
        fetch: (request: Request) => {
          request.headers.set('x-goog-api-key', secret);
          return this.transport.fetch(provider, request);
        },
      },
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
    provider: AIProvider,
  ) {
    try {
      const client = this.create(model, secret, provider).withStructuredOutput(
        schema,
        {
          includeRaw: true,
        },
      );
      const result = await client.invoke(
        [new SystemMessage(system), new HumanMessage(input)],
        { signal, callbacks: [], tags: ['blynta-editing'], configurable: {} },
      );
      return {
        parsed: schema.parse(result.parsed),
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
  async languageModel(
    model: Pick<AIModel, 'modelId'>,
    provider: AIProvider,
    secret: string,
    onResponse?: (status: number) => void,
  ) {
    const { createGoogleGenerativeAI } = await import('@ai-sdk/google');
    const endpoint = providerEndpoint(provider);
    return createGoogleGenerativeAI({
      apiKey: secret,
      baseURL: endpoint.baseUrl + '/' + endpoint.apiVersion,
      fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
        const response = await this.transport.fetch(
          provider,
          new Request(input, init),
        );
        onResponse?.(response.status);
        return response;
      },
    })(model.modelId);
  }
  async validateCredential(
    provider: AIProvider,
    secret: string,
    signal: AbortSignal,
    model: Pick<AIModel, 'modelId' | 'settings'>,
  ) {
    let responseStatus: number | undefined;
    try {
      // Share the SDK factory, endpoint and protected transport with highlight inference.
      const client = await this.languageModel(
        model,
        provider,
        secret,
        (status) => {
          responseStatus = status;
        },
      );
      const result = await client.doGenerate({
        prompt: [
          { role: 'user', content: [{ type: 'text', text: 'Reply with OK.' }] },
        ],
        maxOutputTokens: Math.min(
          AI_LIMITS.TEST_OUTPUT_TOKENS,
          model.settings.maxOutputTokens,
        ),
        temperature: model.settings.temperature,
        abortSignal: signal,
      });
      const text = result.content.some(
        (part) => part.type === 'text' && part.text.trim().length > 0,
      );
      // Thinking models can exhaust the small budget before returning text.
      const capped =
        result.finishReason.unified === 'length' &&
        (result.usage.outputTokens.total ?? 0) +
          (result.usage.inputTokens.total ?? 0) >
          0;
      if (text || capped) return { valid: true };
      return {
        valid: false,
        ...classifyProviderFailure({ status: 400 }, true),
        message:
          'The model returned no generated text. Check model generation settings and availability; credential validity is undetermined.',
      };
    } catch (error) {
      // SDK API errors retain the HTTP body. Parse only allowlisted diagnostics;
      // never log the error object, request URL, headers or raw body.
      const sdk = error as {
        statusCode?: unknown;
        responseBody?: unknown;
      } | null;
      const status = Number(sdk?.statusCode);
      const failure =
        responseStatus !== undefined &&
        responseStatus >= 200 &&
        responseStatus < 300
          ? {
              code: AI_ERROR_CODES.PROVIDER_FAILED,
              upstreamStatus: responseStatus,
              message:
                'Provider returned a malformed generation response. Credential validity is undetermined.',
            }
          : status >= 400 &&
              status <= 599 &&
              typeof sdk?.responseBody === 'string'
            ? await googleResponseFailure(
                new Response(sdk.responseBody, { status }),
                secret,
                true,
              )
            : classifyProviderFailure(error, true);
      this.logger.warn(
        JSON.stringify({
          operation: 'credential-validation',
          modelId: model.modelId,
          ...failure,
        }),
      );
      return { valid: false, ...failure };
    }
  }
  async verifyModel(
    modelId: string,
    secret: string,
    signal: AbortSignal,
    provider: AIProvider,
  ) {
    const endpoint = providerEndpoint(provider);
    const response = await this.transport.fetch(
      provider,
      new Request(
        endpoint.baseUrl +
          '/' +
          endpoint.apiVersion +
          '/models/' +
          encodeURIComponent(modelId),
        { headers: { 'x-goog-api-key': secret }, signal },
      ),
    );
    if (!response.ok) {
      const failure = await googleResponseFailure(response, secret);
      this.logger.warn(
        JSON.stringify({ operation: 'model-lookup', ...failure }),
      );
      throw new ServiceUnavailableException(failure);
    }
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
