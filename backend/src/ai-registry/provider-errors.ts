import { HttpStatus } from '@nestjs/common';
import { AI_ERROR_CODES, type AIErrorCode } from '@blynta/types/contracts';
export interface ProviderFailure {
  code: AIErrorCode;
  message: string;
  upstreamStatus?: number;
  upstreamCode?: number;
  upstreamErrorStatus?: string;
  upstreamReason?: string;
  upstreamMessage?: string;
}

const googleStatuses = new Set([
  'INVALID_ARGUMENT',
  'FAILED_PRECONDITION',
  'OUT_OF_RANGE',
  'UNAUTHENTICATED',
  'PERMISSION_DENIED',
  'NOT_FOUND',
  'RESOURCE_EXHAUSTED',
  'DEADLINE_EXCEEDED',
  'UNAVAILABLE',
  'INTERNAL',
  'UNKNOWN',
  'ABORTED',
  'CANCELLED',
  'UNIMPLEMENTED',
]);
const googleReasons = new Set([
  'API_KEY_INVALID',
  'API_KEY_EXPIRED',
  'API_KEY_NOT_FOUND',
  'API_KEY_LEAKED',
  'API_KEY_SERVICE_BLOCKED',
  'API_KEY_HTTP_REFERRER_BLOCKED',
  'API_KEY_IP_ADDRESS_BLOCKED',
  'API_KEY_ANDROID_APP_BLOCKED',
  'API_KEY_IOS_APP_BLOCKED',
  'SERVICE_DISABLED',
  'ACCESS_TOKEN_SCOPE_INSUFFICIENT',
  'IAM_PERMISSION_DENIED',
  'BILLING_DISABLED',
  'CONSUMER_INVALID',
  'RESOURCE_QUOTA_EXCEEDED',
  'RATE_LIMIT_EXCEEDED',
]);
const invalidKeyReasons = new Set([
  'API_KEY_INVALID',
  'API_KEY_EXPIRED',
  'API_KEY_NOT_FOUND',
  'API_KEY_LEAKED',
]);

