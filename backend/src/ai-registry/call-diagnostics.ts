import { HttpException } from '@nestjs/common';
import { AI_ERROR_CODES } from '@blynta/types/contracts';

export const CALL_ERROR = {
  STRUCTURED_OUTPUT: 'AI_STRUCTURED_OUTPUT_INVALID',
  TOKEN_LIMIT: 'AI_OUTPUT_TOKEN_LIMIT',
  ADAPTER: 'AI_ADAPTER_FAILED',
  EXECUTION: 'AI_EXECUTION_FAILED',
} as const;
export interface CallFailure {
  code: string;
  category:
    | 'request'
    | 'authentication'
    | 'permission'
    | 'quota'
    | 'provider'
    | 'network'
    | 'timeout'
    | 'structured_output'
    | 'token_limit'
    | 'adapter'
    | 'execution';
  origin:
    | 'provider_http'
    | 'provider_response'
    | 'transport'
    | 'adapter'
    | 'execution';
  retryable: boolean;
  upstreamStatus?: number;
  upstreamErrorStatus?: string;
  upstreamReason?: string;
  upstreamMessage?: string;
  upstreamSchemaKeyword?: string;
  exceptionType?: string;
  phase?: 'configuration' | 'invocation' | 'parsing' | 'execution';
}
export function safeSchemaKeyword(message?: string): string | undefined {
  const match = message?.match(/Unknown name ["']([^"']+)["']/i);
  return match &&
    [
      'additionalProperties',
      'anyOf',
      'oneOf',
      'allOf',
      '$schema',
      'maxLength',
      'minLength',
      'maxItems',
      'minItems',
      'default',
      'pattern',
      'nullable',
    ].includes(match[1])
    ? match[1]
    : undefined;
}
export function safeExceptionType(error: unknown): string {
  const name =
    error && typeof error === 'object' && 'name' in error ? error.name : '';
  return typeof name === 'string' &&
    [
      'ConfigurationError',
      'MalformedOutputError',
      'OutputParserException',
      'ZodError',
      'TypeError',
      'SyntaxError',
      'AbortError',
      'TimeoutError',
      'GaxiosError',
    ].includes(name)
    ? name
    : 'Error';
}
export function callCategory(code: string): CallFailure['category'] {
  switch (code) {
    case AI_ERROR_CODES.REQUEST_FAILED:
      return 'request';
    case AI_ERROR_CODES.AUTH_FAILED:
      return 'authentication';
    case AI_ERROR_CODES.AUTH_OR_ACCESS_FAILED:
      return 'permission';
    case AI_ERROR_CODES.QUOTA_OR_RATE_LIMIT:
      return 'quota';
    case AI_ERROR_CODES.NETWORK_FAILED:
      return 'network';
    case AI_ERROR_CODES.TIMEOUT:
      return 'timeout';
    case CALL_ERROR.STRUCTURED_OUTPUT:
      return 'structured_output';
    case CALL_ERROR.TOKEN_LIMIT:
      return 'token_limit';
    case CALL_ERROR.ADAPTER:
      return 'adapter';
    case CALL_ERROR.EXECUTION:
      return 'execution';
    default:
      return 'provider';
  }
}
export function callRetryable(category: CallFailure['category']) {
  return [
    'quota',
    'provider',
    'network',
    'timeout',
    'structured_output',
  ].includes(category);
}
// Preserve only diagnostics produced by our adapter, never arbitrary exception messages.
export function callFailure(error: unknown, aborted = false): CallFailure {
  if (error instanceof HttpException) {
    const body = error.getResponse();
    if (body && typeof body === 'object' && 'callFailure' in body) {
      return body.callFailure as CallFailure;
    }
    if (
      body &&
      typeof body === 'object' &&
      'code' in body &&
      body.code === CALL_ERROR.STRUCTURED_OUTPUT
    )
      return {
        code: CALL_ERROR.STRUCTURED_OUTPUT,
        category: 'structured_output',
        origin: 'provider_response',
        retryable: true,
      };
    const code =
      body &&
      typeof body === 'object' &&
      'code' in body &&
      typeof body.code === 'string' &&
      Object.values(AI_ERROR_CODES).some((value) => value === body.code)
        ? body.code
        : error.getStatus() === 429
          ? AI_ERROR_CODES.QUOTA_OR_RATE_LIMIT
          : error.getStatus() === 400 || error.getStatus() === 409
            ? AI_ERROR_CODES.REQUEST_FAILED
            : undefined;
    if (code) {
      const category = callCategory(code);
      return {
        code,
        category,
        origin: 'execution',
        retryable: callRetryable(category),
      };
    }
  }
  return aborted
    ? {
        code: AI_ERROR_CODES.TIMEOUT,
        category: 'timeout',
        origin: 'execution',
        retryable: true,
      }
    : {
        code: CALL_ERROR.EXECUTION,
        category: 'execution',
        origin: 'execution',
        retryable: false,
      };
}

/** Arbitrary provider text can echo prompts. Retain known safe message prefixes only. */
export function safeGoogleCallMessage(message?: string): string | undefined {
  if (!message) return undefined;
  const prefixes = [
    'API key not valid. Please pass a valid API key.',
    'Invalid JSON payload received.',
    'Request contains an invalid argument.',
    'You exceeded your current quota',
    'The model is overloaded.',
    'Permission denied',
    'Deadline exceeded',
  ];
  return (
    prefixes.find((prefix) => message.startsWith(prefix)) ??
    'Provider message omitted because it may contain request content; inspect status and reason.'
  );
}
