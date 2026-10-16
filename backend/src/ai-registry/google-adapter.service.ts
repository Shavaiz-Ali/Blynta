import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  BadRequestException,
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
import {
  CALL_ERROR,
  callCategory,
  callRetryable,
  safeGoogleCallMessage,
  safeExceptionType,
  safeSchemaKeyword,
  type CallFailure,
} from './call-diagnostics';
import type { ProviderFailure } from './provider-errors';

export function providerError(error: unknown) {
  return classifyProviderFailure(error).code;
}
@Injectable()
export class GoogleAdapter {
  readonly freeAuto = true;
  private readonly logger = new Logger(GoogleAdapter.name);
  constructor(private transport: ProviderTransport = new ProviderTransport()) {}
  create(
    model: AIModel,
    secret: string,
    provider: AIProvider,
    observe?: {
      response: (response: Response) => Promise<void>;
      transportError: (error: unknown) => void;
    },
  ) {
    const endpoint = providerEndpoint(provider);
    return new ChatGoogle({
      apiKey: secret,
      endpoint: endpoint.baseUrl,
      apiVersion: endpoint.apiVersion,
      streaming: false,
      apiClient: {
        hasApiKey: () => true,
        getProjectId: () => Promise.resolve(''),
        fetch: async (request: Request) => {
          request.headers.set('x-goog-api-key', secret);
          let response: Response;
          try {
            response = await this.transport.fetch(provider, request);
          } catch (error) {
            observe?.transportError(error);
            throw error;
          }
          await observe?.response(response);
          return response;
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
    let responseStatus: number | undefined;
    let httpFailure: ProviderFailure | undefined;
    let transportError: unknown;
    let tokenLimited = false;
    let phase: 'configuration' | 'invocation' | 'parsing' = 'configuration';
    try {
      const client = this.create(model, secret, provider, {
        transportError: (error) => {
          transportError = error;
        },
        response: async (response) => {
          responseStatus = response.status;
          if (!response.ok)
            httpFailure = await googleResponseFailure(response.clone(), secret);
          else {
            try {
              const body = (await response.clone().json()) as {
                candidates?: { finishReason?: string }[];
              };
              tokenLimited =
                body.candidates?.[0]?.finishReason === 'MAX_TOKENS';
            } catch {
              /* The SDK/parser will reject malformed response bodies. */
            }
          }
        },
      }).withStructuredOutput(schema, {
        includeRaw: true,
        method: 'functionCalling', // Existing LangChain default, made explicit.
      });
      phase = 'invocation';
      const result = await client.invoke(
        [new SystemMessage(system), new HumanMessage(input)],
        { signal, callbacks: [], tags: ['blynta-editing'], configurable: {} },
      );
      phase = 'parsing';
      if (tokenLimited) throw new Error('Token limit');
      return {
        parsed: schema.parse(result.parsed),
        usage: isAIMessage(result.raw) ? result.raw.usage_metadata : undefined,
      };
    } catch (error) {
      const classified = classifyProviderFailure(transportError ?? error);
      const code =
        httpFailure?.code ??
        (tokenLimited
          ? CALL_ERROR.TOKEN_LIMIT
          : signal.aborted
            ? AI_ERROR_CODES.TIMEOUT
            : error instanceof z.ZodError ||
                (responseStatus !== undefined && responseStatus < 300)
              ? CALL_ERROR.STRUCTURED_OUTPUT
              : transportError !== undefined
                ? classified.code
                : CALL_ERROR.ADAPTER);
      const category =
        httpFailure?.upstreamStatus === 403 ||
        httpFailure?.upstreamErrorStatus === 'PERMISSION_DENIED'
          ? 'permission'
          : callCategory(code);
      const failure: CallFailure = {
        code,
        category,
        exceptionType: safeExceptionType(transportError ?? error),
        phase,
        retryable: callRetryable(category),
        origin: httpFailure
          ? 'provider_http'
          : transportError !== undefined
            ? 'transport'
            : responseStatus !== undefined
              ? 'provider_response'
              : 'adapter',
        ...(responseStatus !== undefined
          ? { upstreamStatus: responseStatus }
          : {}),
        ...(httpFailure
          ? {
              upstreamErrorStatus: httpFailure.upstreamErrorStatus,
              upstreamReason: httpFailure.upstreamReason,
              upstreamMessage: safeGoogleCallMessage(
                httpFailure.upstreamMessage,
              ),
              upstreamSchemaKeyword: safeSchemaKeyword(
                httpFailure.upstreamMessage,
              ),
            }
          : {}),
      };
      const body = {
        code,
        message:
          httpFailure?.message ??
          (category === 'structured_output'
            ? 'AI returned malformed structured output'
            : category === 'token_limit'
              ? 'AI output reached the configured token limit'
              : category === 'timeout'
                ? 'AI model request timed out'
                : 'AI adapter could not complete structured generation'),
        callFailure: failure,
        issues: [failure], // Preserve code and safe details in the shared API envelope.
        phase,
      };
      if (
        category === 'structured_output' ||
        category === 'token_limit' ||
        category === 'request'
      )
        throw new BadRequestException(body);
      throw new ServiceUnavailableException(body);
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
