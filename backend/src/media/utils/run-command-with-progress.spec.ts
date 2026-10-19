import { runCommandWithProgress } from './run-command-with-progress';
import { MediaCommandError } from './media-command-error';
import * as hostCommands from './host-command';

describe('Media process failure evidence', () => {
  beforeEach(() => {
    // Host concurrency/cancellation have separate tests; use a real child here.
    jest
      .spyOn(hostCommands, 'hostCommand')
      .mockImplementation((command, args) => ({ command, args }));
  });
  afterEach(() => jest.restoreAllMocks());
  it('retains a real child exit code and bounded stderr without putting it in the error message', async () => {
    const line = jest.fn();
    const failure = await runCommandWithProgress(
      process.execPath,
      [
        '-e',
        'process.stdout.write("progress=10\\n");process.stderr.write("x".repeat(6000)+"\\nInvalid synthetic filter\\n");process.exitCode=7;',
      ],
      line,
    ).then(
      () => undefined,
      (error: unknown) => error,
    );
    expect(failure).toBeInstanceOf(MediaCommandError);
    const error = failure as MediaCommandError;
    expect(error.exitCode).toBe(7);
    expect(error.signal).toBeNull();
    expect(error.stderr.length).toBeLessThanOrEqual(4000);
    expect(error.stderr).toContain('Invalid synthetic filter');
    expect(error.message).not.toContain('Invalid synthetic filter');
    expect(line.mock.calls.map(([text]) => text)).toContain('progress=10');
  });
  it('retains a real spawn failure code', async () => {
    await expect(
      runCommandWithProgress('blynta-missing-test-binary-1837', [], () => {}),
    ).rejects.toMatchObject({
      name: 'MediaCommandError',
      spawnCode: 'ENOENT',
      exitCode: null,
    });
  });
});
