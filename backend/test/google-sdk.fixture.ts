// Jest runs CommonJS; the ESM SDK is exercised separately by
// scripts/test-provider-adapters.cjs against the real installed package.
import { GoogleAdapter } from '../src/ai-registry/google-adapter.service';
import { providerEndpoint } from '../src/ai-registry/provider-policy';
import type { ProviderTransport } from '../src/ai-registry/provider-transport.service';

export function testGoogleAdapter(transport: Pick<ProviderTransport, 'fetch'>) {
  const adapter = new GoogleAdapter(transport);
  jest
    .spyOn(adapter, 'languageModel')
    .mockImplementation(async (model, provider, secret) => {
      const endpoint = providerEndpoint(provider);
      return {
        doGenerate: async (options: {
          abortSignal: AbortSignal;
          maxOutputTokens: number;
        }) => {
          const response = await transport.fetch(
            provider,
            new Request(
              `${endpoint.baseUrl}/${endpoint.apiVersion}/models/${model.modelId}:generateContent`,
              {
                method: 'POST',
                headers: { 'x-goog-api-key': secret },
                signal: options.abortSignal,
                body: JSON.stringify({
                  contents: [{ parts: [{ text: 'Reply with OK.' }] }],
                  generationConfig: {
                    maxOutputTokens: options.maxOutputTokens,
                  },
                }),
              },
            ),
          );
          if (!response.ok)
            throw Object.assign(new Error('Synthetic SDK HTTP failure'), {
              statusCode: response.status,
              responseBody: await response.text(),
            });
          const body = await response.json();
          const candidate = body.candidates?.[0];
          return {
            content: (candidate?.content?.parts ?? []).map(
              (part: { text: string }) => ({ type: 'text', text: part.text }),
            ),
            finishReason: {
              unified:
                candidate?.finishReason === 'MAX_TOKENS' ? 'length' : 'stop',
            },
            usage: {
              outputTokens: {
                total:
                  (body.usageMetadata?.candidatesTokenCount ?? 0) +
                  (body.usageMetadata?.thoughtsTokenCount ?? 0),
              },
              inputTokens: { total: body.usageMetadata?.promptTokenCount ?? 0 },
            },
          };
        },
      } as unknown as Awaited<ReturnType<GoogleAdapter['languageModel']>>;
    });
  return adapter;
}
