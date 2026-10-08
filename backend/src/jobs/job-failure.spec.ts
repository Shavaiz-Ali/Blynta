import { jobFailure } from './job-failure';
import { SourcePlatform } from './schemas/job.schema';

describe('public job failure explanations', () => {
  const preparation = {
    sourcePlatform: SourcePlatform.YOUTUBE,
    errorStage: 'pending',
  };
  it.each([
    [
      'This video requires YouTube authentication cookies, which are missing or expired. Refresh YOUTUBE_COOKIES_PATH /private/cookies.txt',
      'source_authentication_required',
    ],
    ['Sign in to confirm you are not a bot', 'source_authentication_required'],
    ['Video unavailable', 'source_unavailable'],
    ['Private video', 'source_unavailable'],
    ['HTTP Error 404', 'source_unavailable'],
    ['ETIMEDOUT at /private/video.mp4', 'network_error'],
    ['ffmpeg command not found', 'preparation_failed'],
    ['YOUTUBE_COOKIES_PATH file not found', 'preparation_failed'],
    ['unknown download failure', 'preparation_failed'],
  ])('classifies %s as %s', (errorMessage, code) => {
    const job = { ...preparation, errorMessage };
    const failure = jobFailure(job)!;
    expect(failure.code).toBe(code);
    expect(failure.message).not.toMatch(
      /YOUTUBE_COOKIES_PATH|\/private|ffmpeg|ETIMEDOUT|cookies|stack/i,
    );
    expect(job.errorMessage).toBe(errorMessage);
  });
  it('does not infer source authentication from a later processing error', () => {
    expect(
      jobFailure({
        ...preparation,
        errorStage: 'transcribing',
        errorMessage: 'authentication required by transcription provider',
      })?.code,
    ).toBe('processing_failed');
    expect(
      jobFailure({
        ...preparation,
        sourcePlatform: SourcePlatform.UPLOAD,
        errorMessage: 'authentication required',
      })?.code,
    ).toBe('preparation_failed');
  });
  it('provides safe stage messages and handles missing diagnostics', () => {
    expect(
      jobFailure({
        errorStage: 'transcribing',
        errorMessage: 'secret-provider-key',
      })?.message,
    ).toContain('transcript');
    expect(
      jobFailure({
        errorStage: 'detecting_highlights',
        errorMessage: 'stack trace',
      })?.message,
    ).toContain('best moments');
    expect(jobFailure({})).toBeUndefined();
  });
});