/** Never expose raw JSON, metadata, response headers, or echoed credentials. */
export function sanitizeProviderMessage(
  value: unknown,
  secret: string,
): string | undefined {
  if (typeof value !== 'string') return undefined;
  let message = value;
  if (secret) {
    for (const representation of new Set([
      secret,
      encodeURIComponent(secret),
      Buffer.from(secret).toString('base64'),
      Buffer.from(secret).toString('hex'),
    ]))
      message = message.split(representation).join('[REDACTED]');
  }
  return (
    message
      .replace(/AIza[A-Za-z0-9_-]+/g, '[REDACTED]')
      .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
      .replace(/(?:https?:\/\/)[^\s"'<>]+/gi, '[URL REDACTED]')
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[EMAIL REDACTED]')
      .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[IP REDACTED]')
      .replace(
        /\b(?:projects\/|project\s+)[A-Za-z0-9_-]+/gi,
        'project [REDACTED]',
      )
      .replace(
        /\b(?:api[_ -]?key|token|authorization)\s*[:=]\s*["']?[^\s"',;]+/gi,
        'credential=[REDACTED]',
      )
      .replace(/[A-Za-z0-9_+/=-]{24,}/g, '[IDENTIFIER REDACTED]')
      // eslint-disable-next-line no-control-regex -- Strip untrusted log control characters.
      .replace(/[\u0000-\u001f\u007f-\u009f\u2028-\u202e\u2066-\u2069]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 1024) || undefined
  );
}

/** Keep diagnostics bounded and allowlist machine fields before logging/returning. */
export async function googleResponseFailure(
  response: Response,
  secret: string,
  credentialCheck = false,
): Promise<ProviderFailure> {
  const diagnostics: Partial<ProviderFailure> = {};
  try {
    const text = await response.text();
    if (text.length <= 65536) {
      const body: unknown = JSON.parse(text);
      const error =
        body && typeof body === 'object' && 'error' in body
          ? body.error
          : undefined;
      if (error && typeof error === 'object') {
        if (
          'code' in error &&
          typeof error.code === 'number' &&
          Number.isInteger(error.code) &&
          error.code >= 100 &&
          error.code <= 599
        )
          diagnostics.upstreamCode = Number(error.code);
        if (
          'status' in error &&
          typeof error.status === 'string' &&
          googleStatuses.has(error.status)
        )
          diagnostics.upstreamErrorStatus = error.status;
        if ('message' in error)
          diagnostics.upstreamMessage = sanitizeProviderMessage(
            error.message,
            secret,
          );
        if ('details' in error && Array.isArray(error.details)) {
          for (const detail of error.details as unknown[]) {
            if (
              detail &&
              typeof detail === 'object' &&
              '@type' in detail &&
              detail['@type'] === 'type.googleapis.com/google.rpc.ErrorInfo' &&
              'reason' in detail &&
              typeof detail.reason === 'string' &&
              googleReasons.has(detail.reason)
            ) {
              diagnostics.upstreamReason = detail.reason;
              break;
            }
          }
        }
      }
    }
  } catch {
    // A non-JSON or unreadable body must not become a credential rejection.
  }
  return {
    ...classifyProviderFailure(
      { status: response.status, ...diagnostics },
      credentialCheck,
    ),
    ...diagnostics,
  };
}

export function credentialWasRejected(
  result: Partial<ProviderFailure> & { valid?: boolean },
): boolean {
  if (
    result.code !== AI_ERROR_CODES.AUTH_OR_ACCESS_FAILED &&
    result.code !== AI_ERROR_CODES.AUTH_FAILED
  )
    return false;
  return (
    (result.upstreamReason !== undefined &&
      invalidKeyReasons.has(result.upstreamReason)) ||
    result.upstreamErrorStatus === 'UNAUTHENTICATED'
  );
}
export function classifyProviderFailure(
  error: unknown,
  credentialCheck = false,
): ProviderFailure {
  const value =
    error && typeof error === 'object'
      ? (error as {
          status?: unknown;
          statusCode?: unknown;
          name?: unknown;
          code?: unknown;
          upstreamErrorStatus?: string;
          upstreamReason?: string;
        })
      : {};
  const status: HttpStatus = Number(value.status ?? value.statusCode ?? 0);
  const googleStatus = value.upstreamErrorStatus;
  const reason = value.upstreamReason ?? '';
  if (
    googleStatus === 'RESOURCE_EXHAUSTED' ||
    ['RESOURCE_QUOTA_EXCEEDED', 'RATE_LIMIT_EXCEEDED'].includes(reason) ||
    status === HttpStatus.TOO_MANY_REQUESTS
  )
    return {
      code: AI_ERROR_CODES.QUOTA_OR_RATE_LIMIT,
      upstreamStatus: status || undefined,
      message:
        'Provider rate limited the request. Retry later and check project quota.',
    };
  if (
    googleStatus === 'DEADLINE_EXCEEDED' ||
    status === HttpStatus.REQUEST_TIMEOUT ||
    status === HttpStatus.GATEWAY_TIMEOUT ||
    ['AbortError', 'TimeoutError'].includes(String(value.name)) ||
    value.code === 'ETIMEDOUT'
  )
    return {
      code: AI_ERROR_CODES.TIMEOUT,
      ...(status ? { upstreamStatus: status } : {}),
      message:
        'Provider request timed out. Check backend connectivity and retry.',
    };
  if (
    status >= HttpStatus.INTERNAL_SERVER_ERROR ||
    ['UNAVAILABLE', 'INTERNAL', 'UNKNOWN'].includes(googleStatus ?? '')
  )
    return {
      code: AI_ERROR_CODES.PROVIDER_FAILED,
      message:
        'Provider is temporarily unavailable. Retry later; this does not establish an invalid API key.',
      ...(status ? { upstreamStatus: status } : {}),
    };
  if (status === HttpStatus.NOT_FOUND || googleStatus === 'NOT_FOUND')
    return {
      code: AI_ERROR_CODES.MODEL_UNAVAILABLE,
      upstreamStatus: status,
      message:
        'The configured model or API version is unavailable. Check the model identifier and provider API version.',
    };
  if (
    [HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN].includes(status) ||
    ['UNAUTHENTICATED', 'PERMISSION_DENIED'].includes(googleStatus ?? '') ||
    invalidKeyReasons.has(reason) ||
    reason.startsWith('API_KEY_') ||
    [
      'SERVICE_DISABLED',
      'ACCESS_TOKEN_SCOPE_INSUFFICIENT',
      'IAM_PERMISSION_DENIED',
      'BILLING_DISABLED',
      'CONSUMER_INVALID',
    ].includes(reason)
  )
    return {
      code: credentialCheck
        ? AI_ERROR_CODES.AUTH_OR_ACCESS_FAILED
        : AI_ERROR_CODES.AUTH_FAILED,
      upstreamStatus: status,
      message: invalidKeyReasons.has(reason)
        ? 'Google rejected this API key as invalid, expired or revoked. Replace the stored credential.'
        : reason === 'API_KEY_IP_ADDRESS_BLOCKED'
          ? 'API key IP restrictions block this backend server. Check the allowed server IP addresses.'
          : reason === 'API_KEY_HTTP_REFERRER_BLOCKED'
            ? 'API key referrer restrictions block server requests. Configure restrictions suitable for this backend.'
            : reason === 'SERVICE_DISABLED'
              ? 'The Gemini API is disabled for this Google project. Enable the service; the API key itself may still be valid.'
              : reason === 'BILLING_DISABLED'
                ? 'Google project billing is disabled. Check billing configuration; the API key itself may still be valid.'
                : 'Provider denied access to this request. Check model permissions and API restrictions; this does not establish that the API key is invalid.',
    };
  if (
    status === HttpStatus.BAD_REQUEST ||
    ['INVALID_ARGUMENT', 'FAILED_PRECONDITION', 'OUT_OF_RANGE'].includes(
      googleStatus ?? '',
    )
  )
    return {
      code: AI_ERROR_CODES.REQUEST_FAILED,
      upstreamStatus: status,
      message:
        'Provider rejected the request parameters or configuration. Credential validity is undetermined; inspect the sanitized upstream diagnostics.',
    };
  if (
    !status &&
    (value.name === 'TypeError' ||
      [
        'ENOTFOUND',
        'EAI_AGAIN',
        'ECONNREFUSED',
        'ECONNRESET',
        'EHOSTUNREACH',
        'ENETUNREACH',
        'ERR_TLS_CERT_ALTNAME_INVALID',
        'CERT_HAS_EXPIRED',
        'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
        'DEPTH_ZERO_SELF_SIGNED_CERT',
      ].includes(String(value.code)))
  )
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

/** Attempt outcome is separate from the persisted credential identity state. */
export function validationOutcome(
  result: Partial<ProviderFailure> & { valid?: boolean },
) {
  const category = result.valid
    ? 'success'
    : credentialWasRejected(result)
      ? 'invalid_api_key'
      : result.code === AI_ERROR_CODES.AUTH_FAILED ||
          result.code === AI_ERROR_CODES.AUTH_OR_ACCESS_FAILED
        ? 'permission_denied'
        : result.code === AI_ERROR_CODES.MODEL_UNAVAILABLE
          ? 'model_unavailable'
          : result.code === AI_ERROR_CODES.REQUEST_FAILED
            ? 'malformed_request'
            : result.code === AI_ERROR_CODES.QUOTA_OR_RATE_LIMIT
              ? 'quota_exceeded'
              : result.code === AI_ERROR_CODES.NETWORK_FAILED
                ? 'network_error'
                : result.code === AI_ERROR_CODES.TIMEOUT
                  ? 'timeout'
                  : result.code === AI_ERROR_CODES.CREDENTIAL_DECRYPT_FAILED
                    ? 'credential_storage_error'
                    : 'provider_unavailable';
  return {
    category,
    credentialStatus: result.valid
      ? 'valid'
      : credentialWasRejected(result)
        ? 'invalid'
        : 'undetermined',
    modelAccessStatus: result.valid ? 'accessible' : 'undetermined',
  };
}
