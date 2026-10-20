import { HttpException } from '@nestjs/common';
import { UnrecoverableError } from 'bullmq';
import {
  MediaCommandError,
  safeMediaStderr,
} from '../media/utils/media-command-error';

export function renderFailure(error: unknown, aborted = false) {
  const value = error as {
    name?: string;
    code?: string;
    $metadata?: { httpStatusCode?: number };
  } | null;
  const status =
    error instanceof HttpException
      ? error.getStatus()
      : value?.$metadata?.httpStatusCode;
  const command = error instanceof MediaCommandError ? error : undefined;
  const transientSpawn = ['EAGAIN', 'EMFILE', 'ENFILE', 'ENOMEM'].includes(
    command?.spawnCode ?? '',
  );
  // The Linux host supervisor returns timeout's exit status, not a child signal.
  const transientExit = [124, 137].includes(command?.exitCode ?? -1);
  const deterministicCommand =
    !!command && !command.signal && !transientSpawn && !transientExit;
  const storagePermanent =
    [401, 403, 404, 412].includes(status ?? 0) ||
    ['NoSuchKey', 'NotFound', 'PreconditionFailed', 'AccessDenied'].includes(
      value?.name ?? '',
    );
  const localPermanent = ['ENOENT', 'EACCES', 'EPERM', 'ENOSPC'].includes(
    value?.code ?? '',
  );
  const permanent =
    !aborted &&
    (error instanceof UnrecoverableError ||
      deterministicCommand ||
      storagePermanent ||
      localPermanent ||
      (error instanceof HttpException &&
        status! < 500 &&
        status !== 408 &&
        status !== 429));
  return {
    exceptionType: [
      'Error',
      'TypeError',
      'MediaCommandError',
      'BadRequestException',
      'NoSuchKey',
      'NotFound',
      'AccessDenied',
      'PreconditionFailed',
    ].includes(value?.name ?? '')
      ? value!.name
      : 'Error',
    code: aborted
      ? 'EDIT_INTERRUPTED'
      : command
        ? command.spawnCode
          ? transientSpawn
            ? 'EDIT_RESOURCE_UNAVAILABLE'
            : 'EDIT_TOOL_UNAVAILABLE'
          : command.exitCode === 124
            ? 'EDIT_COMMAND_TIMEOUT'
            : command.exitCode === 137
              ? 'EDIT_RESOURCE_UNAVAILABLE'
              : 'EDIT_FFMPEG_FAILED'
        : localPermanent
          ? 'EDIT_LOCAL_INPUT_FAILURE'
          : storagePermanent
            ? 'EDIT_STORAGE_ACCESS'
            : error instanceof HttpException && permanent
              ? 'EDIT_VALIDATION'
              : 'EDIT_RENDER_FAILURE',
    permanent,
    ...(status ? { upstreamStatus: status } : {}),
    ...(value?.code &&
    [
      'ENOENT',
      'EACCES',
      'EPERM',
      'ENOSPC',
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
    ].includes(value.code)
      ? { systemCode: value.code }
      : {}),
    ...(command
      ? {
          exitCode: command.exitCode,
          signal: command.signal,
          spawnCode: command.spawnCode,
          stderr: safeMediaStderr(command.stderr),
        }
      : {}),
  };
}
