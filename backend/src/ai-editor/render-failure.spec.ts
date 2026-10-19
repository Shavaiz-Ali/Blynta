import { BadRequestException, HttpException } from '@nestjs/common';
import {
  MediaCommandError,
  safeMediaStderr,
} from '../media/utils/media-command-error';
import { renderFailure } from './render-failure';

describe('Editing failure evidence and retry safety', () => {
  it.each([124, 137])(
    'keeps supervisor timeout or kill exit %s retryable',
    (code) => {
      expect(
        renderFailure(new MediaCommandError('ffmpeg', code, null, '')),
      ).toMatchObject({ permanent: false });
    },
  );
  it('marks deterministic FFmpeg failure permanent and preserves its exit status with bounded sanitized stderr', () => {
    const raw =
      "Invalid filter option at https://private.test/video?X-Amz-Signature=secret\nInput /var/private/asset.png and C:\\private\\asset.png\nquoted 'private media title'\nInvalid argument";
    const value = renderFailure(new MediaCommandError('ffmpeg', 1, null, raw));
    expect(value).toMatchObject({
      permanent: true,
      code: 'EDIT_FFMPEG_FAILED',
      exitCode: 1,
    });
    expect(value.stderr).toContain('Invalid argument');
    for (const secret of [
      'private.test',
      'Signature',
      'secret',
      '/var/private',
      'C:\\private',
      'private media title',
    ])
      expect(JSON.stringify(value)).not.toContain(secret);
    expect(safeMediaStderr('x'.repeat(10000)).length).toBeLessThanOrEqual(1500);
  });
  it.each([401, 403, 404, 412])(
    'does not retry permanent storage status %s',
    (status) => {
      expect(
        renderFailure({ $metadata: { httpStatusCode: status } }).permanent,
      ).toBe(true);
    },
  );
  it.each([429, 500, 503])(
    'preserves retries for transient storage status %s',
    (status) => {
      expect(
        renderFailure({ $metadata: { httpStatusCode: status } }).permanent,
      ).toBe(false);
      expect(renderFailure(new HttpException('safe', status)).permanent).toBe(
        false,
      );
    },
  );
  it.each(['EAGAIN', 'EMFILE', 'ENFILE', 'ENOMEM'])(
    'keeps temporary process resource failures retryable: %s',
    (code) => {
      expect(
        renderFailure(new MediaCommandError('ffmpeg', null, null, '', code)),
      ).toMatchObject({ code: 'EDIT_RESOURCE_UNAVAILABLE', permanent: false });
    },
  );
  it('distinguishes invalid input, missing binaries, cancellation and transient process termination', () => {
    expect(renderFailure(new BadRequestException('Invalid plan')).code).toBe(
      'EDIT_VALIDATION',
    );
    expect(
      renderFailure(new MediaCommandError('ffmpeg', null, null, '', 'ENOENT')),
    ).toMatchObject({ code: 'EDIT_TOOL_UNAVAILABLE', permanent: true });
    expect(
      renderFailure(new MediaCommandError('ffmpeg', null, 'SIGKILL', '')),
    ).toMatchObject({ permanent: false });
    expect(
      renderFailure(new MediaCommandError('ffmpeg', 1, null, ''), true),
    ).toMatchObject({ code: 'EDIT_INTERRUPTED', permanent: false });
  });
});
