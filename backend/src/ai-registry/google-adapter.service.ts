import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ProviderTransport } from './provider-transport.service';
import { classifyProviderFailure } from './provider-errors';
import { providerEndpoint } from './provider-policy';
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
  async languageModel(model: AIModel, provider: AIProvider, secret: string) {
    const { createGoogleGenerativeAI } = await import('@ai-sdk/google');
    const endpoint = providerEndpoint(provider);
    return createGoogleGenerativeAI({
      apiKey: secret,
      baseURL: endpoint.baseUrl + '/' + endpoint.apiVersion,
      fetch: (input: RequestInfo | URL, init?: RequestInit) =>
        this.transport.fetch(provider, new Request(input, init)),
    })(model.modelId);
  }
  async validateCredential(
    provider: AIProvider,
    secret: string,
    signal: AbortSignal,
  ) {
    try {
      const endpoint = providerEndpoint(provider);
      const response = await this.transport.fetch(
        provider,
        new Request(
          endpoint.baseUrl + '/' + endpoint.apiVersion + '/models?pageSize=1',
          { headers: { 'x-goog-api-key': secret }, signal },
        ),
      );
      return response.ok
        ? { valid: true }
        : {
            valid: false,
            ...classifyProviderFailure({ status: response.status }, true),
          };
    } catch (error) {
      return { valid: false, ...classifyProviderFailure(error, true) };
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
    if (!response.ok)
      throw new ServiceUnavailableException(
        classifyProviderFailure({ status: response.status }),
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
