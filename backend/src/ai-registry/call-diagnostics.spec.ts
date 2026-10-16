import { ServiceUnavailableException } from '@nestjs/common';
import {
  CALL_ERROR,
  callFailure,
  safeGoogleCallMessage,
  safeSchemaKeyword,
} from './call-diagnostics';

describe('Structured-call diagnostic privacy and failure identity', () => {
  it('retains only known schema keywords from Google unknown-field errors', () => {
    expect(
      safeSchemaKeyword(
        'Invalid JSON payload received. Unknown name "maxLength" at tools[0]',
      ),
    ).toBe('maxLength');
    expect(safeSchemaKeyword('Unknown name "privatePrompt"')).toBeUndefined();
  });
  it('keeps known adapter diagnostics without reading arbitrary exception messages', () => {
    const failure = {
      code: 'AI_QUOTA_OR_RATE_LIMIT',
      category: 'quota',
      origin: 'provider_http',
      retryable: true,
      upstreamStatus: 429,
    };
    expect(
      callFailure(
        new ServiceUnavailableException({
          message: 'private prompt/key',
          callFailure: failure,
        }),
      ),
    ).toEqual(failure);
    expect(
      JSON.stringify(callFailure(new Error('private prompt/key'))),
    ).not.toContain('private');
    expect(callFailure(new Error('private prompt/key')).code).toBe(
      CALL_ERROR.EXECUTION,
    );
  });
  it('never echoes arbitrary upstream messages or trailing prompt excerpts', () => {
    expect(
      safeGoogleCallMessage(
        'Invalid JSON payload received. Private request content',
      ),
    ).toBe('Invalid JSON payload received.');
    expect(safeGoogleCallMessage('Private request content')).not.toContain(
      'Private request content',
    );
  });
});
