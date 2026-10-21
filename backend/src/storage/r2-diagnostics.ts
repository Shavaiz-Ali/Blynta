import { safeMediaStderr } from '../media/utils/media-command-error';

/** Only allowlisted error fields; never serialize SDK requests, responses or URLs. */
export function r2FailureDetails(error: unknown, credentials: string[] = []) {
  const redact = (text: string) =>
    safeMediaStderr(
      [
        ...credentials,
        process.env.R2_ACCESS_KEY_ID,
        process.env.R2_SECRET_ACCESS_KEY,
      ]
        .filter((value): value is string => !!value)
        .sort((a, b) => b.length - a.length)
        .reduce((safe, value) => safe.split(value).join('[CREDENTIAL]'), text)
        .replace(/\bauthorization\s*[:=][^\r\n]*/gi, '[AUTHORIZATION]'),
    );
  const failure = error as {
    name?: unknown;
    message?: unknown;
    $metadata?: { httpStatusCode?: unknown; requestId?: unknown };
  } | null;
  return {
    exceptionType:
      typeof failure?.name === 'string' ? redact(failure.name) : 'UnknownError',
    message:
      typeof failure?.message === 'string'
        ? redact(failure.message)
        : undefined,
    httpStatusCode:
      typeof failure?.$metadata?.httpStatusCode === 'number'
        ? failure.$metadata.httpStatusCode
        : undefined,
    requestId:
      typeof failure?.$metadata?.requestId === 'string'
        ? redact(failure.$metadata.requestId)
        : undefined,
  };
}
