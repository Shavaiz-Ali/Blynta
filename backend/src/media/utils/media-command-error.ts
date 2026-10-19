/** Internal process evidence; never put command arguments or stderr in client messages. */
export class MediaCommandError extends Error {
  constructor(
    readonly command: string,
    readonly exitCode: number | null,
    readonly signal: string | null,
    readonly stderr: string,
    readonly spawnCode?: string,
  ) {
    super(
      spawnCode
        ? `Media command could not start (${spawnCode})`
        : `Media command exited with code ${exitCode}`,
    );
    this.name = 'MediaCommandError';
  }
}

export function safeMediaStderr(stderr: string) {
  return (
    stderr
      .slice(-4000)
      .replace(/https?:\/\/[^\s"'<>]+/gi, '[URL]')
      .replace(/(?:Bearer\s+\S+|AIza[A-Za-z0-9_-]+)/gi, '[CREDENTIAL]')
      .replace(
        /\b(?:key|token|authorization|signature)\s*[=:]\s*[^\s,;]+/gi,
        '[CREDENTIAL]',
      )
      .replace(/'[^'\r\n]*'|"[^"\r\n]*"/g, '[QUOTED]')
      .replace(
        /[A-Za-z]:[\\/][^\s,;]+|\/(?:[^\s,;[\]]+\/)*[^\s,;[\]]+/g,
        '[PATH]',
      )
      // eslint-disable-next-line no-control-regex -- Untrusted process output.
      .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '')
      .split(/\r?\n/)
      .slice(-12)
      .join('\n')
      .slice(-1500)
  );
}
