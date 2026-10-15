import { BadRequestException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { AIAdapterType } from '@blynta/types/contracts';

/** Approved protocols/origins, not an admin-editable arbitrary proxy allowlist. */
export const ADAPTER_POLICY = {
  google: {
    baseUrl: 'https://generativelanguage.googleapis.com',
    apiVersion: 'v1beta',
    versions: ['v1', 'v1beta'],
  },
} as const;
export const AI_LIMITS = {
  CREDENTIAL_TIMEOUT_MS: 15000,
  CREDENTIAL_SUCCESS_TTL_MS: 5 * 60 * 1000,
  MAX_RESPONSE_BYTES: 8 * 1024 * 1024,
  MAX_REQUEST_BYTES: 4 * 1024 * 1024,
  MAX_MODEL_LIST: 100,
  MAX_RETRIES: 0,
  TEST_OUTPUT_TOKENS: 128,
  HIGHLIGHT_TEST_OUTPUT_TOKENS: 1024,
} as const;
export const AI_ROUTING = { LEGACY_DEFAULT: 'editing-default' } as const;
export function providerRevisionFilter(revision?: number) {
  return (revision ?? 1) === 1
    ? { $or: [{ revision: 1 }, { revision: { $exists: false } }] }
    : { revision };
}
export function implementedAdapter(
  adapter: string,
): adapter is keyof typeof ADAPTER_POLICY {
  return Object.hasOwn(ADAPTER_POLICY, adapter);
}
export function validateProviderEndpoint(
  adapter: AIAdapterType,
  baseUrl: string,
  apiVersion: string,
) {
  const policy = implementedAdapter(adapter)
    ? ADAPTER_POLICY[adapter]
    : undefined;
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new BadRequestException('Invalid provider base URL');
  }
  if (
    !policy ||
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !['', '/'].includes(url.pathname) ||
    url.origin !== policy.baseUrl ||
    !(policy.versions as readonly string[]).includes(apiVersion)
  )
    throw new BadRequestException(
      'Provider endpoint or API version is not approved for this adapter',
    );
  return { baseUrl: url.origin, apiVersion };
}
/** Legacy reads use an explicit, pinned compatibility policy until the backfill runs. */
export function providerEndpoint(provider: {
  adapter: AIAdapterType;
  baseUrl?: string;
  apiVersion?: string;
}) {
  const policy = implementedAdapter(provider.adapter)
    ? ADAPTER_POLICY[provider.adapter]
    : undefined;
  if (!policy) throw new BadRequestException('Adapter is not implemented');
  return validateProviderEndpoint(
    provider.adapter,
    provider.baseUrl ?? policy.baseUrl,
    provider.apiVersion ?? policy.apiVersion,
  );
}

export function providerConfigurationHash(
  provider: Parameters<typeof providerEndpoint>[0] & { settings?: unknown },
) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        adapter: provider.adapter,
        ...providerEndpoint(provider),
        settings: provider.settings ?? null,
      }),
    )
    .digest('hex');
}

export function legacyProviderTestCompatible(
  provider: Parameters<typeof providerEndpoint>[0] & {
    revision?: number;
    settings?: unknown;
  },
) {
  const policy = implementedAdapter(provider.adapter)
    ? ADAPTER_POLICY[provider.adapter]
    : undefined;
  const endpoint = providerEndpoint(provider);
  return (
    !!policy &&
    provider.settings === undefined &&
    (provider.revision ?? 1) === 1 &&
    endpoint.baseUrl === policy.baseUrl &&
    endpoint.apiVersion === policy.apiVersion
  );
}
