/** Retain source locations, never exception messages or arbitrary stack content. */
export function safeErrorFrames(error: unknown): string[] {
  if (!(error instanceof Error) || typeof error.stack !== 'string') return [];
  return error.stack
    .slice(0, 16000)
    .split('\n')
    .slice(1, 20)
    .flatMap((line) => {
      const match = line.match(
        /[\\/](?:dist[\\/])?src[\\/]([\w./\\-]+:\d+:\d+)/,
      );
      return match ? [match[1].replace(/\\/g, '/')] : [];
    });
}
