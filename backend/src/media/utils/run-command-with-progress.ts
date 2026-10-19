import { spawn } from 'child_process';
import { ProcessRegistryService } from '../../common/services/process-registry.service';
import { hostCommand } from './host-command';
import { MediaCommandError } from './media-command-error';
import { usageExecution, usageSample } from '../../billing/usage-context';
import {
  cancellationSignal,
  ProcessingCancelled,
} from '../../jobs/cancellation-context';

export function runCommandWithProgress(
  command: string,
  args: string[],
  onLine: (line: string) => void,
  processRegistry?: ProcessRegistryService,
  options: { cwd?: string } = {},
): Promise<void> {
  const signal = cancellationSignal();
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    processRegistry?.assertRunning();
    const limited = hostCommand(
      command,
      command === 'ffmpeg' && usageExecution.getStore()
        ? ['-benchmark', ...args]
        : args,
    );
    const proc = spawn(limited.command, limited.args, {
      // Windows PowerShell can exit without executing its script when detached
      // with hidden pipes. Windows cancellation kills the PID tree; Linux uses
      // the detached process group.
      detached: process.platform !== 'win32',
      windowsHide: true,
      env: limited.env,
      cwd: options.cwd,
    });
    processRegistry?.register(proc);

    let stderrBuffer = '';
    let stdoutBuffer = '';
    let fullStderr = '';

    proc.stdout?.on('data', (chunk: Buffer) => {
      stdoutBuffer += chunk.toString();
      const lines = stdoutBuffer.split(/\r?\n|\r/);
      stdoutBuffer = (lines.pop() || '').slice(-8192);
      lines.forEach(onLine);
    });

    proc.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      fullStderr = (fullStderr + text).slice(-4000);
      stderrBuffer += text;
      const lines = stderrBuffer.split(/\r?\n|\r/);
      stderrBuffer = (lines.pop() || '').slice(-8192);
      lines.forEach(onLine);
    });

    proc.on('error', (err) => {
      const code = (err as NodeJS.ErrnoException).code;
      reject(
        new MediaCommandError(
          command,
          null,
          null,
          '',
          code && /^[A-Z_]+$/.test(code) ? code : 'SPAWN_FAILED',
        ),
      );
    });

    proc.on('close', (code, closeSignal) => {
      if (command === 'ffmpeg') {
        const cpu = fullStderr.match(/utime=([\d.]+)s stime=([\d.]+)s/);
        void usageSample('ffmpeg', {
          wallSeconds: (Date.now() - startedAt) / 1000,
          cpuSeconds: cpu ? Number(cpu[1]) + Number(cpu[2]) : null,
          exitCode: code,
        });
      }
      if (stdoutBuffer) onLine(stdoutBuffer);
      if (stderrBuffer) onLine(stderrBuffer);
      if (signal?.aborted) {
        reject(new ProcessingCancelled());
        return;
      }
      if (code === 0) resolve();
      else
        reject(new MediaCommandError(command, code, closeSignal, fullStderr));
    });
  });
}
