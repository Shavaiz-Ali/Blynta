import { HttpStatus } from '@nestjs/common';
import { AI_ERROR_CODES, type AIErrorCode } from '@blynta/types/contracts';
export interface ProviderFailure {
  code: AIErrorCode;
  message: string;
  upstreamStatus?: number;
}
export function classifyProviderFailure(
  error: unknown,
  credentialCheck = false,
): ProviderFailure {
  const value =
    error && typeof error === 'object'
      ? (error as { status?: unknown; statusCode?: unknown; name?: unknown })
      : {};
  const status: HttpStatus = Number(value.status ?? value.statusCode ?? 0);
  if (
    [HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN].includes(status) ||
    (credentialCheck && status === HttpStatus.BAD_REQUEST)
  )
    return {
      code: credentialCheck
        ? AI_ERROR_CODES.AUTH_OR_ACCESS_FAILED
        : AI_ERROR_CODES.AUTH_FAILED,
      upstreamStatus: status,
      message:
        'Provider rejected access. Check the API key, API access and restrictions for this backend server.',
    };
  if (status === HttpStatus.NOT_FOUND)
    return {
      code: AI_ERROR_CODES.MODEL_UNAVAILABLE,
      upstreamStatus: status,
      message: 'Provider model or API endpoint is unavailable.',
    };
  if (status === HttpStatus.TOO_MANY_REQUESTS)
    return {
      code: AI_ERROR_CODES.QUOTA_OR_RATE_LIMIT,
      upstreamStatus: status,
      message:
        'Provider rate limited the request. Retry later and check project quota.',
    };
  if (['AbortError', 'TimeoutError'].includes(String(value.name)))
    return {
      code: AI_ERROR_CODES.TIMEOUT,
      message:
        'Provider request timed out. Check backend connectivity and retry.',
    };
  if (!status && value.name === 'TypeError')
    return {
      code: AI_ERROR_CODES.NETWORK_FAILED,
      message:
        'Backend could not reach the provider. Check DNS, TLS, proxy settings and outbound HTTPS access.',
    };
  return {
    code: AI_ERROR_CODES.PROVIDER_FAILED,
    message: 'Provider could not complete the request.',
    ...(status ? { upstreamStatus: status } : {}),
  };
}
