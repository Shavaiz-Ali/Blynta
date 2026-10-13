import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { LanguageModel } from 'ai';
import type { z } from 'zod';
import {
  AI_ERROR_CODES,
  AI_ADAPTERS,
  type AIAdapterType,
} from '@blynta/types/contracts';
import { ADAPTER_POLICY, implementedAdapter } from './provider-policy';
import type { AIModel, AIProvider } from './registry.schemas';
import { GoogleAdapter } from './google-adapter.service';
import type { ProviderFailure } from './provider-errors';
export interface AIProviderAdapter {
  readonly freeAuto: boolean;
  validateCredential(
    provider: AIProvider,
    secret: string,
    signal: AbortSignal,
  ): Promise<{ valid: boolean } & Partial<ProviderFailure>>;
  verifyModel(
    modelId: string,
    secret: string,
    signal: AbortSignal,
    provider: AIProvider,
  ): Promise<void>;
  structured<T>(
    model: AIModel,
    secret: string,
    schema: z.ZodType<T>,
    system: string,
    input: string,
    signal: AbortSignal,
    provider: AIProvider,
  ): Promise<{
    parsed: T;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      total_tokens?: number;
    };
  }>;
  languageModel(
    model: AIModel,
    provider: AIProvider,
    secret: string,
  ): Promise<LanguageModel>;
}
@Injectable()
export class ProviderAdapterRegistry {
  private readonly adapters: ReadonlyMap<AIAdapterType, AIProviderAdapter>;
  constructor(google: GoogleAdapter) {
    this.adapters = new Map([['google', google]]);
  }
  supports(adapter: string) {
    return this.adapters.has(adapter as AIAdapterType);
  }
  supportsFreeAuto(adapter: string) {
    return this.get(adapter).freeAuto;
  }
  options() {
    return AI_ADAPTERS.map((adapter) => ({
      adapter,
      implemented: this.supports(adapter),
      ...(implementedAdapter(adapter)
        ? {
            endpointDefaults: {
              baseUrl: ADAPTER_POLICY[adapter].baseUrl,
              apiVersion: ADAPTER_POLICY[adapter].apiVersion,
            },
            apiVersions: ADAPTER_POLICY[adapter].versions,
          }
        : {}),
    }));
  }
  get(adapter: string): AIProviderAdapter {
    const implementation = this.adapters.get(adapter as AIAdapterType);
    if (!implementation)
      throw new ServiceUnavailableException({
        code: AI_ERROR_CODES.UNSUPPORTED_ADAPTER,
        message: 'Provider adapter is not implemented',
        issues: [],
      });
    return implementation;
  }
}
